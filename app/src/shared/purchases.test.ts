import { describe, expect, it } from 'vitest'
import { summarize } from './calc'
import { fxToEurCents, weightedAverageCost } from './money'
import { landedUnitCosts, onOrderQty, purchaseLedgerRows, purchaseStatus, supplierMoney, supplierPosition } from './purchases'

describe('purchases', () => {
  it('spreads shipping across the pieces and averages later receipts', () => {
    expect(landedUnitCosts([{ qty: 100, unitCostCents: 100 }], 2000, 'quantity')).toEqual([120])
    expect(landedUnitCosts([
      { qty: 60, unitCostCents: 100 },
      { qty: 40, unitCostCents: 200 },
    ], 1000, 'quantity')).toEqual([110, 210])
    expect(landedUnitCosts([
      { qty: 60, unitCostCents: 100 },
      { qty: 40, unitCostCents: 200 },
    ], 1400, 'value')).toEqual([110, 220])
    expect(weightedAverageCost(100, 100, 100, 120)).toBe(110)
  })

  it('puts only received pieces into stock and keeps the rest on order', () => {
    expect(purchaseStatus(100, 0)).toBe('Ordered')
    expect(purchaseStatus(100, 60)).toBe('Partly received')
    expect(purchaseStatus(100, 100)).toBe('Received')
    expect(onOrderQty(100, 60)).toBe(40)
    const summary = summarize({
      defaultAlert: 10,
      products: [{ id: 'p', code: 'P', name: 'Piece', alertLevel: 10 }],
      purchases: [{ supplierId: 's', productId: 'p', qty: 100, receivedQty: 60, unitCostCents: 120 }],
      adjustments: [],
      sales: [],
      customerPayments: [],
      supplierPayments: [],
      expenses: [],
      transfers: [],
      partners: [],
    })
    expect(summary.stock[0]).toMatchObject({ qty: 60, valueCents: 7200 })
    expect(summary.suppliersOweCents).toBe(12000)
  })

  it('converts the supplier currency and clears the balance when it is paid', () => {
    expect(fxToEurCents(10800, 1.08)).toBe(10000)
    expect(supplierPosition(18000, 18000).owedCents).toBe(0)
    const rows = purchaseLedgerRows({
      purchases: [{ id: 'buy', supplier_id: 's', extra_cost: 2000 }],
      lines: [{ purchase_id: 'buy', product_id: 'p', qty: 100, qty_received: 60, unit_cost: 100 }],
    })
    expect(rows[0].unitCostCents).toBe(120)
    expect(rows[0].receivedQty).toBe(60)
    expect(supplierMoney({
      supplierId: 's',
      purchases: [{ id: 'buy', supplier_id: 's', extra_cost: 0 }],
      lines: [{ purchase_id: 'buy', product_id: 'p', qty: 180, unit_cost: 100 }],
      payments: [{ supplier_id: 's', amount_eur: 18000 }],
    }).owedCents).toBe(0)
  })
})