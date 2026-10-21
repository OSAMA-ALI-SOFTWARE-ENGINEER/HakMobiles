import { describe, expect, it } from 'vitest'
import { goldenTables } from '../data/ledger'
import { calendarEvents, dashboardView, dayBook, mondayIndex, periodRange } from './dashboard'

describe('dashboard period', () => {
  const view = dashboardView(goldenTables(), 'twelve', '2026-10-12')

  it('keeps the sample figures for the last 12 months', () => {
    expect(periodRange('twelve', '2026-10-12').start).toBe('2025-11-01')
    expect(view.revenueCents).toBe(60500)
    expect(view.netProfitCents).toBe(43000)
    expect(view.marginPercent).toBe(71.1)
    expect(view.customersOweCents).toBe(30500)
    expect(view.suppliersOweCents).toBe(0)
    expect(view.stockValueCents).toBe(2100)
    expect(view.investmentCents).toBe(18000)
    expect(view.expenseCents).toBe(2000)
    expect(view.cashInCents).toBe(30000)
    expect(view.cashOutCents).toBe(20000)
    expect(view.netCashCents).toBe(10000)
    expect(view.previousRevenueCents).toBe(0)
    expect(view.sharesMessage).toBe('')
    expect(view.months).toEqual([{ month: '2026-01', sales: 605, profit: 430, expenses: 20, margin: 71.1 }])
    expect(view.partners.map((partner) => [partner.name, partner.ownsPercent, partner.profitPercent, partner.shareCents])).toEqual([
      ['Dr. Waseem', 20, 20, 8600],
      ['Haseeb', 40, 40, 17200],
      ['Umar', 40, 40, 17200],
    ])
  })

  it('drops January sales from the current month', () => {
    const month = dashboardView(goldenTables(), 'month', '2026-10-12')
    expect(month.revenueCents).toBe(0)
    expect(month.customersOweCents).toBe(30500)
    expect(month.stockValueCents).toBe(2100)
  })

  it('keeps customer balances when a custom range excludes January', () => {
    const custom = dashboardView(goldenTables(), 'custom', '2026-10-12', { start: '2026-10-01', end: '2026-10-12' })
    expect(custom.revenueCents).toBe(0)
    expect(custom.customersOweCents).toBe(30500)
    expect(custom.partners.find((partner) => partner.name === 'Haseeb')?.transferOutCents).toBe(0)
  })

  it('flags partner shares that do not total 100 percent', () => {
    const tables = goldenTables()
    tables.partners[0].share_pct = 10
    expect(dashboardView(tables, 'twelve', '2026-10-12').sharesMessage).toBe('Partner shares must total 100%.')
  })

  it('uses the same sales total for one day as the dashboard', () => {
    const day = dayBook(goldenTables(), '2026-01-10')
    expect(day.salesCents).toBe(47000)
    expect(day.sales.map((sale) => sale.label)).toEqual(['HAK-001 · Shop A'])
    expect(dayBook(goldenTables(), '2026-01-01').purchases.map((row) => row.label)).toEqual(['Purchase · Shenzhen Co'])
    expect(dashboardView(goldenTables(), 'custom', '2026-01-10', { start: '2026-01-10', end: '2026-01-10' }).customersOweCents).toBe(30500)
  })

  it('places a follow-up on its due day and an overdue invoice on its due day', () => {
    const tables = goldenTables()
    tables.follow_ups.push({ id: 'follow', customer_id: tables.customers[0].id, title: 'Call Shop A', due_at: '2026-10-12' })
    const events = calendarEvents(tables, 2026, '2026-10-12')
    expect(events.find((event) => event.date === '2026-10-12')?.label).toContain('Call Shop A')
    expect(events.some((event) => event.date === '2026-02-09')).toBe(true)
    expect(calendarEvents(tables, 2025, '2026-10-12')).toEqual([])
  })

  it('puts sales, purchases, and expenses on the day they happened', () => {
    const events = calendarEvents(goldenTables(), 2026, '2026-10-12')
    expect(events.find((event) => event.date === '2026-01-10')?.kind).toBe('sale')
    expect(events.find((event) => event.date === '2026-01-01')?.kind).toBe('purchase')
    expect(mondayIndex('2025-11-01')).toBe(5)
    expect(mondayIndex('2026-10-01')).toBe(3)
    expect(mondayIndex('2026-10-22')).toBe(3)
  })
})
