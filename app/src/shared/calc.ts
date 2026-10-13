import { weightedAverageCost, type Cents } from './money'

export type StockStatus = 'CHECK' | 'OUT' | 'LOW' | 'OK'

export interface ProductInput {
  id: string
  code: string
  name: string
  alertLevel: number | null
}

export interface PurchaseInput {
  supplierId: string
  productId: string
  qty: number
  receivedQty?: number | null
  unitCostCents: Cents
}

export interface SaleInput {
  id: string
  customerId: string
  customerName: string
  date: string
  lines: {
    productId: string
    qty: number
    unitPriceCents: Cents
    discountCents: Cents
    unitCostAtSaleCents?: Cents | null
  }[]
}

export interface LedgerInput {
  products: ProductInput[]
  defaultAlert: number
  purchases: PurchaseInput[]
  adjustments: { productId: string; qty: number }[]
  sales: SaleInput[]
  customerPayments: { customerId: string; receivedBy: string; amountCents: Cents }[]
  supplierPayments: { supplierId: string; paidBy: string; amountEurCents: Cents }[]
  expenses: { paidBy: string; amountEurCents: Cents }[]
  transfers: { fromPartnerId: string; toPartnerId: string; amountCents: Cents }[]
  partners: { id: string; name: string; sharePct: number }[]
  overdueDays?: number
  today?: string
}

export interface Summary {
  revenueCents: Cents
  cogsCents: Cents
  grossProfitCents: Cents
  expenseCents: Cents
  netProfitCents: Cents
  marginPercent: number
  customersOweCents: Cents
  suppliersOweCents: Cents
  stockValueCents: Cents
  stock: { code: string; qty: number; status: StockStatus; valueCents: Cents }[]
  partnerBalances: { id: string; name: string; balanceCents: Cents; shareCents: Cents }[]
  whoOwesWhom: string
}

export function stockQty(purchased: number, sold: number, adjustments: number): number {
  return purchased - sold + adjustments
}

export function stockStatus(qty: number, alertLevel: number): StockStatus {
  if (qty < 0) return 'CHECK'
  if (qty === 0) return 'OUT'
  if (qty <= alertLevel) return 'LOW'
  return 'OK'
}

export function marginPercent(netCents: Cents, revenueCents: Cents): number {
  if (revenueCents === 0) return 0
  return Math.round((netCents / revenueCents) * 1000) / 10
}

export function lineRevenue(qty: number, unitPriceCents: Cents, discountCents: Cents): Cents {
  return qty * unitPriceCents - discountCents
}

export function allocateOldest(
  invoices: { id: string; date: string; totalCents: Cents }[],
  paymentCents: Cents,
): { saleId: string; amountCents: Cents }[] {
  const ordered = [...invoices].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  let left = paymentCents
  const allocations: { saleId: string; amountCents: Cents }[] = []
  for (const invoice of ordered) {
    if (left <= 0) break
    const amount = Math.min(invoice.totalCents, left)
    if (amount > 0) allocations.push({ saleId: invoice.id, amountCents: amount })
    left -= amount
  }
  return allocations
}

export function invoiceStatus(totalCents: Cents, paidCents: Cents): 'Unpaid' | 'Part-paid' | 'Paid' {
  if (paidCents <= 0) return 'Unpaid'
  if (paidCents >= totalCents) return 'Paid'
  return 'Part-paid'
}

export function summarize(input: LedgerInput): Summary {
  const avg = new Map<string, Cents>()
  const purchasedQty = new Map<string, number>()
  const purchasedValue = new Map<string, Cents>()

  for (const purchase of input.purchases) {
    const received = purchase.receivedQty == null ? purchase.qty : purchase.receivedQty
    const oldQty = purchasedQty.get(purchase.productId) ?? 0
    const oldAvg = avg.get(purchase.productId) ?? 0
    avg.set(purchase.productId, weightedAverageCost(oldQty, oldAvg, received, purchase.unitCostCents))
    purchasedQty.set(purchase.productId, oldQty + received)
    purchasedValue.set(purchase.supplierId, (purchasedValue.get(purchase.supplierId) ?? 0) + purchase.qty * purchase.unitCostCents)
  }

  let revenue = 0
  let cogs = 0
  const soldQty = new Map<string, number>()
  const customerRevenue = new Map<string, Cents>()

  for (const sale of input.sales) {
    for (const line of sale.lines) {
      const lineTotal = lineRevenue(line.qty, line.unitPriceCents, line.discountCents)
      const costEach = line.unitCostAtSaleCents == null ? (avg.get(line.productId) ?? 0) : line.unitCostAtSaleCents
      const cost = line.qty * costEach
      revenue += lineTotal
      cogs += cost
      soldQty.set(line.productId, (soldQty.get(line.productId) ?? 0) + line.qty)
      customerRevenue.set(sale.customerId, (customerRevenue.get(sale.customerId) ?? 0) + lineTotal)
    }
  }

  const customerPaid = new Map<string, Cents>()
  for (const payment of input.customerPayments) {
    customerPaid.set(payment.customerId, (customerPaid.get(payment.customerId) ?? 0) + payment.amountCents)
  }

  let customersOwe = 0
  for (const [customerId, total] of customerRevenue) {
    customersOwe += Math.max(0, total - (customerPaid.get(customerId) ?? 0))
  }

  const supplierPaid = new Map<string, Cents>()
  for (const payment of input.supplierPayments) {
    supplierPaid.set(payment.supplierId, (supplierPaid.get(payment.supplierId) ?? 0) + payment.amountEurCents)
  }
  let suppliersOwe = 0
  for (const [supplierId, total] of purchasedValue) {
    suppliersOwe += Math.max(0, total - (supplierPaid.get(supplierId) ?? 0))
  }

  const expenseCents = input.expenses.reduce((sum, expense) => sum + expense.amountEurCents, 0)
  const gross = revenue - cogs
  const net = gross - expenseCents

  const adjustments = new Map<string, number>()
  for (const adjustment of input.adjustments) {
    adjustments.set(adjustment.productId, (adjustments.get(adjustment.productId) ?? 0) + adjustment.qty)
  }

  let stockValue = 0
  const stock = input.products.map((product) => {
    const qty = stockQty(purchasedQty.get(product.id) ?? 0, soldQty.get(product.id) ?? 0, adjustments.get(product.id) ?? 0)
    const value = qty * (avg.get(product.id) ?? 0)
    stockValue += value
    return {
      code: product.code,
      qty,
      status: stockStatus(qty, product.alertLevel ?? input.defaultAlert),
      valueCents: value,
    }
  })

  const paymentIn = sumBy(input.customerPayments, (row) => row.amountCents)
  const paymentOut = sumBy(input.supplierPayments, (row) => row.amountEurCents) + expenseCents
  const netCash = paymentIn - paymentOut
  const held = new Map<string, Cents>()
  for (const partner of input.partners) held.set(partner.id, 0)
  for (const payment of input.customerPayments) held.set(payment.receivedBy, (held.get(payment.receivedBy) ?? 0) + payment.amountCents)
  for (const payment of input.supplierPayments) held.set(payment.paidBy, (held.get(payment.paidBy) ?? 0) - payment.amountEurCents)
  for (const expense of input.expenses) held.set(expense.paidBy, (held.get(expense.paidBy) ?? 0) - expense.amountEurCents)
  for (const transfer of input.transfers) {
    held.set(transfer.fromPartnerId, (held.get(transfer.fromPartnerId) ?? 0) - transfer.amountCents)
    held.set(transfer.toPartnerId, (held.get(transfer.toPartnerId) ?? 0) + transfer.amountCents)
  }

  const partnerBalances = input.partners.map((partner) => {
    const fair = Math.round((netCash * partner.sharePct) / 100)
    const share = Math.round((net * partner.sharePct) / 100)
    return {
      id: partner.id,
      name: partner.name,
      balanceCents: fair - (held.get(partner.id) ?? 0),
      shareCents: share,
    }
  })

  return {
    revenueCents: revenue,
    cogsCents: cogs,
    grossProfitCents: gross,
    expenseCents,
    netProfitCents: net,
    marginPercent: marginPercent(net, revenue),
    customersOweCents: customersOwe,
    suppliersOweCents: suppliersOwe,
    stockValueCents: stockValue,
    stock,
    partnerBalances,
    whoOwesWhom: describeBalances(partnerBalances),
  }
}

export function frozenSaleProfit(unitCostAtSaleCents: Cents, qty: number, unitPriceCents: Cents, discountCents: Cents): Cents {
  return lineRevenue(qty, unitPriceCents, discountCents) - qty * unitCostAtSaleCents
}

function sumBy<T>(rows: T[], pick: (row: T) => Cents): Cents {
  return rows.reduce((sum, row) => sum + pick(row), 0)
}

function describeBalances(balances: Summary['partnerBalances']): string {
  const owed = balances.filter((partner) => partner.balanceCents > 0)
  const owes = balances.filter((partner) => partner.balanceCents < 0)
  if (owed.length === 0 || owes.length === 0) return 'Partners are settled.'
  const debtor = owes.map((partner) => `${partner.name} owes ${formatPlain(Math.abs(partner.balanceCents))}`).join(' and ')
  const creditors = owed.map((partner) => `${formatPlain(partner.balanceCents)} to ${partner.name}`).join(' and ')
  return `${debtor}: ${creditors}.`
}

function formatPlain(cents: Cents): string {
  return `€${(cents / 100).toFixed(2)}`
}

export const GOLDEN_IDS = {
  c1: '01900000-0000-7000-8000-000000000011',
  ch1: '01900000-0000-7000-8000-000000000012',
  waseem: '01900000-0000-7000-8000-000000000021',
  haseeb: '01900000-0000-7000-8000-000000000022',
  umar: '01900000-0000-7000-8000-000000000023',
  shopA: '01900000-0000-7000-8000-000000000031',
  shopB: '01900000-0000-7000-8000-000000000032',
  shenzhen: '01900000-0000-7000-8000-000000000041',
  lahore: '01900000-0000-7000-8000-000000000042',
  saleA: '01900000-0000-7000-8000-000000000051',
  saleB: '01900000-0000-7000-8000-000000000052',
} as const

export function goldenLedger(): LedgerInput {
  return {
    defaultAlert: 10,
    products: [
      { id: GOLDEN_IDS.c1, code: 'C1', name: 'Case', alertLevel: 10 },
      { id: GOLDEN_IDS.ch1, code: 'CH1', name: 'Charger', alertLevel: 3 },
    ],
    purchases: [
      { supplierId: GOLDEN_IDS.shenzhen, productId: GOLDEN_IDS.c1, qty: 100, unitCostCents: 100 },
      { supplierId: GOLDEN_IDS.lahore, productId: GOLDEN_IDS.ch1, qty: 20, unitCostCents: 400 },
    ],
    adjustments: [{ productId: GOLDEN_IDS.ch1, qty: -1 }],
    sales: [
      {
        id: GOLDEN_IDS.saleA,
        customerId: GOLDEN_IDS.shopA,
        customerName: 'Shop A',
        date: '2026-01-10',
        lines: [{ productId: GOLDEN_IDS.c1, qty: 95, unitPriceCents: 500, discountCents: 500 }],
      },
      {
        id: GOLDEN_IDS.saleB,
        customerId: GOLDEN_IDS.shopB,
        customerName: 'Shop B',
        date: '2026-01-11',
        lines: [{ productId: GOLDEN_IDS.ch1, qty: 15, unitPriceCents: 900, discountCents: 0 }],
      },
    ],
    customerPayments: [{ customerId: GOLDEN_IDS.shopA, receivedBy: GOLDEN_IDS.haseeb, amountCents: 30000 }],
    supplierPayments: [
      { supplierId: GOLDEN_IDS.shenzhen, paidBy: GOLDEN_IDS.umar, amountEurCents: 10000 },
      { supplierId: GOLDEN_IDS.lahore, paidBy: GOLDEN_IDS.haseeb, amountEurCents: 8000 },
    ],
    expenses: [{ paidBy: GOLDEN_IDS.waseem, amountEurCents: 2000 }],
    transfers: [{ fromPartnerId: GOLDEN_IDS.haseeb, toPartnerId: GOLDEN_IDS.umar, amountCents: 5000 }],
    partners: [
      { id: GOLDEN_IDS.waseem, name: 'Dr. Waseem', sharePct: 20 },
      { id: GOLDEN_IDS.haseeb, name: 'Haseeb', sharePct: 40 },
      { id: GOLDEN_IDS.umar, name: 'Umar', sharePct: 40 },
    ],
  }
}
