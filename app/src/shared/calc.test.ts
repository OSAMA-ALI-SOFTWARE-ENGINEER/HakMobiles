import { describe, expect, it } from 'vitest'
import { fxToEurCents, weightedAverageCost } from './money'
import {
  allocateOldest,
  frozenSaleProfit,
  GOLDEN_IDS,
  goldenLedger,
  invoiceStatus,
  stockQty,
  stockStatus,
  summarize,
} from './calc'

describe('stock and money', () => {
  it('calculates stock from the ledger', () => {
    expect(stockQty(100, 95, -1)).toBe(4)
  })

  it('marks stock status from the alert level', () => {
    expect(stockStatus(-1, 10)).toBe('CHECK')
    expect(stockStatus(0, 10)).toBe('OUT')
    expect(stockStatus(10, 10)).toBe('LOW')
    expect(stockStatus(11, 10)).toBe('OK')
  })

  it('averages purchase cost by quantity', () => {
    expect(weightedAverageCost(100, 100, 100, 120)).toBe(110)
  })

  it('converts foreign currency to euros', () => {
    expect(fxToEurCents(10800, 1.08)).toBe(10000)
  })

  it('keeps an old sale profit when a later purchase changes the average', () => {
    const profit = frozenSaleProfit(100, 95, 500, 500)
    const laterAverage = weightedAverageCost(5, 100, 100, 200)
    expect(profit).toBe(47000 - 9500)
    expect(laterAverage).not.toBe(100)
    expect(frozenSaleProfit(100, 95, 500, 500)).toBe(profit)

    const ledger = goldenLedger()
    const laterPurchase = { supplierId: GOLDEN_IDS.shenzhen, productId: GOLDEN_IDS.c1, qty: 100, unitCostCents: 500 }
    const frozen = summarize({
      ...ledger,
      purchases: [...ledger.purchases, laterPurchase],
      sales: ledger.sales.map((sale) => ({
        ...sale,
        lines: sale.lines.map((line) => ({
          ...line,
          unitCostAtSaleCents: line.productId === GOLDEN_IDS.c1 ? 100 : 400,
        })),
      })),
    })
    const repriced = summarize({ ...ledger, purchases: [...ledger.purchases, laterPurchase] })
    expect(frozen.cogsCents).toBe(15500)
    expect(repriced.cogsCents).not.toBe(15500)
  })
})

describe('payments', () => {
  it('fills the oldest invoice first', () => {
    const allocations = allocateOldest(
      [
        { id: 'a', date: '2026-01-01', totalCents: 20000 },
        { id: 'b', date: '2026-01-02', totalCents: 27000 },
      ],
      30000,
    )
    expect(allocations).toEqual([
      { saleId: 'a', amountCents: 20000 },
      { saleId: 'b', amountCents: 10000 },
    ])
    expect(invoiceStatus(20000, 20000)).toBe('Paid')
    expect(invoiceStatus(27000, 10000)).toBe('Part-paid')
    expect(27000 - 10000).toBe(17000)
  })
})

describe('golden sample', () => {
  const summary = summarize(goldenLedger())

  it('matches the excel tracker to the cent', () => {
    expect(summary.revenueCents).toBe(60500)
    expect(summary.cogsCents).toBe(15500)
    expect(summary.grossProfitCents).toBe(45000)
    expect(summary.netProfitCents).toBe(43000)
    expect(summary.marginPercent).toBe(71.1)
    expect(summary.customersOweCents).toBe(30500)
    expect(summary.suppliersOweCents).toBe(0)
    expect(summary.stockValueCents).toBe(2100)
    expect(summary.stock).toEqual([
      { code: 'C1', qty: 5, status: 'LOW', valueCents: 500 },
      { code: 'CH1', qty: 4, status: 'OK', valueCents: 1600 },
    ])
    expect(summary.partnerBalances.map((partner) => partner.balanceCents)).toEqual([4000, -13000, 9000])
    expect(summary.partnerBalances.map((partner) => partner.shareCents)).toEqual([8600, 17200, 17200])
  })
})
