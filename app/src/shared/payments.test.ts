import { describe, expect, it } from 'vitest'
import { allocationsForPayment, allocationsFromCredit, invoiceStandings, isOverdue, paymentCredit } from './payments'

describe('invoice payments', () => {
  const sales = [
    { id: 'old', invoice_no: 'A-0001', customer_id: 'shop', date: '2026-08-01' },
    { id: 'new', invoice_no: 'A-0002', customer_id: 'shop', date: '2026-10-01' },
  ]
  const lines = [
    { sale_id: 'old', qty: 1, unit_price: 20000, discount: 0 },
    { sale_id: 'new', qty: 1, unit_price: 27000, discount: 0 },
  ]

  it('marks the oldest invoice paid and the next part-paid', () => {
    const allocations = allocationsForPayment(
      [
        { id: 'old', date: '2026-08-01', remainingCents: 20000 },
        { id: 'new', date: '2026-10-01', remainingCents: 27000 },
      ],
      30000,
    )
    const standings = invoiceStandings({
      sales,
      lines,
      allocations: allocations.map((row) => ({ sale_id: row.saleId, amount: row.amountCents })),
      today: '2026-10-09',
    })
    expect(standings.find((row) => row.id === 'old')).toMatchObject({ status: 'Paid', paidCents: 20000, overdue: false })
    expect(standings.find((row) => row.id === 'new')).toMatchObject({ status: 'Part-paid', paidCents: 10000 })
    expect(27000 - 10000).toBe(17000)
  })

  it('lists an unpaid invoice after 31 days as overdue', () => {
    expect(isOverdue('2026-09-08', 'Unpaid', '2026-10-09')).toBe(true)
    expect(isOverdue('2026-09-09', 'Unpaid', '2026-10-09')).toBe(false)
    const [invoice] = invoiceStandings({ sales: [sales[0]], lines: [lines[0]], allocations: [], today: '2026-10-09' })
    expect(invoice.overdue).toBe(true)
    expect(invoice.status).toBe('Unpaid')
  })

  it('keeps overpayment as credit and applies it to the next invoice', () => {
    const credit = paymentCredit({
      customerId: 'shop',
      payments: [{ id: 'pay', customer_id: 'shop', amount: 50000, created_at: '2026-10-01' }],
      allocations: [{ customer_payment_id: 'pay', amount: 45000 }],
    })
    expect(credit).toEqual([{ id: 'pay', createdAt: '2026-10-01', leftoverCents: 5000 }])
    expect(allocationsFromCredit(credit, 'next', 10000)).toEqual([
      { customerPaymentId: 'pay', saleId: 'next', amountCents: 5000 },
    ])
  })
})
