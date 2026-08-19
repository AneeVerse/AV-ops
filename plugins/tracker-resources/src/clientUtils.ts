//
// Copyright © 2026 Hardcore Engineering Inc.
//
import contact, {
  AvatarType,
  findContacts,
  type AvatarInfo,
  type Channel,
  type Organization
} from '@hcengineering/contact'
import core, {
  type AttachedData,
  type Class,
  type Data,
  type Doc,
  type Ref,
  type Space,
  type TxOperations,
  fillDefaults,
  generateId
} from '@hcengineering/core'
import { type Client as TrackerClient, type Project } from '@hcengineering/tracker'
import { getCurrentResolvedLocation, type Location } from '@hcengineering/ui'
import { getClient } from '@hcengineering/presentation'
import { writable } from 'svelte/store'
import tracker from './plugin'

export const selectedCompanyStore = writable<Ref<Organization> | undefined>(undefined)
export const selectedClientStore = writable<Ref<TrackerClient> | undefined>(undefined)

export function isClientId (shortLink: string): boolean {
  return /^CLIENT-\d+$/i.test(shortLink)
}

export function createDefaultChannels (): AttachedData<Channel>[] {
  return [
    { provider: contact.channelProvider.Phone, value: '' },
    { provider: contact.channelProvider.Email, value: '' }
  ]
}

export function normalizeChannels (channels: AttachedData<Channel>[]): AttachedData<Channel>[] {
  return channels
    .map((channel) => ({ ...channel, value: channel.value?.trim() ?? '' }))
    .filter((channel) => channel.value.length > 0)
}

export async function persistOrganization (
  client: TxOperations,
  params: {
    name: string
    city?: string
    channels: AttachedData<Channel>[]
    avatarInfo?: Data<AvatarInfo>
    organizationId?: Ref<Organization>
  }
): Promise<Ref<Organization>> {
  const id = params.organizationId ?? generateId()
  const candidate: Data<Organization> = {
    name: params.name,
    city: params.city ?? '',
    avatarType: AvatarType.COLOR,
    description: null
  } as Data<Organization>
  fillDefaults(client.getHierarchy(), candidate, contact.class.Organization)
  if (params.avatarInfo !== undefined) {
    candidate.avatar = params.avatarInfo.avatar
    candidate.avatarType = params.avatarInfo.avatarType
    candidate.avatarProps = params.avatarInfo.avatarProps
  }

  await client.createDoc(contact.class.Organization, contact.space.Contacts, candidate, id)

  for (const channel of normalizeChannels(params.channels)) {
    await client.addCollection(
      contact.class.Channel,
      contact.space.Contacts,
      id,
      contact.class.Organization,
      'channels',
      {
        value: channel.value,
        provider: channel.provider
      }
    )
  }
  return id
}

export async function ensureSequence (
  client: TxOperations,
  attachedTo: Ref<Class<Doc>>
): Promise<Doc> {
  let sequence = await client.findOne(core.class.Sequence, { attachedTo })
  if (sequence === undefined) {
    await client.createDoc(core.class.Sequence, core.space.Workspace, {
      attachedTo,
      sequence: 0
    })
    sequence = await client.findOne(core.class.Sequence, { attachedTo })
  }
  if (sequence === undefined) {
    throw new Error(`Sequence not found for ${attachedTo}`)
  }
  return sequence
}

export async function findOrCreateOrganization (
  client: TxOperations,
  name: string,
  channels: AttachedData<Channel>[]
): Promise<Ref<Organization>> {
  const found = await findContacts(client, contact.class.Organization, name, normalizeChannels(channels))
  const existing = found.contacts[0]
  if (existing !== undefined) {
    return existing._id as Ref<Organization>
  }
  return await persistOrganization(client, { name, channels })
}

export async function getClientTitle (client: TxOperations, ref: Ref<Doc>, doc?: TrackerClient): Promise<string> {
  const object = doc ?? (await client.findOne(tracker.class.Client, { _id: ref as Ref<TrackerClient> }))
  if (object === undefined) throw new Error(`Client not found, _id: ${ref}`)
  return object.identifier
}

export async function getClientId (client: TxOperations, ref: Ref<TrackerClient>, doc?: TrackerClient): Promise<string> {
  const object = doc ?? (await client.findOne(tracker.class.Client, { _id: ref }))
  if (object === undefined) throw new Error(`Client not found, _id: ${ref}`)
  return object.identifier
}

export function setSelectedCompany (company: Ref<Organization> | undefined, clientId?: Ref<TrackerClient>): void {
  selectedCompanyStore.set(company)
  if (clientId !== undefined) {
    selectedClientStore.set(clientId)
  }
  if (company === undefined) {
    selectedClientStore.set(undefined)
  }
}

export async function getClientLinkFragment (doc: Doc, _props?: Record<string, any>): Promise<Location> {
  const object = doc as TrackerClient
  const loc = getCurrentResolvedLocation()
  loc.path.length = 4
  loc.path[2] = 'company'
  loc.path[3] = 'client-home'
  loc.fragment = undefined
  loc.query = {
    company: object.attachedTo,
    client: object._id
  }
  setSelectedCompany(object.attachedTo, object._id)
  return loc
}

export async function generateClientLocation (loc: Location, clientId: string): Promise<Location | undefined> {
  const client = getClient()
  const object = await client.findOne(tracker.class.Client, { identifier: clientId }, { showArchived: true })
  if (object === undefined) {
    return undefined
  }
  setSelectedCompany(object.attachedTo, object._id)
  const appComponent = loc.path[0] ?? ''
  const workspace = loc.path[1] ?? ''
  return {
    path: [appComponent, workspace, 'company', 'client-home'],
    query: {
      company: object.attachedTo,
      client: object._id
    }
  }
}

export async function resolveCompanyLocation (loc: Location): Promise<
  | {
    loc: Location
    defaultLocation: Location
  }
  | undefined
> {
  if (loc.path[2] !== 'company') {
    return undefined
  }
  const shortLink = loc.path[3]
  const listPages = new Set(['my-clients', 'companies', 'funnels'])
  if (shortLink !== undefined && listPages.has(shortLink)) {
    setSelectedCompany(undefined)
    if (loc.query?.company !== undefined || loc.query?.client !== undefined) {
      const query = { ...(loc.query ?? {}) }
      delete query.company
      delete query.client
      const cleaned: Location = {
        ...loc,
        query: Object.keys(query).length > 0 ? query : undefined
      }
      return { loc: cleaned, defaultLocation: cleaned }
    }
    return undefined
  }
  if (shortLink !== undefined && isClientId(shortLink)) {
    const resolved = await generateClientLocation(loc, shortLink)
    if (resolved === undefined) {
      return undefined
    }
    return {
      loc: resolved,
      defaultLocation: resolved
    }
  }
  const company = loc.query?.company as Ref<Organization> | undefined
  if (company !== undefined) {
    setSelectedCompany(company, loc.query?.client as Ref<TrackerClient> | undefined)
    return undefined
  }
  if (shortLink !== undefined) {
    const client = getClient()
    const project = await client.findOne(tracker.class.Project, { _id: shortLink as Ref<Project> })
    if (project?.company !== undefined) {
      setSelectedCompany(project.company)
    }
  }
  return undefined
}

export async function hideClientProjectSpaces (_space: Space): Promise<boolean> {
  return false
}
