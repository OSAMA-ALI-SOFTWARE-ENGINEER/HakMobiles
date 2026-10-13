import type { PurchaseInput } from './calc'
import type { Cents } from './money'

export type PurchaseReceipt = 'Ordered' | 'Partly received' | 'Received'

export function landedUnitCosts(
  lines: { qty: number; unitCostCents: Cents }[],
  extraCents: Cents,
  spread: 'quantity' | 'value',
): Cents[] {
  const goods = lines.map((line) => line.qty * line.unitCostCents)
  const base = spread === 'value' ? goods.reduce((sum, value) => sum + value, 0) : lines.reduce((sum, line) => sum + line.qty, 0)
  if (base === 0 || extraCents === 0) return lines.map((line) => line.unitCostCents)
  let remaining = extraCents
  return lines.map((line, index) => {
    const weight = spread === 'value' ? goods[index] : line.qty
    const share = index === lines.length - 1 ? remaining : Math.round((extraCents * weight) / base)
    remaining -= share
    if (line.qty === 0) return line.unitCostCents
    return Math.round((goods[index] + share) / line.qty)
  })
}

export function purchaseStatus(ordered: number, received: number): PurchaseReceipt {
  if (received <= 0) return 'Ordered'
  if (received < ordered) return 'Partly received'
  return 'Received'
}

export function onOrderQty(ordered: number, received: number): number {
  return Math.max(0, ordered - received)
}

export function supplierPosition(purchasedCents: Cents, paidCents: Cents): { purchasedCents: Cents; paidCents: Cents; owedCents: Cents } {
  return {
    purchasedCents,
    paidCents,
    owedCents: Math.max(0, purchasedCents - paidCents),
  }
}

export function purchaseLedgerRows(input: {
  purchases: { id: unknown; supplier_id?: unknown; extra_cost?: unknown }[]
  lines: { purchase_id: unknown; product_id: unknown; qty: unknown; qty_received?: unknown; unit_cost: unknown }[]
}): PurchaseInput[] {
  const headers = new Map(input.purchases.map((purchase) => [String(purchase.id), purchase]))
  const grouped = new Map<string, typeof input.lines>()
  for (const line of input.lines) {
    const purchaseId = String(line.purchase_id)
    grouped.set(purchaseId, [...(grouped.get(purchaseId) ?? []), line])
  }
  const rows: PurchaseInput[] = []
  for (const [purchaseId, lines] of grouped) {
    const header = headers.get(purchaseId)
    const costs = landedUnitCosts(
      lines.map((line) => ({ qty: Number(line.qty), unitCostCents: Number(line.unit_cost) })),
      Number(header?.extra_cost ?? 0),
      'quantity',
    )
    lines.forEach((line, index) => {
      const received = line.qty_received == null || line.qty_received === '' ? null : Number(line.qty_received)
      rows.push({
        supplierId: String(header?.supplier_id ?? ''),
        productId: String(line.product_id),
        qty: Number(line.qty),
        receivedQty: received,
        unitCostCents: costs[index],
      })
    })
  }
  return rows
}

export function supplierMoney(input: {
  supplierId: string
  purchases: { id: unknown; supplier_id?: unknown; extra_cost?: unknown }[]
  lines: { purchase_id: unknown; product_id: unknown; qty: unknown; qty_received?: unknown; unit_cost: unknown }[]
  payments: { supplier_id?: unknown; amount_eur?: unknown }[]
}): { purchasedCents: Cents; paidCents: Cents; owedCents: Cents } {
  const purchasedCents = purchaseLedgerRows(input)
    .filter((row) => row.supplierId === input.supplierId)
    .reduce((sum, row) => sum + row.qty * row.unitCostCents, 0)
  const paidCents = input.payments.reduce((sum, payment) => payment.supplier_id === input.supplierId ? sum + Number(payment.amount_eur ?? 0) : sum, 0)
  return supplierPosition(purchasedCents, paidCents)
}
