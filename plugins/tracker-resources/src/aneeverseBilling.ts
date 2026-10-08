//
// Copyright © 2026 AneeVerse
//

import core, { type Client } from '@hcengineering/core'
import tracker, { type InvoiceItemTemplate, type InvoiceParty, type InvoiceProfile } from '@hcengineering/tracker'

export const ANEEVERSE_BRAND = '#279ea6'
export const ANEEVERSE_BRAND_WASH = '#e5f5f6'
export const ANEEVERSE_STATE_CODE = '27'

export const ANEEVERSE_BILLED_BY: InvoiceParty = {
  name: 'ANEEVERSE CREATIVE SOLUTIONS',
  address:
    'FLAT NO 404 HOUSE NO 2277, VISHNUGANGA APPT, Ghansoli Buhari Marg, Ghansoli Gaon, Navi Mumbai, Thane, Maharashtra, India - 400701',
  gstin: '27ACHFA6158J1Z3',
  pan: 'ACHFA6158J',
  phone: '+91 91527 55529'
}

export const ANEEVERSE_BANK = {
  accountName: 'Aneeverse Creative Solutions',
  accountNumber: '925020053586061',
  ifsc: 'UTIB0004865',
  accountType: 'Current',
  bank: 'Axis Bank'
}

export const ANEEVERSE_SIGNATORY = 'Abhijeet'

export const DEFAULT_ITEM_TEMPLATES: InvoiceItemTemplate[] = [
  { title: 'Website Development', hsn: '195525', gstRate: 18 },
  { title: 'Platform Development', hsn: '1548562', gstRate: 18 }
]

export const DEFAULT_COUNTRY_OF_SUPPLY = 'India'
export const DEFAULT_PLACE_OF_SUPPLY = 'Maharashtra (27)'
export const DEFAULT_HSN = '998314'
export const DEFAULT_GST_RATE = 18
export const DEFAULT_DUE_DAYS = 15

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
): Promise<{ profile: InvoiceProfile | undefined, billedBy: InvoiceParty, itemTemplates: InvoiceItemTemplate[], defaultSignatory: string }> {
  const profile = await client.findOne(tracker.class.InvoiceProfile, {})
  return {
    profile,
    billedBy: cloneParty(profile?.billedBy ?? ANEEVERSE_BILLED_BY),
    itemTemplates: mergeItemTemplates(profile?.itemTemplates),
    defaultSignatory: profile?.defaultSignatory ?? ANEEVERSE_SIGNATORY
  }
}

export async function persistWorkspaceBilledBy (
  client: Client,
  profile: InvoiceProfile | undefined,
  billedBy: InvoiceParty,
  itemTemplates?: InvoiceItemTemplate[],
  defaultSignatory?: string
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
