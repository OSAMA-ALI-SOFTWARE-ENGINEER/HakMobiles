import { describe, expect, it } from 'vitest'
import { followUpBucket, shopFigures, stageAfterOrders } from './crm'

describe('pipeline and follow-ups', () => {
  it('moves a shop when orders arrive', () => {
    expect(stageAfterOrders(0, 'contacted')).toBe('contacted')
    expect(stageAfterOrders(1, 'lead')).toBe('first_order')
    expect(stageAfterOrders(2, 'first_order')).toBe('active')
    expect(stageAfterOrders(3, 'inactive')).toBe('active')
  })

  it('sorts follow-ups into today, overdue, upcoming and done', () => {
    expect(followUpBucket('2026-10-09T10:00', null, '2026-10-09')).toBe('Today')
    expect(followUpBucket('2026-10-08', null, '2026-10-09')).toBe('Overdue')
    expect(followUpBucket('2026-10-10', null, '2026-10-09')).toBe('Upcoming')
    expect(followUpBucket('2026-10-08', '2026-10-09T12:00', '2026-10-09')).toBe('Done')
  })

  it('calculates what a shop bought, paid and owes', () => {
    const figures = shopFigures({
      customerId: 'shop',
      sales: [{ id: 'sale', customer_id: 'shop', date: '2026-10-01' }],
      lines: [{ sale_id: 'sale', qty: 2, unit_price: 500, discount: 100 }],
      payments: [{ customer_id: 'shop', amount: 400 }],
    })
    expect(figures).toMatchObject({ boughtCents: 900, paidCents: 400, owedCents: 500, orders: 1, lastOrder: '2026-10-01' })
  })
})
