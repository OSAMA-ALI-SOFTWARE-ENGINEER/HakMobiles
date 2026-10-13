import { summarizeTables, type LocalTables } from '../data/ledger'
import { purchaseLedgerRows } from './purchases'
import { OVERDUE_DAYS, invoiceStandings } from './payments'

export type DashboardPeriod = 'week' | 'month' | 'quarter' | 'year' | 'twelve' | 'custom'

function addDays(date: string, days: number): string {
  const value = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function periodRange(period: DashboardPeriod, today: string): { start: string; end: string } {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  if (period === 'week') {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay()
    const mondayOffset = weekday === 0 ? 6 : weekday - 1
    return { start: addDays(today, -mondayOffset), end: today }
  }
  if (period === 'month') return { start: `${today.slice(0, 7)}-01`, end: today }
  if (period === 'quarter') {
    const startMonth = Math.floor((month - 1) / 3) * 3 + 1
    return { start: `${year}-${String(startMonth).padStart(2, '0')}-01`, end: today }
  }
  if (period === 'year') return { start: `${year}-01-01`, end: today }
  const start = new Date(Date.UTC(year, month - 1 - 11, 1)).toISOString().slice(0, 10)
  return { start, end: today }
}

export function clampRange(start: string, end: string): { start: string; end: string } {
  let from = start.slice(0, 10)
  let to = end.slice(0, 10)
  if (from > to) [from, to] = [to, from]
  const earliest = addDays(to, -365)
  if (from < earliest) from = earliest
  return { start: from, end: to }
}

function previousRange(start: string, end: string): { start: string; end: string } {
  const length = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1
  const prevEnd = addDays(start, -1)
  return { start: addDays(prevEnd, -(length - 1)), end: prevEnd }
}

function inRange(date: string, start: string, end: string) {
  const day = date.slice(0, 10)
  return day !== '' && day >= start && day <= end
}

function periodTables(tables: LocalTables, start: string, end: string, includeUndated: boolean): LocalTables {
  return {
    ...tables,
    sales: tables.sales.filter((sale) => inRange(String(sale.date ?? ''), start, end)),
    expenses: tables.expenses.filter((expense) => {
      const date = String(expense.created_at ?? '').slice(0, 10)
      if (date === '') return includeUndated
      return inRange(date, start, end)
    }),
    customer_payments: tables.customer_payments.filter((payment) => includeMoney(payment, start, end, includeUndated)),
    supplier_payments: tables.supplier_payments.filter((payment) => includeMoney(payment, start, end, includeUndated)),
  }
}

function includeMoney(row: Record<string, unknown>, start: string, end: string, includeUndated: boolean) {
  const date = String(row.created_at ?? '').slice(0, 10)
  if (date === '') return includeUndated
  return inRange(date, start, end)
}

export function investmentCents(tables: LocalTables): number {
  return purchaseLedgerRows({ purchases: tables.purchases, lines: tables.purchase_lines })
    .reduce((sum, line) => sum + line.qty * line.unitCostCents, 0)
}

export function monthBars(tables: LocalTables, start: string, end: string): { month: string; sales: number; profit: number; expenses: number; margin: number }[] {
  const months = [...new Set(tables.sales.map((sale) => String(sale.date ?? '').slice(0, 7)).filter((month) => month >= start.slice(0, 7) && month <= end.slice(0, 7)))].sort()
  const undated = tables.expenses.filter((expense) => String(expense.created_at ?? '').slice(0, 10) === '')
  const last = months.at(-1)
  const rows = months.map((month) => {
    const scoped = periodTables(tables, `${month}-01`, `${month}-31`, false)
    if (month === last) scoped.expenses = [...scoped.expenses, ...undated]
    const summary = summarizeTables(scoped)
    return { month, sales: summary.revenueCents / 100, profit: summary.netProfitCents / 100, expenses: summary.expenseCents / 100, margin: summary.marginPercent }
  })
  return rows.length > 0 ? rows : [{ month: 'No sales yet', sales: 0, profit: 0, expenses: 0, margin: 0 }]
}

export function dashboardView(tables: LocalTables, period: DashboardPeriod, today: string, custom?: { start: string; end: string }) {
  const includeUndated = period !== 'custom'
  const range = period === 'custom' && custom ? clampRange(custom.start, custom.end) : periodRange(period, today)
  const full = summarizeTables(tables)
  const periodSummary = summarizeTables(periodTables(tables, range.start, range.end, includeUndated))
  const earlier = previousRange(range.start, range.end)
  const previousSummary = summarizeTables(periodTables(tables, earlier.start, earlier.end, false))
  const owns = new Map(tables.partners.map((partner) => [String(partner.id), Number(partner.share_pct)]))
  const shareTotal = [...owns.values()].reduce((sum, value) => sum + value, 0)
  const cashInCents = tables.customer_payments.filter((payment) => includeMoney(payment, range.start, range.end, includeUndated)).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
  const supplierOutCents = tables.supplier_payments.filter((payment) => includeMoney(payment, range.start, range.end, includeUndated)).reduce((sum, payment) => sum + Number(payment.amount_eur ?? payment.amount ?? 0), 0)
  return {
    range,
    revenueCents: periodSummary.revenueCents,
    netProfitCents: periodSummary.netProfitCents,
    marginPercent: periodSummary.marginPercent,
    expenseCents: periodSummary.expenseCents,
    cashInCents,
    cashOutCents: supplierOutCents + periodSummary.expenseCents,
    netCashCents: cashInCents - supplierOutCents - periodSummary.expenseCents,
    previousRevenueCents: previousSummary.revenueCents,
    previousNetProfitCents: previousSummary.netProfitCents,
    customersOweCents: full.customersOweCents,
    suppliersOweCents: full.suppliersOweCents,
    stockValueCents: full.stockValueCents,
    investmentCents: investmentCents(tables),
    stock: full.stock,
    whoOwesWhom: full.whoOwesWhom,
    sharesMessage: Math.abs(shareTotal - 100) < 0.05 ? '' : 'Partner shares must total 100%.',
    partners: full.partnerBalances.map((partner) => {
      const share = periodSummary.partnerBalances.find((row) => row.id === partner.id)
      const shareCents = share?.shareCents ?? 0
      const profitPercent = periodSummary.netProfitCents === 0 ? 0 : Math.round((shareCents / periodSummary.netProfitCents) * 1000) / 10
      let transferInCents = 0
      let transferOutCents = 0
      for (const row of tables.partner_transfers) {
        const date = String(row.created_at ?? '').slice(0, 10)
        if (date !== '' && !inRange(date, range.start, range.end)) continue
        if (date === '' && !includeUndated) continue
        const amount = Number(row.amount ?? 0)
        if (row.to_partner === partner.id) transferInCents += amount
        if (row.from_partner === partner.id) transferOutCents += amount
      }
      return {
        ...partner,
        shareCents,
        ownsPercent: owns.get(partner.id) ?? 0,
        profitPercent,
        transferInCents,
        transferOutCents,
      }
    }),
    months: monthBars(tables, range.start, range.end),
  }
}

export function dueOn(saleDate: string, days = OVERDUE_DAYS): string {
  const due = new Date(`${saleDate.slice(0, 10)}T00:00:00Z`)
  due.setUTCDate(due.getUTCDate() + days)
  return due.toISOString().slice(0, 10)
}

export function calendarEvents(tables: LocalTables, year: number, today: string): { date: string; label: string; href: string }[] {
  const events: { date: string; label: string; href: string }[] = []
  for (const row of tables.follow_ups) {
    const date = String(row.due_at ?? '').slice(0, 10)
    if (!date.startsWith(String(year))) continue
    const shop = tables.customers.find((customer) => customer.id === row.customer_id)
    events.push({ date, label: String(row.title ?? 'Follow-up'), href: `/customers/${String(row.customer_id)}` })
    if (shop) events[events.length - 1].label = `${String(row.title ?? 'Follow-up')} · ${String(shop.shop_name)}`
  }
  const standings = invoiceStandings({
    sales: tables.sales.map((row) => ({ id: String(row.id), invoice_no: String(row.invoice_no ?? ''), customer_id: String(row.customer_id), date: row.date == null ? null : String(row.date) })),
    lines: tables.sale_lines.map((row) => ({ sale_id: String(row.sale_id), qty: Number(row.qty), unit_price: Number(row.unit_price), discount: Number(row.discount ?? 0) })),
    allocations: tables.payment_allocations.map((row) => ({ sale_id: String(row.sale_id), amount: Number(row.amount) })),
    today,
  })
  for (const invoice of standings) {
    if (!invoice.overdue) continue
    const date = dueOn(invoice.date)
    if (!date.startsWith(String(year))) continue
    const shop = tables.customers.find((customer) => customer.id === invoice.customerId)
    events.push({ date, label: `${invoice.invoiceNo} · ${String(shop?.shop_name ?? 'Unknown shop')}`, href: `/customers/${invoice.customerId}` })
  }
  return events.sort((left, right) => left.date.localeCompare(right.date) || left.label.localeCompare(right.label))
}

export function backupName(today: string): string {
  return `hak-backup-${today.slice(0, 7)}.xlsx`
}

export function dayBook(tables: LocalTables, date: string) {
  const day = date.slice(0, 10)
  const onDay = (value: unknown) => String(value ?? '').slice(0, 10) === day
  const shop = (id: unknown) => String(tables.customers.find((row) => row.id === id)?.shop_name ?? 'Unknown shop')
  const partner = (id: unknown) => String(tables.partners.find((row) => row.id === id)?.name ?? 'Partner')
  return {
    salesCents: dashboardView(tables, 'custom', day, { start: day, end: day }).revenueCents,
    sales: tables.sales.filter((row) => onDay(row.date)).map((row) => ({ id: String(row.id), label: `${row.invoice_no} · ${shop(row.customer_id)}`, href: `/customers/${String(row.customer_id)}` })),
    expenses: tables.expenses.filter((row) => onDay(row.created_at)).map((row) => ({ id: String(row.id), label: `${row.category} · ${partner(row.paid_by)}` })),
    customerPayments: tables.customer_payments.filter((row) => onDay(row.created_at)).map((row) => ({ id: String(row.id), label: `${shop(row.customer_id)} · ${partner(row.received_by)}` })),
    supplierPayments: tables.supplier_payments.filter((row) => onDay(row.created_at)).map((row) => ({ id: String(row.id), label: `${String(tables.suppliers.find((item) => item.id === row.supplier_id)?.name ?? 'Supplier')} · ${partner(row.paid_by)}` })),
    followUps: tables.follow_ups.filter((row) => onDay(row.due_at)).map((row) => ({ id: String(row.id), label: String(row.title ?? 'Follow-up'), href: `/customers/${String(row.customer_id)}` })),
  }
}