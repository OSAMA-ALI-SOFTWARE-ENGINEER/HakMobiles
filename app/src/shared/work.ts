import { isValidPortugueseNif } from './nif'

export function reorderSuggestion(soldLast30: number, onHand: number, onOrder: number): number {
  return Math.max(0, Math.ceil(soldLast30 * 1.5 - onHand - onOrder))
}

export interface SettleMove {
  fromId: string
  toId: string
  fromName: string
  toName: string
  amountCents: number
}

export function settleTransfers(partners: { id: string; name: string; balanceCents: number }[]): SettleMove[] {
  const debtors = partners
    .filter((partner) => partner.balanceCents < 0)
    .map((partner) => ({ ...partner, left: -partner.balanceCents }))
    .sort((a, b) => b.left - a.left || a.name.localeCompare(b.name))
  const creditors = partners
    .filter((partner) => partner.balanceCents > 0)
    .map((partner) => ({ ...partner, left: partner.balanceCents }))
    .sort((a, b) => b.left - a.left || a.name.localeCompare(b.name))
  const moves: SettleMove[] = []
  let debtor = 0
  let creditor = 0
  while (debtor < debtors.length && creditor < creditors.length) {
    const amountCents = Math.min(debtors[debtor].left, creditors[creditor].left)
    if (amountCents > 0) {
      moves.push({
        fromId: debtors[debtor].id,
        toId: creditors[creditor].id,
        fromName: debtors[debtor].name,
        toName: creditors[creditor].name,
        amountCents,
      })
    }
    debtors[debtor].left -= amountCents
    creditors[creditor].left -= amountCents
    if (debtors[debtor].left === 0) debtor += 1
    if (creditors[creditor].left === 0) creditor += 1
  }
  return moves
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function dueWithin(date: string, today: string, days: number): boolean {
  const day = date.slice(0, 10)
  return day >= today && day <= addDays(today, days)
}

export function shopsToMarkInactive(shops: { id: string; status: string; lastOrder: string }[], today: string, days = 60): string[] {
  const cutoff = addDays(today, -days)
  return shops
    .filter((shop) => (shop.status === 'active' || shop.status === 'first_order') && shop.lastOrder !== '' && shop.lastOrder < cutoff)
    .map((shop) => shop.id)
}

export function paymentReminderDrafts(input: {
  invoices: { id: string; customerId: string; invoiceNo: string; overdue: boolean }[]
  followUps: { autoReason: string | null }[]
}): { customerId: string; title: string; autoReason: string }[] {
  const taken = new Set(input.followUps.map((row) => row.autoReason).filter((reason): reason is string => Boolean(reason)))
  return input.invoices
    .filter((invoice) => invoice.overdue && !taken.has(`overdue:${invoice.id}`))
    .map((invoice) => ({
      customerId: invoice.customerId,
      title: `Payment reminder · ${invoice.invoiceNo}`,
      autoReason: `overdue:${invoice.id}`,
    }))
}

export function isMonthLocked(date: string, lockedMonths: string[]): boolean {
  return lockedMonths.includes(date.slice(0, 7))
}

export interface SpecialPrice {
  customerId: string
  productId: string
  cents: number
}

export function priceForShop(listCents: number, prices: SpecialPrice[], customerId: string, productId: string): number {
  const match = prices.find((row) => row.customerId === customerId && row.productId === productId)
  return match ? match.cents : listCents
}

export function nifProblems(rows: { shop: string; nif: string }[]): { shop: string; nif: string }[] {
  return rows
    .filter((row) => row.nif.trim() !== '' && !isValidPortugueseNif(row.nif.trim()))
    .map((row) => ({ shop: row.shop, nif: row.nif.trim() }))
}

export interface RecurringCost {
  id: string
  category: string
  amountCents: number
  paidBy: string
  confirmedMonth: string
}

export function recurringDue(templates: RecurringCost[], month: string): RecurringCost[] {
  return templates.filter((row) => row.confirmedMonth < month)
}

export function slowProductIds(rows: { productId: string; lastSale: string; onHand: number }[], today: string, days = 60): string[] {
  const cutoff = addDays(today, -days)
  return rows.filter((row) => row.onHand > 0 && (row.lastSale === '' || row.lastSale < cutoff)).map((row) => row.productId)
}
