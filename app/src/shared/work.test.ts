import { describe, expect, it } from 'vitest'
import {
  dueWithin,
  isMonthLocked,
  nifProblems,
  paymentReminderDrafts,
  priceForShop,
  recurringDue,
  reorderSuggestion,
  settleTransfers,
  shopsToMarkInactive,
  slowProductIds,
} from './work'

describe('module gaps', () => {
  it('proposes the fewest transfers that clear partner balances', () => {
    const moves = settleTransfers([
      { id: 'w', name: 'Dr. Waseem', balanceCents: 4000 },
      { id: 'h', name: 'Haseeb', balanceCents: -13000 },
      { id: 'u', name: 'Umar', balanceCents: 9000 },
    ])
    expect(moves).toEqual([
      { fromId: 'h', toId: 'u', fromName: 'Haseeb', toName: 'Umar', amountCents: 9000 },
      { fromId: 'h', toId: 'w', fromName: 'Haseeb', toName: 'Dr. Waseem', amountCents: 4000 },
    ])
  })

  it('suggests a reorder from the last 30 days of sales', () => {
    expect(reorderSuggestion(10, 4, 2)).toBe(9)
    expect(reorderSuggestion(0, 5, 0)).toBe(0)
  })

  it('marks a shop inactive only after its last order is past the limit', () => {
    const ids = shopsToMarkInactive([
      { id: 'old', status: 'active', lastOrder: '2026-01-01' },
      { id: 'new', status: 'active', lastOrder: '2026-10-01' },
      { id: 'lead', status: 'lead', lastOrder: '' },
    ], '2026-10-27', 60)
    expect(ids).toEqual(['old'])
  })

  it('creates one payment reminder per overdue invoice', () => {
    const first = paymentReminderDrafts({
      invoices: [{ id: 's1', customerId: 'c1', invoiceNo: 'HAS1-0001', overdue: true }],
      followUps: [],
    })
    expect(first).toEqual([{ customerId: 'c1', title: 'Payment reminder · HAS1-0001', autoReason: 'overdue:s1' }])
    expect(paymentReminderDrafts({
      invoices: [{ id: 's1', customerId: 'c1', invoiceNo: 'HAS1-0001', overdue: true }],
      followUps: [{ autoReason: 'overdue:s1' }],
    })).toEqual([])
  })

  it('uses a shop special price when one is set', () => {
    expect(priceForShop(1000, [{ customerId: 'c', productId: 'p', cents: 800 }], 'c', 'p')).toBe(800)
    expect(priceForShop(1000, [], 'c', 'p')).toBe(1000)
  })

  it('keeps a read lock on a closed month and flags a bad NIF', () => {
    expect(isMonthLocked('2026-09-14', ['2026-09'])).toBe(true)
    expect(isMonthLocked('2026-10-14', ['2026-09'])).toBe(false)
    expect(nifProblems([{ shop: 'Loja', nif: '123456789' }, { shop: 'Bad', nif: '123456788' }])).toEqual([{ shop: 'Bad', nif: '123456788' }])
  })

  it('offers a monthly cost again in the next month and lists slow stock', () => {
    expect(recurringDue([{ id: 'rent', category: 'Rent', amountCents: 50000, paidBy: 'h', confirmedMonth: '2026-09' }], '2026-10')).toHaveLength(1)
    expect(dueWithin('2026-10-30', '2026-10-27', 7)).toBe(true)
    expect(slowProductIds([{ productId: 'p', lastSale: '2026-01-01', onHand: 3 }], '2026-10-27')).toEqual(['p'])
  })
})