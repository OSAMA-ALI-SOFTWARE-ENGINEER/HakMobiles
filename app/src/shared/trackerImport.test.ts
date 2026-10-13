import { describe, expect, it } from 'vitest'
import { goldenTables, summarizeTables } from '../data/ledger'
import { goldenTrackerWorkbook, tablesFromWorkbook, tablesToWorkbook } from './trackerImport'

describe('tracker import', () => {
  it('turns the golden workbook into the tracker totals', () => {
    const tables = tablesFromWorkbook(goldenTrackerWorkbook())
    const summary = summarizeTables(tables)
    expect(summary.revenueCents).toBe(60500)
    expect(summary.cogsCents).toBe(15500)
    expect(summary.netProfitCents).toBe(43000)
    expect(summary.customersOweCents).toBe(30500)
    expect(summary.suppliersOweCents).toBe(0)
    expect(summary.stockValueCents).toBe(2100)
  })

  it('uses the same id for a row each time the file is imported', () => {
    const bytes = goldenTrackerWorkbook()
    const first = tablesFromWorkbook(bytes)
    const second = tablesFromWorkbook(bytes)
    expect(second.products.map((row) => row.id)).toEqual(first.products.map((row) => row.id))
    expect(second.sales.map((row) => row.id)).toEqual(first.sales.map((row) => row.id))
    expect(new Set(first.products.map((row) => row.id)).size).toBe(2)
  })

  it('exports the live tables in the shape the import reads', () => {
    const summary = summarizeTables(tablesFromWorkbook(tablesToWorkbook(goldenTables())))
    expect(summary.revenueCents).toBe(60500)
    expect(summary.netProfitCents).toBe(43000)
    expect(summary.stockValueCents).toBe(2100)
  })
})
