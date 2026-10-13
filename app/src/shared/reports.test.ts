import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { goldenTables } from '../data/ledger'
import { GOLDEN_IDS, goldenLedger, summarize } from './calc'
import { ageingBucket, analysisSheet, buildReports, customerStatement, sheetToCsv, workbookBytes } from './reports'

const today = '2026-10-09'

describe('reports', () => {
  it('matches the golden profit and the amount customers owe', () => {
    const reports = buildReports(goldenTables(), { today })
    const summary = summarize(goldenLedger())
    expect(reports.profit.revenueCents).toBe(60500)
    expect(reports.profit.cogsCents).toBe(15500)
    expect(reports.profit.grossProfitCents).toBe(45000)
    expect(reports.profit.expenseCents).toBe(2000)
    expect(reports.profit.netProfitCents).toBe(43000)
    expect(reports.ageing.totalCents).toBe(summary.customersOweCents)
    expect(reports.ageing.totalCents).toBe(30500)
    expect(reports.ageing.rows).toEqual([
      expect.objectContaining({ customerId: GOLDEN_IDS.shopA, totalCents: 17000, buckets: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 17000 } }),
      expect.objectContaining({ customerId: GOLDEN_IDS.shopB, totalCents: 13500, buckets: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 13500 } }),
    ])
  })

  it('splits sales by product, customer, category and month', () => {
    const reports = buildReports(goldenTables(), { today })
    expect(reports.byProduct).toEqual([
      { key: GOLDEN_IDS.c1, label: 'C1 Case', pieces: 95, revenueCents: 47000, profitCents: 37500 },
      { key: GOLDEN_IDS.ch1, label: 'CH1 Charger', pieces: 15, revenueCents: 13500, profitCents: 7500 },
    ])
    expect(reports.byCustomer.map((row) => [row.label, row.revenueCents, row.profitCents])).toEqual([
      ['Shop A', 47000, 37500],
      ['Shop B', 13500, 7500],
    ])
    expect(reports.byCategory).toEqual([
      expect.objectContaining({ label: 'Uncategorised', pieces: 110, revenueCents: 60500, profitCents: 45000 }),
    ])
    expect(reports.byMonth).toEqual([
      expect.objectContaining({ label: '2026-01', revenueCents: 60500, profitCents: 45000 }),
    ])
  })

  it('puts a recent invoice in the current ageing bucket', () => {
    expect(ageingBucket('2026-10-01', today)).toBe('0-30')
    expect(ageingBucket('2026-08-20', today)).toBe('31-60')
    expect(ageingBucket('2026-07-20', today)).toBe('61-90')
  })

  it('builds a shop statement from the oldest open invoice', () => {
    const statement = customerStatement(goldenTables(), GOLDEN_IDS.shopA, today)
    expect(statement.shop).toBe('Shop A')
    expect(statement.invoices).toEqual([
      expect.objectContaining({ totalCents: 47000, paidCents: 30000, openCents: 17000 }),
    ])
    expect(statement.balanceCents).toBe(17000)
    expect(statement.paymentsCents).toBe(30000)
  })

  it('exports sales analysis to a workbook with the same totals', () => {
    const reports = buildReports(goldenTables(), { today })
    const rows = analysisSheet(reports.byProduct, true)
    expect(sheetToCsv(rows)).toContain('C1 Case,95,470,375')
    const book = XLSX.read(workbookBytes('Sales', rows), { type: 'array' })
    const sheet = XLSX.utils.sheet_to_json<(string | number)[]>(book.Sheets.Sales, { header: 1 })
    const total = sheet[sheet.length - 1]
    expect(total).toEqual(['Total', 110, 605, 450])
  })

  it('limits profit to sales inside the chosen dates and compares the previous span', () => {
    const reports = buildReports(goldenTables(), { from: '2026-01-11', to: '2026-01-11', today })
    expect(reports.profit.revenueCents).toBe(13500)
    expect(reports.profit.netProfitCents).toBe(7500)
    expect(reports.previousProfit?.revenueCents).toBe(47000)
    expect(reports.ageing.totalCents).toBe(30500)
  })
})
