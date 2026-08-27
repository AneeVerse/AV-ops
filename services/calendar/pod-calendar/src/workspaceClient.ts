//
// Copyright © 2023 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import { AccountClient } from '@hcengineering/account-client'
import calendar, { ExternalCalendar, isGoogleMeetPlaceholder } from '@hcengineering/calendar'
import contact, { getPersonRefsBySocialIds, Person } from '@hcengineering/contact'
import core, {
  MeasureContext,
  RateLimiter,
  SocialIdType,
  TxOperations,
  WorkspaceUuid,
  type Ref
} from '@hcengineering/core'

import { CalendarClient } from './calendar'
import { getClient } from './client'
import config from './config'
import { getSyncHistory, setSyncHistory } from './kvsUtils'
import { synced } from './mutex'
import { IncomingSyncManager } from './sync'
import { getWorkspaceTokens } from './tokens'
import { GoogleEmail, Token } from './types'
import { addUserByEmail } from './utils'
import { resolveExternalCalendar } from './resolveCalendar'

export class WorkspaceClient {
  private readonly clients = new Map<GoogleEmail, CalendarClient>()
  private readonly calendarsByExternal = new Map<string, ExternalCalendar>()
  readonly calendarsById = new Map<Ref<ExternalCalendar>, ExternalCalendar>()
  readonly participants = new Map<Ref<Person>, string>()
  private lastSync: number = 0

  private constructor (
    private readonly ctx: MeasureContext,
    private readonly accountClient: AccountClient,
    private readonly client: TxOperations,
    private readonly workspace: WorkspaceUuid
  ) {}

  static async run (ctx: MeasureContext, accountClient: AccountClient, workspace: WorkspaceUuid): Promise<void> {
    const client = await getClient(workspace)
    const txOp = new TxOperations(client, core.account.System)
    const instance = new WorkspaceClient(ctx, accountClient, txOp, workspace)

    await instance.init()
    await instance.startAll()
    await instance.close()
  }

  async init (): Promise<void> {
    const calendars = await this.client.findAll(calendar.class.ExternalCalendar, {})
    this.calendarsById.clear()
    this.calendarsByExternal.clear()
    for (const calendar of calendars) {
      this.calendarsById.set(calendar._id, calendar)
      this.calendarsByExternal.set(calendar.externalId, calendar)
    }
    await this.fillParticipants()
  }

  private async fillParticipants (): Promise<void> {
    const personsBySocialId = await getPersonRefsBySocialIds(this.client)
    const emailSocialIds = await this.client.findAll(contact.class.SocialIdentity, {
      type: { $in: [SocialIdType.GOOGLE, SocialIdType.EMAIL] }
    })
    this.participants.clear()

    for (const sID of emailSocialIds) {
      if (sID.value === '') continue
      const pers = personsBySocialId[sID._id]
      if (pers != null) {
        this.participants.set(pers, sID.value)
      }
    }
  }

  async startAll (): Promise<void> {
    const tokens = await getWorkspaceTokens(this.accountClient, this.workspace)
    for (const token of tokens) {
      if (token.workspaceUuid === null) continue
      const parsedToken = JSON.parse(token.secret)
      addUserByEmail(parsedToken, token.key as GoogleEmail)
      await this.createCalendarClient(parsedToken)
    }
    const limiter = new RateLimiter(config.InitLimit)
    for (const token of tokens) {
      await limiter.add(async () => {
        const parsedToken = JSON.parse(token.secret)
        await IncomingSyncManager.sync(this.ctx, this.accountClient, parsedToken, parsedToken.email)
      })
    }
    await limiter.waitProcessing()
    await this.pushLocalEventsToGoogle()
    await this.getNewEvents()
  }

  private async createCalendarClient (user: Token): Promise<CalendarClient | undefined> {
    const current = this.clients.get(user.email)
    if (current !== undefined) {
      return current
    }
    const newClient = await CalendarClient.create(this.ctx, this.accountClient, user, this.client, this)
    if (newClient === undefined) {
      return
    }
    this.clients.set(user.email, newClient)
    return newClient
  }

  private async close (): Promise<void> {
    this.clients.clear()
    await this.client?.close()
  }

  // #region Events

  private async updateSyncHistory (): Promise<void> {
    try {
      await setSyncHistory(this.workspace, this.lastSync)
    } catch (err) {
      this.ctx.error('Failed to update sync history', {
        workspace: this.workspace,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  private async pushLocalEventsToGoogle (): Promise<void> {
    const from = Date.now() - 14 * 86400000
    const to = Date.now() + 90 * 86400000
    const recent = Date.now() - 2 * 86400000
    const events = await this.client.findAll(calendar.class.Event, {
      dueDate: { $gt: from },
      date: { $lt: to }
    })
    const externalIds = new Set<string>(Array.from(this.calendarsById.keys()))
    let pushed = 0
    for (const original of events) {
      let event = original
      const onGoogle = externalIds.has(event.calendar)
      const needsMeet = isGoogleMeetPlaceholder(event.location)
      if (onGoogle && !needsMeet) continue
      if (!onGoogle && !needsMeet && event.modifiedOn < recent) continue
      try {
        const resolved = await resolveExternalCalendar(this.client, event)
        if (resolved === undefined) continue
        const client = this.clients.get(resolved.externalUser as GoogleEmail)
        if (client === undefined) continue
        if (event.calendar !== resolved._id) {
          await this.client.update(event, { calendar: resolved._id })
          event = { ...event, calendar: resolved._id }
        }
        await client.syncMyEvent(event)
        pushed++
      } catch (err) {
        this.ctx.error('Failed to push local event to Google', {
          event: event._id,
          workspace: this.workspace,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
    this.ctx.info('Pushed local events to Google', { workspace: this.workspace, pushed })
  }

  private async getNewEvents (): Promise<void> {
    const lastSync = await getSyncHistory(this.workspace)
    if (lastSync === undefined || Date.now() - lastSync > 7 * 24 * 60 * 60 * 1000) {
      await setSyncHistory(this.workspace, Date.now())
      return
    }
    this.lastSync = lastSync ?? 0
    const query = { modifiedOn: { $gt: lastSync }, calendar: { $in: Array.from(this.calendarsById.keys()) } }
    const newEvents = await this.client.findAll(calendar.class.Event, query, { sort: { modifiedOn: 1 } })
    const interval = setInterval(() => {
      void this.updateSyncHistory()
    }, 5000)
    for (const newEvent of newEvents) {
      try {
        const client = this.getCalendarClientByCalendar(newEvent.calendar as Ref<ExternalCalendar>)
        if (client === undefined) {
          this.ctx.warn('Client not found', { calendar: newEvent.calendar, workspace: this.workspace })
          continue
        }
        await client.syncMyEvent(newEvent)
        this.lastSync = newEvent.modifiedOn
      } catch (err) {
        this.ctx.error('Failed to sync event', {
          event: newEvent._id,
          workspace: this.workspace,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
    clearInterval(interval)
    await setSyncHistory(this.workspace, Date.now())
    synced.add(this.workspace)
    this.ctx.info('all outcoming messages synced', { workspace: this.workspace })
  }

  private getCalendarClientByCalendar (id: Ref<ExternalCalendar>): CalendarClient | undefined {
    const calendar = this.calendarsById.get(id)
    if (calendar === undefined) {
      this.ctx.warn("couldn't find calendar by id", { id })
      return
    }
    return this.clients.get(calendar.externalUser as GoogleEmail)
  }
  // #endregion
}
