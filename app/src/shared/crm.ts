export const PIPELINE_STAGES = [
  { id: 'lead', label: 'Lead' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'sample_sent', label: 'Sample sent' },
  { id: 'first_order', label: 'First order' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]['id']

export function stageAfterOrders(orderCount: number, current: string): PipelineStage {
  if (orderCount >= 2) return 'active'
  if (orderCount === 1) return 'first_order'
  const known = PIPELINE_STAGES.find((stage) => stage.id === current)
  return known?.id ?? 'lead'
}

export function followUpBucket(dueAt: string, doneAt: string | null, today: string): 'Done' | 'Overdue' | 'Today' | 'Upcoming' {
  if (doneAt) return 'Done'
  const due = dueAt.slice(0, 10)
  if (due < today) return 'Overdue'
  if (due === today) return 'Today'
  return 'Upcoming'
}

export function shopFigures(input: {
  customerId: string
  sales: { id: string; customer_id: string; date?: string | null }[]
  lines: { sale_id: string; qty: number; unit_price: number; discount?: number | null }[]
  payments: { customer_id: string; amount: number }[]
}): { boughtCents: number; paidCents: number; owedCents: number; orders: number; lastOrder: string } {
  const orders = input.sales.filter((sale) => sale.customer_id === input.customerId)
  const saleIds = new Set(orders.map((sale) => sale.id))
  const boughtCents = input.lines.reduce((total, line) => {
    if (!saleIds.has(line.sale_id)) return total
    return total + line.qty * line.unit_price - (line.discount ?? 0)
  }, 0)
  const paidCents = input.payments.reduce((total, payment) => payment.customer_id === input.customerId ? total + payment.amount : total, 0)
  const lastOrder = orders.map((sale) => String(sale.date ?? '')).filter(Boolean).sort().at(-1) ?? ''
  return { boughtCents, paidCents, owedCents: Math.max(0, boughtCents - paidCents), orders: orders.length, lastOrder }
}
