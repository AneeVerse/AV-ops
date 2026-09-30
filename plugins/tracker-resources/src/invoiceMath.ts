//
// Copyright © 2026 AneeVerse
//

import type { Client } from '@hcengineering/core'
import type { InvoiceLine, InvoiceParty } from '@hcengineering/tracker'
import { type Organization } from '@hcengineering/contact'
import tracker from '@hcengineering/tracker'
import { ANEEVERSE_STATE_CODE, DEFAULT_GST_RATE, DEFAULT_HSN } from './aneeverseBilling'

export interface InvoiceTotals {
  amount: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export function isIntraMaharashtra (placeOfSupply: string): boolean {
  return new RegExp(`\\(${ANEEVERSE_STATE_CODE}\\)`).test(placeOfSupply) || /maharashtra/i.test(placeOfSupply)
}

export function lineAmount (line: InvoiceLine): number {
  return Math.round(line.quantity * line.rate * 100) / 100
}

export function computeTotals (items: InvoiceLine[], placeOfSupply: string): InvoiceTotals {
  let amountPaise = 0
  let cgstPaise = 0
  let sgstPaise = 0
  let igstPaise = 0
  const intra = isIntraMaharashtra(placeOfSupply)
  for (const line of items) {
    const amt = Math.round(line.quantity * line.rate * 100)
    const gst = Math.round((amt * line.gstRate) / 100)
    amountPaise += amt
    if (intra) {
      const half = Math.floor(gst / 2)
      cgstPaise += half
      sgstPaise += gst - half
    } else {
      igstPaise += gst
    }
  }
  return {
    amount: amountPaise / 100,
    cgst: cgstPaise / 100,
    sgst: sgstPaise / 100,
    igst: igstPaise / 100,
    total: (amountPaise + cgstPaise + sgstPaise + igstPaise) / 100
  }
}

export function formatINR (value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

export function formatInvoiceDate (ts: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(ts))
}

export function monthKey (ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel (key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

export function toDateInput (ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fromDateInput (value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

export function emptyLine (): InvoiceLine {
  return { title: '', hsn: DEFAULT_HSN, gstRate: DEFAULT_GST_RATE, quantity: 1, rate: 0 }
}

export function emptyParty (): InvoiceParty {
  return { name: '', address: '', gstin: '', pan: '', phone: '' }
}

export function partyFromOrganization (org: Organization): InvoiceParty {
  return {
    name: org.name ?? '',
    address: org.billingAddress ?? '',
    gstin: org.gstin ?? '',
    pan: org.pan ?? '',
    phone: org.billingPhone ?? ''
  }
}

export async function nextInvoiceNumber (client: Client): Promise<string> {
  const existing = await client.findAll(tracker.class.Invoice, {})
  let max = 0
  for (const inv of existing) {
    const match = /^AV(\d+)$/.exec(inv.number)
    if (match !== null) {
      max = Math.max(max, parseInt(match[1], 10))
    }
  }
  return `AV${String(max + 1).padStart(6, '0')}`
}

export function lineCgst (line: InvoiceLine, placeOfSupply: string): number {
  if (!isIntraMaharashtra(placeOfSupply)) return 0
  const gst = Math.round(lineAmount(line) * line.gstRate)
  return Math.floor(gst / 2) / 100
}

export function lineSgst (line: InvoiceLine, placeOfSupply: string): number {
  if (!isIntraMaharashtra(placeOfSupply)) return 0
  const gst = Math.round(lineAmount(line) * line.gstRate)
  return (gst - Math.floor(gst / 2)) / 100
}

export function lineTotal (line: InvoiceLine, placeOfSupply: string): number {
  const amt = Math.round(line.quantity * line.rate * 100)
  const gst = Math.round((amt * line.gstRate) / 100)
  return (amt + gst) / 100
}
