//
// Copyright © 2026 AneeVerse
//

import core, { AccountRole, getCurrentAccount, type Client, type Ref, type Space } from '@hcengineering/core'
import contact, { type Employee } from '@hcengineering/contact'
import tracker, {
  type Invoice,
  type InvoiceBank,
  type InvoiceItemTemplate,
  type InvoiceParty,
  type InvoiceProfile,
  type InvoiceSequence,
  type Project
} from '@hcengineering/tracker'

export const ANEEVERSE_BRAND = '#279ea6'
export const ANEEVERSE_BRAND_WASH = '#e5f5f6'
export const ANEEVERSE_STATE_CODE = '27'
export const ANEEVERSE_SIGNATORY = 'Abhijeet'

/** Staff-only space for invoices. Guests are not members. */
export const BILLING_SPACE_ID = 'aneeverse:space:Billing' as Ref<Space>
export const INVOICE_SEQUENCE_ID = 'aneeverse:invoice-sequence' as Ref<InvoiceSequence>

export const DEFAULT_ITEM_TEMPLATES: InvoiceItemTemplate[] = [
  { title: 'Website Development', hsn: '195525', gstRate: 18 },
  { title: 'Platform Development', hsn: '1548562', gstRate: 18 }
]

export const DEFAULT_COUNTRY_OF_SUPPLY = 'India'
export const DEFAULT_PLACE_OF_SUPPLY = 'Maharashtra (27)'
export const DEFAULT_HSN = '998314'
export const DEFAULT_GST_RATE = 18
export const DEFAULT_DUE_DAYS = 15

export function blankParty (): InvoiceParty {
  return { name: '', address: '', gstin: '', pan: '', phone: '' }
}

export function blankBank (): InvoiceBank {
  return { accountName: '', accountNumber: '', ifsc: '', accountType: '', bank: '' }
}
export function cloneParty (party: InvoiceParty): InvoiceParty {
  return {
    name: party.name?.trim() ?? '',
    address: party.address?.trim() ?? '',
    gstin: party.gstin?.trim() ?? '',
    pan: party.pan?.trim() ?? '',
    phone: party.phone?.trim() ?? ''
  }
}

export function mergeItemTemplates (custom?: InvoiceItemTemplate[]): InvoiceItemTemplate[] {
  const map = new Map<string, InvoiceItemTemplate>()
  for (const t of DEFAULT_ITEM_TEMPLATES) {
    map.set(t.title.trim().toLowerCase(), { ...t })
  }
  if (Array.isArray(custom)) {
    for (const t of custom) {
      if (t.title && t.title.trim() !== '') {
        map.set(t.title.trim().toLowerCase(), {
          title: t.title.trim(),
          hsn: t.hsn?.trim() || '998314',
          gstRate: Number(t.gstRate) || 0
        })
      }
    }
  }
  return Array.from(map.values())
}

export async function loadWorkspaceBilledBy (
  client: Client
): Promise<{
  profile: InvoiceProfile | undefined
  billedBy: InvoiceParty
  itemTemplates: InvoiceItemTemplate[]
  defaultSignatory: string
  bank: InvoiceBank
}> {
  const profile = await client.findOne(tracker.class.InvoiceProfile, {})
  return {
    profile,
    billedBy: cloneParty(profile?.billedBy ?? blankParty()),
    itemTemplates: mergeItemTemplates(profile?.itemTemplates),
    defaultSignatory: profile?.defaultSignatory ?? ANEEVERSE_SIGNATORY,
    bank: { ...blankBank(), ...(profile?.bank ?? {}) }
  }
}

export async function persistWorkspaceBilledBy (
  client: Client,
  profile: InvoiceProfile | undefined,
  billedBy: InvoiceParty,
  itemTemplates?: InvoiceItemTemplate[],
  defaultSignatory?: string,
  bank?: InvoiceBank
): Promise<void> {
  const next = cloneParty(billedBy)
  const existing =
    profile ??
    (await client.findOne(tracker.class.InvoiceProfile, { _id: tracker.ids.InvoiceProfile })) ??
    (await client.findOne(tracker.class.InvoiceProfile, {}))
  const patch: Partial<InvoiceProfile> = { billedBy: next }
  if (itemTemplates !== undefined) {
    patch.itemTemplates = itemTemplates
  }
  if (defaultSignatory !== undefined) {
    patch.defaultSignatory = defaultSignatory
  }
  if (bank !== undefined) {
    patch.bank = bank
  }
  if (existing !== undefined) {
    await client.update(existing, patch)
    return
  }
  await client.createDoc(
    tracker.class.InvoiceProfile,
    core.space.Workspace,
    patch,
    tracker.ids.InvoiceProfile
  )
}

const GUEST_ROLES = new Set<AccountRole>([AccountRole.Guest, AccountRole.ReadOnlyGuest, AccountRole.DocGuest])

export function isGuestAccount (role: AccountRole | undefined): boolean {
  return role !== undefined && GUEST_ROLES.has(role)
}

export function invoicesForAccount<T> (role: AccountRole | undefined, rows: T[]): T[] {
  return isGuestAccount(role) ? [] : rows
}

export function formatInvoiceNumber (n: number): string {
  return `AV${String(Math.max(0, Math.floor(n))).padStart(6, '0')}`
}

export async function ensureBillingSpace (client: Client): Promise<Ref<Space>> {
  const existing = await client.findOne(core.class.Space, { _id: BILLING_SPACE_ID })
  if (existing !== undefined) return BILLING_SPACE_ID
  const employees = await client.findAll(contact.class.Employee, { active: true })
  const members = employees
    .filter((person) => person.role !== 'GUEST')
    .map((person) => person.personUuid)
    .filter((id): id is NonNullable<Employee['personUuid']> => id != null)
  const me = getCurrentAccount().uuid
  if (!members.includes(me)) members.push(me)
  await client.createDoc(
    core.class.Space,
    core.space.Space,
    {
      name: 'Billing',
      description: 'Staff invoices',
      private: true,
      archived: false,
      members
    },
    BILLING_SPACE_ID
  )
  return BILLING_SPACE_ID
}

export async function ensureInvoiceSequence (client: Client): Promise<void> {
  const existing = await client.findOne(tracker.class.InvoiceSequence, { _id: INVOICE_SEQUENCE_ID })
  if (existing !== undefined) return
  await client.createDoc(
    tracker.class.InvoiceSequence,
    core.space.Workspace,
    { next: 0, migrated: false },
    INVOICE_SEQUENCE_ID
  )
}

export async function allocateInvoiceNumber (client: Client): Promise<string> {
  await ensureInvoiceSequence(client)
  const inc = await client.updateDoc(
    tracker.class.InvoiceSequence,
    core.space.Workspace,
    INVOICE_SEQUENCE_ID,
    { $inc: { next: 1 } },
    true
  )
  const next = (inc as { object?: InvoiceSequence }).object?.next
  if (typeof next !== 'number') throw new Error('Invoice number was not allocated')
  return formatInvoiceNumber(next)
}

export async function migrateInvoicesToBilling (client: Client): Promise<void> {
  const sequence = await client.findOne(tracker.class.InvoiceSequence, { _id: INVOICE_SEQUENCE_ID })
  if (sequence?.migrated === true) return
  const billing = await ensureBillingSpace(client)
  const invoices = await client.findAll(tracker.class.Invoice, {})
  for (const invoice of invoices) {
    if (invoice.space === billing) continue
    const project = invoice.project ?? (invoice.space as Ref<Project>)
    await client.update(invoice, { space: billing, project })
  }
  if (sequence !== undefined) {
    await client.update(sequence, { migrated: true })
  }
}
