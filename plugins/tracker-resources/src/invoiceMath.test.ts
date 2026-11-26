import { AccountRole } from '@hcengineering/core'
import { invoicesForAccount, formatInvoiceNumber } from './aneeverseBilling'
import { cashBook, cashTargetProgress, computeTotals, invoiceBalance, invoiceStatus } from './invoiceMath'

const line = { title: 'Site', hsn: '998314', gstRate: 18, quantity: 1, rate: 1000 }

describe('invoice tax', () => {
  it('splits Maharashtra tax into CGST and SGST', () => {
    const totals = computeTotals([line], 'Maharashtra (27)')
    expect(totals.amount).toBe(1000)
    expect(totals.cgst).toBe(90)
    expect(totals.sgst).toBe(90)
    expect(totals.igst).toBe(0)
    expect(totals.total).toBe(1180)
  })

  it('uses IGST outside Maharashtra', () => {
    const totals = computeTotals([line], 'Karnataka (29)')
    expect(totals.cgst).toBe(0)
    expect(totals.sgst).toBe(0)
    expect(totals.igst).toBe(180)
    expect(totals.total).toBe(1180)
  })
})

describe('invoice payments', () => {
  const now = Date.parse('2026-11-26T00:00:00Z')

  it('keeps the unpaid balance', () => {
    const invoice = {
      total: 1180,
      dueDate: now + 86_400_000,
      payments: [{ date: now, amount: 500 }]
    }
    expect(invoiceBalance(invoice)).toBe(680)
    expect(invoiceStatus(invoice, now)).toBe('partial')
  })

  it('marks an unpaid invoice overdue after the due date', () => {
    const invoice = { total: 1180, dueDate: now - 1000, payments: [] as { date: number, amount: number }[] }
    expect(invoiceStatus(invoice, now)).toBe('overdue')
  })
})

describe('invoice numbers', () => {
  it('gives two saves different AV numbers', () => {
    expect(formatInvoiceNumber(1)).toBe('AV000001')
    expect(formatInvoiceNumber(2)).toBe('AV000002')
    expect(formatInvoiceNumber(1)).not.toBe(formatInvoiceNumber(2))
  })
})

describe('guest invoices', () => {
  it('returns nothing for a guest', () => {
    const rows = [{ number: 'AV000001' }]
    expect(invoicesForAccount(AccountRole.Guest, rows)).toEqual([])
    expect(invoicesForAccount(AccountRole.ReadOnlyGuest, rows)).toEqual([])
    expect(invoicesForAccount(AccountRole.User, rows)).toEqual(rows)
  })
})

describe('cash book', () => {
  it('subtracts expenses from receipts and tracks the 60k target', () => {
    const book = cashBook(7500, [
      { amount: 2000, category: 'software' },
      { amount: 500, category: 'travel' }
    ])
    expect(book.net).toBe(5000)
    expect(cashTargetProgress(7500).remaining).toBe(52500)
  })
})
