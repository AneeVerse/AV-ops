import { Analytics } from '@hcengineering/analytics'
import contact, {
  AvatarType,
  type AvatarInfo,
  type Channel,
  type Contact,
  type Organization
} from '@hcengineering/contact'
import {
  type AttachedData,
  type Class,
  type Data,
  type Doc,
  type MixinData,
  type Ref,
  type TxOperations,
  makeCollabId
} from '@hcengineering/core'
import { type Customer, LeadEvents, type Lead } from '@hcengineering/lead'
import { createMarkup } from '@hcengineering/presentation'
import { EmptyMarkup, isEmptyMarkup } from '@hcengineering/text'
import lead from './plugin'

export async function getLeadTitle (client: TxOperations, ref: Ref<Doc>, doc?: Lead): Promise<string> {
  const object = doc ?? (await client.findOne(lead.class.Lead, { _id: ref as Ref<Lead> }))
  if (object === undefined) throw new Error(`Lead not found, _id: ${ref}`)
  return `LEAD-${object.number}`
}

export async function getLeadId (client: TxOperations, ref: Ref<Lead>, doc?: Lead): Promise<string> {
  const object = doc ?? (await client.findOne(lead.class.Lead, { _id: ref }))
  if (object === undefined) throw new Error(`Lead not found, _id: ${ref}`)
  return object.identifier
}

export interface CustomerDraft {
  customerId: Ref<Contact>
  targetClass: Ref<Class<Doc>>
  firstName: string
  lastName: string
  name: string
  city: string
  description: string
  channels: AttachedData<Channel>[]
  extra?: Record<string, any>
  avatar?: File
  avatarInfo?: Data<AvatarInfo>
}

export function createDefaultChannels (): AttachedData<Channel>[] {
  return [
    { provider: contact.channelProvider.Phone, value: '' },
    { provider: contact.channelProvider.Email, value: '' }
  ]
}

export function normalizeCustomerChannels (channels: AttachedData<Channel>[]): AttachedData<Channel>[] {
  return channels
    .map((channel) => ({ ...channel, value: channel.value?.trim() ?? '' }))
    .filter((channel) => channel.value.length > 0)
}

export async function persistCustomer (client: TxOperations, draft: CustomerDraft): Promise<Ref<Contact>> {
  const candidate: Data<Contact> = {
    name: draft.name,
    city: draft.city,
    avatarType: AvatarType.COLOR
  }
  if (draft.avatarInfo !== undefined) {
    candidate.avatar = draft.avatarInfo.avatar
    candidate.avatarType = draft.avatarInfo.avatarType
    candidate.avatarProps = draft.avatarInfo.avatarProps
  }

  if (client.getHierarchy().isDerived(draft.targetClass, contact.class.Organization)) {
    ;(candidate as Organization).description = null
  }

  const candidateData: MixinData<Contact, Customer> = {
    customerDescription: null
  }

  const description = draft.description ?? EmptyMarkup
  if (!isEmptyMarkup(description)) {
    const collabId = makeCollabId(lead.mixin.Customer, draft.customerId, 'customerDescription')
    candidateData.customerDescription = await createMarkup(collabId, description)
  }

  const id = await client.createDoc(
    draft.targetClass,
    contact.space.Contacts,
    { ...(draft.extra ?? {}), ...candidate },
    draft.customerId
  )
  await client.createMixin(
    id as Ref<Contact>,
    draft.targetClass,
    contact.space.Contacts,
    lead.mixin.Customer,
    candidateData
  )

  const channels = normalizeCustomerChannels(draft.channels)
  for (const channel of channels) {
    await client.addCollection(
      contact.class.Channel,
      contact.space.Contacts,
      draft.customerId,
      draft.targetClass,
      'channels',
      {
        value: channel.value,
        provider: channel.provider
      }
    )
  }
  Analytics.handleEvent(LeadEvents.CustomerCreated, { id })
  return id as Ref<Contact>
}
