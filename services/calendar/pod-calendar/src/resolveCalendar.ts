//
// Copyright © 2026 AneeVerse.
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

import calendar, { Event, ExternalCalendar } from '@hcengineering/calendar'
import contact, { Person, SocialIdentityRef } from '@hcengineering/contact'
import core, { PersonId, Ref, TxOperations } from '@hcengineering/core'

/**
 * Resolve the Google calendar that should receive a Huly event.
 *
 * Planner / Create Event often write to the personal HULY calendar
 * (`<accountUuid>_calendar`) while the Google integration lives on a
 * different social id. Without this fallback those events never leave Huly
 * and Google Meet stays a placeholder.
 */
export async function resolveExternalCalendar (
  client: TxOperations,
  event: Event
): Promise<ExternalCalendar | undefined> {
  const byId = await client.findOne(calendar.class.ExternalCalendar, {
    _id: event.calendar as Ref<ExternalCalendar>
  })
  if (byId !== undefined) return byId

  const socialIds = await socialIdsForEvent(client, event)
  if (socialIds.length === 0) return undefined

  return (
    (await client.findOne(calendar.class.ExternalCalendar, {
      user: { $in: socialIds },
      default: true,
      hidden: false
    })) ??
    (await client.findOne(calendar.class.ExternalCalendar, {
      user: { $in: socialIds },
      hidden: false
    })) ??
    (await client.findOne(calendar.class.ExternalCalendar, {
      user: { $in: socialIds }
    }))
  )
}

async function socialIdsForEvent (client: TxOperations, event: Event): Promise<PersonId[]> {
  const seeds = new Set<PersonId>()
  if (event.user != null) seeds.add(event.user)
  if (event.createdBy != null && event.createdBy !== core.account.System) seeds.add(event.createdBy)
  if (event.modifiedBy != null && event.modifiedBy !== core.account.System) seeds.add(event.modifiedBy)
  if (seeds.size === 0) return []

  const identities = await client.findAll(contact.class.SocialIdentity, {
    _id: { $in: Array.from(seeds) as SocialIdentityRef[] }
  })
  const persons = new Set<Ref<Person>>()
  for (const id of identities) {
    persons.add(id.attachedTo)
  }

  if (persons.size > 0) {
    const personDocs = await client.findAll(contact.class.Person, { _id: { $in: Array.from(persons) } })
    const uuids = personDocs.map((p) => p.personUuid).filter((u): u is NonNullable<typeof u> => u != null)
    if (uuids.length > 0) {
      const siblings = await client.findAll(contact.class.Person, { personUuid: { $in: uuids } })
      for (const s of siblings) persons.add(s._id)
    }
  }

  if (persons.size === 0) return Array.from(seeds)

  const all = await client.findAll(contact.class.SocialIdentity, {
    attachedTo: { $in: Array.from(persons) }
  })
  const result = new Set<PersonId>(seeds)
  for (const s of all) result.add(s._id)
  return Array.from(result)
}
