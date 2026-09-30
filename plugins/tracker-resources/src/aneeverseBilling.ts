//
// Copyright © 2026 AneeVerse
//

import core, { type Client } from '@hcengineering/core'
import tracker, { type InvoiceParty, type InvoiceProfile } from '@hcengineering/tracker'

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

export async function loadWorkspaceBilledBy (
  client: Client
): Promise<{ profile: InvoiceProfile | undefined, billedBy: InvoiceParty }> {
  const profile = await client.findOne(tracker.class.InvoiceProfile, {})
  return {
    profile,
    billedBy: cloneParty(profile?.billedBy ?? ANEEVERSE_BILLED_BY)
  }
}

export async function persistWorkspaceBilledBy (
  client: Client,
  profile: InvoiceProfile | undefined,
  billedBy: InvoiceParty
): Promise<void> {
  const next = cloneParty(billedBy)
  const existing =
    profile ??
    (await client.findOne(tracker.class.InvoiceProfile, { _id: tracker.ids.InvoiceProfile })) ??
    (await client.findOne(tracker.class.InvoiceProfile, {}))
  if (existing !== undefined) {
    await client.update(existing, { billedBy: next })
    return
  }
  await client.createDoc(
    tracker.class.InvoiceProfile,
    core.space.Workspace,
    { billedBy: next },
    tracker.ids.InvoiceProfile
  )
}
