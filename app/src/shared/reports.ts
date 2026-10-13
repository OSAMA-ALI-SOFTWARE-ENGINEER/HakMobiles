import * as XLSX from 'xlsx'
import { ledgerFromTables, type LocalTables } from '../data/ledger'
import { lineRevenue, summarize, type LedgerInput, type SaleInput, type Summary } from './calc'
import { centsToEuros, weightedAverageCost, type Cents } from './money'
import { whatsAppLink } from './nif'

export type AgeingBucket = '0-30' | '31-60' | '61-90' | '90+'

export const AGEING_BUCKETS: AgeingBucket[] = ['0-30', '31-60', '61-90', '90+']

export interface SalesGroup {
  key: string
  label: string
  pieces: number
  revenueCents: Cents
  profitCents: Cents
}

export interface AgeingRow {
  customerId: string
  shop: string
  buckets: Record<AgeingBucket, Cents>
  totalCents: Cents
}

export interface CustomerStatement {
  shop: string
  phone: string
  email: string
  invoices: { invoiceNo: string; date: string; totalCents: Cents; paidCents: Cents; openCents: Cents }[]
  paymentsCents: Cents
  balanceCents: Cents
}

export interface BuiltReports {
  profit: Summary
  previousProfit: Summary | null
  byProduct: SalesGroup[]
  byCustomer: SalesGroup[]
  byCategory: SalesGroup[]
  byMonth: SalesGroup[]
  ageing: { rows: AgeingRow[]; totalCents: Cents }
}

function inRange(date: string, from: string, to: string): boolean {
  if (!from && !to) return true
  if (!date) return false
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function previousRange(from: string, to: string): { from: string; to: string } | null {
  if (!from || !to || from > to) return null
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  const span = end - start
  const previousEnd = start - 86_400_000
  const previousStart = previousEnd - span
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  return { from: iso(previousStart), to: iso(previousEnd) }
}

function averages(purchases: LedgerInput['purchases']): Map<string, Cents> {
  const qty = new Map<string, number>()
  const average = new Map<string, Cents>()
  for (const purchase of purchases) {
    const received = purchase.receivedQty == null ? purchase.qty : purchase.receivedQty
    const oldQty = qty.get(purchase.productId) ?? 0
    average.set(purchase.productId, weightedAverageCost(oldQty, average.get(purchase.productId) ?? 0, received, purchase.unitCostCents))
    qty.set(purchase.productId, oldQty + received)
  }
  return average
}

function saleTotal(sale: SaleInput): Cents {
  return sale.lines.reduce((total, line) => total + lineRevenue(line.qty, line.unitPriceCents, line.discountCents), 0)
}

function groupSales(
  sales: SaleInput[],
  costs: Map<string, Cents>,
  keyOf: (sale: SaleInput, line: SaleInput['lines'][number]) => { key: string; label: string },
): SalesGroup[] {
  const groups = new Map<string, SalesGroup>()
  for (const sale of sales) {
    for (const line of sale.lines) {
      const { key, label } = keyOf(sale, line)
      const current = groups.get(key) ?? { key, label, pieces: 0, revenueCents: 0, profitCents: 0 }
      const revenue = lineRevenue(line.qty, line.unitPriceCents, line.discountCents)
      const costEach = line.unitCostAtSaleCents == null ? (costs.get(line.productId) ?? 0) : line.unitCostAtSaleCents
      current.pieces += line.qty
      current.revenueCents += revenue
      current.profitCents += revenue - line.qty * costEach
      current.label = label
      groups.set(key, current)
    }
  }
  return [...groups.values()].sort((a, b) => b.revenueCents - a.revenueCents || a.label.localeCompare(b.label))
}

export function ageingBucket(invoiceDate: string, today: string): AgeingBucket {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return '90+'
  const days = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${invoiceDate}T00:00:00Z`)) / 86_400_000)
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

function emptyBuckets(): Record<AgeingBucket, Cents> {
  return { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
}

export function customerAgeing(ledger: LedgerInput, today: string): { rows: AgeingRow[]; totalCents: Cents } {
  const paid = new Map<string, Cents>()
  for (const payment of ledger.customerPayments) paid.set(payment.customerId, (paid.get(payment.customerId) ?? 0) + payment.amountCents)
  const byCustomer = new Map<string, SaleInput[]>()
  for (const sale of ledger.sales) {
    const rows = byCustomer.get(sale.customerId) ?? []
    rows.push(sale)
    byCustomer.set(sale.customerId, rows)
  }
  const rows: AgeingRow[] = []
  for (const [customerId, sales] of byCustomer) {
    const ordered = [...sales].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    let left = paid.get(customerId) ?? 0
    const buckets = emptyBuckets()
    let total = 0
    for (const sale of ordered) {
      const invoiceTotal = saleTotal(sale)
      const take = Math.min(invoiceTotal, Math.max(0, left))
      left -= take
      const open = invoiceTotal - take
      if (open <= 0) continue
      buckets[ageingBucket(sale.date, today)] += open
      total += open
    }
    if (total > 0) rows.push({ customerId, shop: ordered[0]?.customerName ?? 'Customer', buckets, totalCents: total })
  }
  rows.sort((a, b) => b.totalCents - a.totalCents || a.shop.localeCompare(b.shop))
  return { rows, totalCents: rows.reduce((sum, row) => sum + row.totalCents, 0) }
}

function datedExpenses(tables: LocalTables, from: string, to: string): LedgerInput['expenses'] {
  return tables.expenses
    .filter((row) => inRange(String(row.created_at ?? '').slice(0, 10), from, to))
    .map((row) => ({ paidBy: String(row.paid_by ?? ''), amountEurCents: Number(row.amount_eur ?? 0) }))
}

function profitFor(ledger: LedgerInput, sales: SaleInput[], expenses: LedgerInput['expenses'] | null): Summary {
  return summarize(expenses ? { ...ledger, sales, expenses } : { ...ledger, sales })
}

export function buildReports(tables: LocalTables, query: { from?: string; to?: string; today: string }): BuiltReports {
  const from = query.from ?? ''
  const to = query.to ?? ''
  const ledger = ledgerFromTables(tables)
  const costs = averages(ledger.purchases)
  const sales = ledger.sales.filter((sale) => inRange(sale.date, from, to))
  const bounded = Boolean(from || to)
  const profit = profitFor(ledger, sales, bounded ? datedExpenses(tables, from, to) : null)
  const earlier = previousRange(from, to)
  const previousProfit = earlier
    ? profitFor(
        ledger,
        ledger.sales.filter((sale) => inRange(sale.date, earlier.from, earlier.to)),
        datedExpenses(tables, earlier.from, earlier.to),
      )
    : null
  const productName = new Map(tables.products.map((row) => [String(row.id), `${row.code} ${row.name}`.trim()]))
  const categoryName = new Map(tables.products.map((row) => [String(row.id), String(row.category || 'Uncategorised')]))
  return {
    profit,
    previousProfit,
    byProduct: groupSales(sales, costs, (_sale, line) => ({ key: line.productId, label: productName.get(line.productId) ?? line.productId })),
    byCustomer: groupSales(sales, costs, (sale) => ({ key: sale.customerId, label: sale.customerName })),
    byCategory: groupSales(sales, costs, (_sale, line) => {
      const label = categoryName.get(line.productId) ?? 'Uncategorised'
      return { key: label, label }
    }),
    byMonth: groupSales(sales, costs, (sale) => {
      const label = /^\d{4}-\d{2}/.test(sale.date) ? sale.date.slice(0, 7) : 'Undated'
      return { key: label, label }
    }).sort((a, b) => a.label.localeCompare(b.label)),
    ageing: customerAgeing(ledger, query.today),
  }
}

export function customerStatement(tables: LocalTables, customerId: string, today: string): CustomerStatement {
  const ledger = ledgerFromTables(tables)
  const shop = tables.customers.find((row) => String(row.id) === customerId)
  const sales = ledger.sales
    .filter((sale) => sale.customerId === customerId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const invoiceNo = new Map(tables.sales.map((row) => [String(row.id), String(row.invoice_no ?? row.id)]))
  let left = ledger.customerPayments
    .filter((payment) => payment.customerId === customerId)
    .reduce((sum, payment) => sum + payment.amountCents, 0)
  const invoices = sales.map((sale) => {
    const totalCents = saleTotal(sale)
    const paidCents = Math.min(totalCents, Math.max(0, left))
    left -= paidCents
    return { invoiceNo: invoiceNo.get(sale.id) ?? sale.id, date: sale.date, totalCents, paidCents, openCents: totalCents - paidCents }
  })
  const paymentsCents = ledger.customerPayments
    .filter((payment) => payment.customerId === customerId)
    .reduce((sum, payment) => sum + payment.amountCents, 0)
  return {
    shop: String(shop?.shop_name ?? sales[0]?.customerName ?? 'Customer'),
    phone: String(shop?.whatsapp ?? shop?.phone ?? ''),
    email: String(shop?.email ?? ''),
    invoices,
    paymentsCents,
    balanceCents: invoices.reduce((sum, invoice) => sum + invoice.openCents, 0),
  }
}

export function statementShareText(statement: CustomerStatement): string {
  return `${statement.shop} statement. Balance due ${centsToEuros(statement.balanceCents)}.`
}

export function statementWhatsAppUrl(statement: CustomerStatement): string {
  return `${whatsAppLink(statement.phone)}?text=${encodeURIComponent(statementShareText(statement))}`
}

export function statementMailUrl(statement: CustomerStatement): string {
  return `mailto:${statement.email}?subject=${encodeURIComponent(`${statement.shop} statement`)}&body=${encodeURIComponent(statementShareText(statement))}`
}

export function analysisSheet(groups: SalesGroup[], showProfit: boolean): (string | number)[][] {
  const header = showProfit ? ['Name', 'Pieces', 'Revenue', 'Profit'] : ['Name', 'Pieces', 'Revenue']
  const pieces = groups.reduce((sum, row) => sum + row.pieces, 0)
  const revenue = groups.reduce((sum, row) => sum + row.revenueCents, 0) / 100
  const profit = groups.reduce((sum, row) => sum + row.profitCents, 0) / 100
  const body = groups.map((row) => (
    showProfit
      ? [row.label, row.pieces, row.revenueCents / 100, row.profitCents / 100]
      : [row.label, row.pieces, row.revenueCents / 100]
  ))
  const total = showProfit ? ['Total', pieces, revenue, profit] : ['Total', pieces, revenue]
  return [header, ...body, total]
}

export function ageingSheet(rows: AgeingRow[]): (string | number)[][] {
  const header = ['Shop', ...AGEING_BUCKETS, 'Total']
  const body = rows.map((row) => [row.shop, ...AGEING_BUCKETS.map((bucket) => row.buckets[bucket] / 100), row.totalCents / 100])
  const totalCents = rows.reduce((sum, row) => sum + row.totalCents, 0)
  const totals = AGEING_BUCKETS.map((bucket) => rows.reduce((sum, row) => sum + row.buckets[bucket], 0) / 100)
  return [header, ...body, ['Total', ...totals, totalCents / 100]]
}

export function sheetToCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map((cell) => {
    const value = String(cell)
    return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
  }).join(',')).join('\n')
}

export function workbookBytes(sheetName: string, rows: (string | number)[][]): Uint8Array {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), sheetName.slice(0, 31))
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Uint8Array(bytes)
}
