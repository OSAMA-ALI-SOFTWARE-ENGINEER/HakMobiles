import { lineRevenue } from './calc'
import { centsToEuros, weightedAverageCost, type Cents } from './money'

export interface DraftLine {
  productId: string
  qty: number
  unitPriceCents: Cents
  discountCents: Cents
}

export function nextInvoiceNumber(prefix: string, counter: number, invoiceNos: string[]): number {
  const highest = invoiceNos.reduce((max, invoiceNo) => {
    if (!invoiceNo.startsWith(`${prefix}-`)) return max
    const value = Number(invoiceNo.slice(prefix.length + 1))
    return Number.isFinite(value) ? Math.max(max, value) : max
  }, counter)
  return highest + 1
}

export function lisbonToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(now)
}

export function averageCostByProduct(purchases: { productId: string; qty: number; unitCostCents: Cents }[]): Map<string, Cents> {
  const qty = new Map<string, number>()
  const average = new Map<string, Cents>()
  for (const purchase of purchases) {
    const oldQty = qty.get(purchase.productId) ?? 0
    const oldAverage = average.get(purchase.productId) ?? 0
    average.set(purchase.productId, weightedAverageCost(oldQty, oldAverage, purchase.qty, purchase.unitCostCents))
    qty.set(purchase.productId, oldQty + purchase.qty)
  }
  return average
}

export function onHandByProduct(input: {
  purchases: { productId: string; qty: number }[]
  sales: { productId: string; qty: number }[]
  adjustments: { productId: string; qty: number }[]
}): Map<string, number> {
  const qty = new Map<string, number>()
  const add = (productId: string, amount: number) => qty.set(productId, (qty.get(productId) ?? 0) + amount)
  for (const purchase of input.purchases) add(purchase.productId, purchase.qty)
  for (const sale of input.sales) add(sale.productId, -sale.qty)
  for (const adjustment of input.adjustments) add(adjustment.productId, adjustment.qty)
  return qty
}

export function saleTotalCents(lines: DraftLine[]): Cents {
  return lines.reduce((total, line) => total + lineRevenue(line.qty, line.unitPriceCents, line.discountCents), 0)
}

export function stockWarningText(lines: { productId: string; name: string; qty: number; onHand: number }[]): string {
  const asked = new Map<string, { name: string; qty: number; onHand: number }>()
  for (const line of lines) {
    if (line.qty <= 0) continue
    const current = asked.get(line.productId) ?? { name: line.name, qty: 0, onHand: line.onHand }
    current.qty += line.qty
    asked.set(line.productId, current)
  }
  return [...asked.values()]
    .filter((row) => row.qty > row.onHand)
    .map((row) => `Stock warning: ${row.name} has ${row.onHand} in stock and this sale asks for ${row.qty}.`)
    .join(' ')
}

export function creditWarningText(owedBeforeCents: Cents, saleCents: Cents, limitCents: Cents | null): string {
  if (limitCents == null || saleCents <= 0) return ''
  const next = owedBeforeCents + saleCents
  if (next <= limitCents) return ''
  return `Credit warning: this sale takes the balance to ${centsToEuros(next)}, above the ${centsToEuros(limitCents)} credit limit.`
}

export function isRepeatSale(input: {
  customerId: string
  lines: DraftLine[]
  existing: { id: string; customerId: string; createdAt: string; lines: DraftLine[] }[]
  now: number
  ignoreSaleId?: string
}): boolean {
  const next = lineSignature(input.lines)
  return input.existing.some((sale) => {
    if (sale.id === input.ignoreSaleId) return false
    if (sale.customerId !== input.customerId) return false
    if (input.now - Date.parse(sale.createdAt) >= 120000) return false
    return lineSignature(sale.lines) === next
  })
}

export function saleEditGate(input: {
  isSuperAdmin: boolean
  canManageSales: boolean
  canEditOwn: boolean
  sellerId: string | null
  currentUserId: string
  saleDate: string
  today: string
  reason: string
}): { canOpen: boolean; canSave: boolean; needsReason: boolean; message: string } {
  const sameDay = input.saleDate.slice(0, 10) === input.today
  const own = input.sellerId != null && input.sellerId === input.currentUserId
  const manager = input.isSuperAdmin || input.canManageSales
  if (!manager && !(input.canEditOwn && own && sameDay)) {
    return { canOpen: false, canSave: false, needsReason: false, message: 'You can edit your own sales from today.' }
  }
  const needsReason = !sameDay
  if (needsReason && input.reason.trim() === '') {
    return { canOpen: true, canSave: false, needsReason: true, message: 'A reason is required for a sale from before today.' }
  }
  return { canOpen: true, canSave: true, needsReason, message: '' }
}

function lineSignature(lines: DraftLine[]): string {
  return [...lines]
    .map((line) => `${line.productId}:${line.qty}:${line.unitPriceCents}:${line.discountCents}`)
    .sort()
    .join('|')
}
