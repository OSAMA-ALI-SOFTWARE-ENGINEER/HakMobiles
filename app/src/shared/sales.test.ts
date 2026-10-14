import { describe, expect, it } from 'vitest'
import { creditWarningText, isRepeatSale, nextInvoiceNumber, saleEditGate, saleTotalCents, stockWarningText } from './sales'

describe('multi-line sales', () => {
  it('totals every line and warns without turning the warning into a block', () => {
    const total = saleTotalCents([
      { productId: 'a', qty: 2, unitPriceCents: 4000, discountCents: 0 },
      { productId: 'a', qty: 1, unitPriceCents: 500, discountCents: 0 },
    ])
    expect(total).toBe(8500)
    expect(stockWarningText([
      { productId: 'a', name: 'Line item', qty: 2, onHand: 0 },
      { productId: 'a', name: 'Line item', qty: 1, onHand: 0 },
    ])).toBe('Stock warning: Line item has 0 in stock and this sale asks for 3.')
    expect(creditWarningText(0, total, 5000)).toContain('above the € 50,00 credit limit')
    expect(creditWarningText(0, total, null)).toBe('')
  })

  it('continues the invoice number past one this device already has', () => {
    expect(nextInvoiceNumber('HAS1', 0, ['HAS1-0001', 'UMR1-0009'])).toBe(2)
    expect(nextInvoiceNumber('HAS1', 4, ['HAS1-0001'])).toBe(5)
  })

  it('asks before saving the same lines again within two minutes', () => {
    const lines = [{ productId: 'a', qty: 1, unitPriceCents: 800, discountCents: 0 }]
    const existing = [{ id: 'sale-1', customerId: 'shop', createdAt: '2026-10-09T10:00:00.000Z', lines }]
    expect(isRepeatSale({ customerId: 'shop', lines, existing, now: Date.parse('2026-10-09T10:01:00.000Z') })).toBe(true)
    expect(isRepeatSale({ customerId: 'shop', lines, existing, now: Date.parse('2026-10-09T10:03:00.000Z') })).toBe(false)
    expect(isRepeatSale({ customerId: 'shop', lines, existing, now: Date.parse('2026-10-09T10:01:00.000Z'), ignoreSaleId: 'sale-1' })).toBe(false)
  })

  it('lets a salesperson edit only their own sale from today, and asks for a reason on older sales', () => {
    const ownToday = saleEditGate({
      isSuperAdmin: false,
      canManageSales: false,
      canEditOwn: true,
      sellerId: 'seller',
      currentUserId: 'seller',
      saleDate: '2026-10-09',
      today: '2026-10-09',
      reason: '',
    })
    expect(ownToday.canSave).toBe(true)
    expect(ownToday.needsReason).toBe(false)

    const ownYesterday = saleEditGate({
      isSuperAdmin: false,
      canManageSales: false,
      canEditOwn: true,
      sellerId: 'seller',
      currentUserId: 'seller',
      saleDate: '2026-10-08',
      today: '2026-10-09',
      reason: 'Price was wrong',
    })
    expect(ownYesterday.canOpen).toBe(false)

    const older = saleEditGate({
      isSuperAdmin: true,
      canManageSales: false,
      canEditOwn: false,
      sellerId: 'seller',
      currentUserId: 'admin',
      saleDate: '2026-10-08',
      today: '2026-10-09',
      reason: '',
    })
    expect(older.canOpen).toBe(true)
    expect(older.canSave).toBe(false)
    expect(older.message).toBe('A reason is required for a sale from before today.')
    expect(saleEditGate({ ...older, reason: 'Price was wrong', saleDate: '2026-10-08', today: '2026-10-09', isSuperAdmin: true, canManageSales: false, canEditOwn: false, sellerId: 'seller', currentUserId: 'admin' }).canSave).toBe(true)
  })
})
