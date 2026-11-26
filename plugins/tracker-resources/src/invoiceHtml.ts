//
// Copyright © 2026 AneeVerse
//

import type { Invoice, InvoiceBank, InvoiceLine, InvoiceParty, InvoicePayment } from '@hcengineering/tracker'
import {
  ANEEVERSE_BRAND,
  ANEEVERSE_BRAND_WASH,
  ANEEVERSE_SIGNATORY,
  blankBank,
  cloneParty
} from './aneeverseBilling'
import { ANEEVERSE_LOGO_HTML } from './aneeverseLogo'
import { getSignatory } from './aneeverseSignatures'
import {
  formatINR,
  formatInvoiceDate,
  invoiceBalance,
  invoicePaidAmount,
  isIntraMaharashtra,
  lineAmount,
  lineCgst,
  lineSgst,
  lineTotal,
  type InvoiceTotals
} from './invoiceMath'

export interface InvoiceView {
  number: string
  invoiceDate: number
  dueDate: number
  billedBy: InvoiceParty
  billedTo: InvoiceParty
  countryOfSupply: string
  placeOfSupply: string
  items: InvoiceLine[]
  totals: InvoiceTotals
  signatory?: string
  notes?: string
  payments?: InvoicePayment[]
  paidAmount?: number
  balanceDue?: number
  bank?: InvoiceBank
}

function escapeHtml (value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function partyHtml (title: string, party: InvoiceParty): string {
  const bits: string[] = [`<div class="av-party-title">${escapeHtml(title)}</div>`]
  bits.push(`<div class="av-party-name">${escapeHtml(party.name)}</div>`)
  if (party.address !== '') {
    bits.push(`<div>${escapeHtml(party.address).replace(/\n/g, '<br>')}</div>`)
  }
  if (party.gstin !== '') {
    bits.push(`<div>GSTIN: ${escapeHtml(party.gstin)}</div>`)
  }
  if (party.pan !== '') {
    bits.push(`<div>PAN: ${escapeHtml(party.pan)}</div>`)
  }
  if (party.phone !== '') {
    bits.push(`<div>Phone: ${escapeHtml(party.phone)}</div>`)
  }
  return `<div class="av-party">${bits.join('')}</div>`
}

function itemsHtml (view: InvoiceView): string {
  const intra = isIntraMaharashtra(view.placeOfSupply)
  const rows = view.items
    .map((line, index) => {
      const hsn = line.hsn !== '' ? ` <span class="av-hsn">(HSN/SAC: ${escapeHtml(line.hsn)})</span>` : ''
      const stripe = index % 2 === 1 ? ' class="av-stripe"' : ''
      return `<tr${stripe}>
        <td class="av-item">${escapeHtml(line.title)}${hsn}</td>
        <td class="av-num">${line.gstRate}%</td>
        <td class="av-num">${line.quantity}</td>
        <td class="av-num">${formatINR(line.rate)}</td>
        <td class="av-num">${formatINR(lineAmount(line))}</td>
        <td class="av-num">${intra ? formatINR(lineCgst(line, view.placeOfSupply)) : formatINR(0)}</td>
        <td class="av-num">${intra ? formatINR(lineSgst(line, view.placeOfSupply)) : formatINR(0)}</td>
        <td class="av-num">${formatINR(lineTotal(line, view.placeOfSupply))}</td>
      </tr>`
    })
    .join('')
  return `<table class="av-table">
    <thead>
      <tr>
        <th class="av-item">Item</th>
        <th>GST Rate</th>
        <th>Quantity</th>
        <th>Rate</th>
        <th>Amount</th>
        <th>CGST</th>
        <th>SGST</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

const PRINT_COLOR_ADJUST = `
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
    forced-color-adjust: none;`

export const INVOICE_CSS = `
  .av-page {
    --av-brand: ${ANEEVERSE_BRAND};
    --av-wash: ${ANEEVERSE_BRAND_WASH};
    box-sizing: border-box;
    width: 210mm;
    min-height: 297mm;
    padding: 14mm 14mm 16mm;
    margin: 0 auto;
    background: #ffffff;
    color: #1a1a1a;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.45;
    position: relative;
    ${PRINT_COLOR_ADJUST}
  }
  .av-page *,
  .av-page *::before,
  .av-page *::after {
    box-sizing: border-box;
    ${PRINT_COLOR_ADJUST}
  }
  .av-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }
  .av-title {
    margin: 0;
    font-size: 32px;
    font-weight: 600;
    color: ${ANEEVERSE_BRAND};
    letter-spacing: 0.02em;
  }
  .av-meta { margin-top: 10px; }
  .av-meta div { margin: 2px 0; }
  .av-logo { flex: 0 0 auto; }
  .av-brand {
    display: flex;
    align-items: center;
  }
  .av-brand img {
    height: 50px;
    width: auto;
    display: block;
    margin-right: -11px;
  }
  .av-brand-word {
    font-size: 28px;
    font-weight: 700;
    color: #073742;
    letter-spacing: 0.04em;
    line-height: 1;
    transform: translateY(-3px);
  }
  .av-parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 18px;
  }
  .av-party {
    background-color: ${ANEEVERSE_BRAND_WASH};
    border-radius: 4px;
    padding: 12px 14px;
    min-height: 118px;
  }
  .av-party-title {
    color: ${ANEEVERSE_BRAND};
    font-weight: 700;
    margin-bottom: 6px;
  }
  .av-party-name { font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
  .av-supply { margin: 12px 0 14px; }
  .av-supply span + span { margin-left: 28px; }
  .av-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .av-table th {
    background-color: ${ANEEVERSE_BRAND};
    color: #ffffff;
    font-weight: 600;
    text-align: right;
    padding: 8px 6px;
    font-size: 10px;
  }
  .av-table th.av-item, .av-table td.av-item { text-align: left; width: 32%; }
  .av-table td {
    padding: 8px 6px;
    vertical-align: top;
    border-bottom: 1px solid #ececec;
  }
  .av-table td.av-num, .av-table th:not(.av-item) { text-align: right; }
  .av-table tr.av-stripe td { background: #f7f7f7; }
  .av-hsn { color: #666; font-size: 10px; }
  .av-footer {
    display: grid;
    grid-template-columns: 1fr 220px;
    gap: 16px;
    margin-top: 18px;
    align-items: start;
  }
  .av-bank {
    background-color: ${ANEEVERSE_BRAND_WASH};
    border-radius: 4px;
    padding: 12px 14px;
  }
  .av-bank-title {
    color: ${ANEEVERSE_BRAND};
    font-weight: 700;
    margin-bottom: 6px;
  }
  .av-totals { padding-top: 4px; }
  .av-totals-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 4px 0;
  }
  .av-totals-row.av-grand {
    font-weight: 700;
    font-size: 13px;
    border-bottom: 3px double ${ANEEVERSE_BRAND};
    padding-bottom: 4px;
    margin-top: 8px;
    color: ${ANEEVERSE_BRAND};
  }
  .av-totals-row.av-paid span:last-child { color: #0f766e; }
  .av-totals-row.av-balance span:last-child { color: #b45309; font-weight: 700; }
  .av-notes {
    margin-top: 14px;
    padding: 10px 12px;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    background: #fafafa;
  }
  .av-notes-title {
    font-weight: 700;
    color: ${ANEEVERSE_BRAND};
    margin-bottom: 4px;
  }
  .av-payments {
    margin-top: 14px;
    padding: 10px 12px;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    background: #fafafa;
  }
  .av-payments-title {
    font-weight: 700;
    color: ${ANEEVERSE_BRAND};
    margin-bottom: 6px;
  }
  .av-pay-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .av-pay-table th {
    text-align: left;
    font-weight: 600;
    color: #555;
    border-bottom: 1px solid #e5e5e5;
    padding: 3px 6px 5px 0;
  }
  .av-pay-table th.av-num,
  .av-pay-table td.av-num {
    text-align: right;
  }
  .av-pay-table td {
    padding: 4px 6px 4px 0;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: top;
  }
  .av-pay-table tr:last-child td { border-bottom: 0; }
  .av-pay-note { color: #666; }
  .av-sign {
    margin-top: 24px;
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .av-sign-img {
    height: 52px;
    max-width: 170px;
    object-fit: contain;
    display: block;
    margin-bottom: 2px;
  }
  .av-sign-name {
    font-family: "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive;
    font-size: 22px;
    color: #111;
    min-height: 28px;
  }
  .av-sign-line {
    margin-top: 4px;
    font-weight: 700;
  }
  @page { size: A4; margin: 0; }
  @media print {
    html, body {
      margin: 0;
      padding: 0;
      background: #fff !important;
      color-scheme: only light;
      ${PRINT_COLOR_ADJUST}
    }
    .av-page {
      page-break-after: always;
      box-shadow: none;
      background: #ffffff !important;
    }
    .av-page:last-child { page-break-after: auto; }
    .av-title,
    .av-party-title,
    .av-bank-title,
    .av-totals-row.av-grand {
      color: ${ANEEVERSE_BRAND} !important;
    }
    .av-party,
    .av-bank {
      background-color: ${ANEEVERSE_BRAND_WASH} !important;
    }
    .av-table th {
      background-color: ${ANEEVERSE_BRAND} !important;
      color: #ffffff !important;
    }
    .av-table tr.av-stripe td { background-color: #f7f7f7 !important; }
  }
`

export function invoiceToView (invoice: Invoice, bank?: InvoiceBank): InvoiceView {
  const items = Array.isArray(invoice.items) ? invoice.items : []
  const paidAmount = invoicePaidAmount(invoice)
  const balanceDue = invoiceBalance(invoice)
  return {
    number: invoice.number,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    billedBy: invoice.billedBy?.name ? cloneParty(invoice.billedBy) : emptyPartyFallback(),
    billedTo: invoice.billedTo ?? emptyPartyFallback(),
    countryOfSupply: invoice.countryOfSupply,
    placeOfSupply: invoice.placeOfSupply,
    items,
    totals: {
      amount: invoice.amount,
      cgst: invoice.cgst,
      sgst: invoice.sgst,
      igst: invoice.igst,
      total: invoice.total
    },
    signatory: invoice.signatory ?? ANEEVERSE_SIGNATORY,
    notes: invoice.notes,
    payments: Array.isArray(invoice.payments) ? invoice.payments.map((p) => ({ ...p })) : [],
    paidAmount,
    balanceDue,
    bank: bank ?? invoice.bank ?? blankBank()
  }
}

function emptyPartyFallback (): InvoiceParty {
  return { name: '', address: '', gstin: '', pan: '', phone: '' }
}

export function invoicePageHtml (view: InvoiceView): string {
  const intra = isIntraMaharashtra(view.placeOfSupply)
  const taxRows = intra
    ? `<div class="av-totals-row"><span>CGST</span><span>${formatINR(view.totals.cgst)}</span></div>
       <div class="av-totals-row"><span>SGST</span><span>${formatINR(view.totals.sgst)}</span></div>`
    : `<div class="av-totals-row"><span>IGST</span><span>${formatINR(view.totals.igst)}</span></div>`
  const sig = getSignatory(view.signatory)
  const sigHtml = sig.signatureDataUri
    ? `<img class="av-sign-img" src="${sig.signatureDataUri}" alt="${escapeHtml(sig.name)}" />`
    : `<div class="av-sign-name">${escapeHtml(sig.name)}</div>`
  const paidAmount = view.paidAmount ?? 0
  const balanceDue = view.balanceDue ?? Math.max(0, view.totals.total - paidAmount)
  const payments = (view.payments ?? []).filter((p) => (Number(p.amount) || 0) > 0)
  const paymentSummaryRows =
    paidAmount > 0.001
      ? `<div class="av-totals-row av-paid"><span>Amount paid</span><span>${formatINR(paidAmount)}</span></div>
         <div class="av-totals-row av-balance"><span>Balance due</span><span>${formatINR(balanceDue)}</span></div>`
      : ''
  const paymentsHtml =
    payments.length > 0
      ? `<div class="av-payments">
          <div class="av-payments-title">Payments received</div>
          <table class="av-pay-table">
            <thead>
              <tr>
                <th>Date</th>
                <th class="av-num">Amount</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              ${payments
                .slice()
                .sort((a, b) => a.date - b.date)
                .map(
                  (p) => `<tr>
                    <td>${escapeHtml(formatInvoiceDate(p.date))}</td>
                    <td class="av-num">${formatINR(Number(p.amount) || 0)}</td>
                    <td class="av-pay-note">${escapeHtml((p.note ?? '').trim())}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`
      : ''
  const notesHtml =
    view.notes != null && view.notes.trim() !== ''
      ? `<div class="av-notes"><div class="av-notes-title">Notes</div><div>${escapeHtml(view.notes).replace(/\n/g, '<br>')}</div></div>`
      : ''
  return `<section class="av-page">
    <div class="av-header">
      <div>
        <h1 class="av-title">Invoice</h1>
        <div class="av-meta">
          <div><strong>Invoice No #:</strong> ${escapeHtml(view.number)}</div>
          <div><strong>Invoice Date:</strong> ${escapeHtml(formatInvoiceDate(view.invoiceDate))}</div>
          <div><strong>Due Date:</strong> ${escapeHtml(formatInvoiceDate(view.dueDate))}</div>
        </div>
      </div>
      <div class="av-logo">${ANEEVERSE_LOGO_HTML}</div>
    </div>
    <div class="av-parties">
      ${partyHtml('Billed By', view.billedBy)}
      ${partyHtml('Billed To', view.billedTo)}
    </div>
    <div class="av-supply">
      <span><strong>Country of Supply:</strong> ${escapeHtml(view.countryOfSupply)}</span>
      <span><strong>Place of Supply:</strong> ${escapeHtml(view.placeOfSupply)}</span>
    </div>
    ${itemsHtml(view)}
    ${paymentsHtml}
    ${notesHtml}
    <div class="av-footer">
      <div class="av-bank">
        <div class="av-bank-title">Bank Details</div>
        <div>Account Name: ${escapeHtml(view.bank?.accountName ?? '')}</div>
        <div>Account Number: ${escapeHtml(view.bank?.accountNumber ?? '')}</div>
        <div>IFSC: ${escapeHtml(view.bank?.ifsc ?? '')}</div>
        <div>Account Type: ${escapeHtml(view.bank?.accountType ?? '')}</div>
        <div>Bank: ${escapeHtml(view.bank?.bank ?? '')}</div>
      </div>
      <div>
        <div class="av-totals">
          <div class="av-totals-row"><span>Amount</span><span>${formatINR(view.totals.amount)}</span></div>
          ${taxRows}
          <div class="av-totals-row av-grand"><span>Total (INR)</span><span>${formatINR(view.totals.total)}</span></div>
          ${paymentSummaryRows}
        </div>
        <div class="av-sign">
          ${sigHtml}
          <div class="av-sign-line">Authorised Signatory</div>
        </div>
      </div>
    </div>
  </section>`
}

export function invoicesDocumentHtml (views: InvoiceView[], title: string): string {
  const pages = views.map(invoicePageHtml).join('\n')
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="only light" />
  <title>${escapeHtml(title)}</title>
  <style>
    html, body { margin: 0; background: #fff; color-scheme: only light; }
    ${INVOICE_CSS}
  </style>
</head>
<body>
${pages}
</body>
</html>`
}
