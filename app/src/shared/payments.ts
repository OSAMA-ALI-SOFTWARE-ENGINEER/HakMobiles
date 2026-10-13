import { allocateOldest, invoiceStatus } from './calc'

export const OVERDUE_DAYS = 30

export type InvoiceStanding = {
  id: string
  invoiceNo: string
  customerId: string
  date: string
  totalCents: number
  paidCents: number
  status: 'Unpaid' | 'Part-paid' | 'Paid'
  overdue: boolean
}

export function isOverdue(date: string, status: string, today: string, days = OVERDUE_DAYS): boolean {
  if (status === 'Paid' || !date) return false
  const due = new Date(`${date}T00:00:00Z`)
  due.setUTCDate(due.getUTCDate() + days)
  return due.toISOString().slice(0, 10) < today
}

export function invoiceStandings(input: {
  sales: { id: string; invoice_no?: string; customer_id: string; date?: string | null }[]
  lines: { sale_id: string; qty: number; unit_price: number; discount?: number | null }[]
  allocations: { sale_id: string; amount: number }[]
  today: string
}): InvoiceStanding[] {
  return input.sales.map((sale) => {
    const totalCents = input.lines.reduce((total, line) => {
      if (line.sale_id !== sale.id) return total
      return total + line.qty * line.unit_price - (line.discount ?? 0)
    }, 0)
    const paidCents = input.allocations.reduce((total, row) => row.sale_id === sale.id ? total + row.amount : total, 0)
    const status = invoiceStatus(totalCents, paidCents)
    const date = String(sale.date ?? '')
    return {
      id: sale.id,
      invoiceNo: String(sale.invoice_no ?? sale.id),
      customerId: sale.customer_id,
      date,
      totalCents,
      paidCents,
      status,
      overdue: isOverdue(date, status, input.today),
    }
  })
}

export function paymentCredit(input: {
  payments: { id: string; customer_id: string; amount: number; created_at?: string | null }[]
  allocations: { customer_payment_id: string; amount: number }[]
  customerId: string
}): { id: string; createdAt: string; leftoverCents: number }[] {
  return input.payments
    .filter((payment) => payment.customer_id === input.customerId)
    .map((payment) => {
      const used = input.allocations.reduce((total, row) => row.customer_payment_id === payment.id ? total + row.amount : total, 0)
      return { id: payment.id, createdAt: String(payment.created_at ?? ''), leftoverCents: Math.max(0, payment.amount - used) }
    })
    .filter((payment) => payment.leftoverCents > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

export function allocationsForPayment(openInvoices: { id: string; date: string; remainingCents: number }[], amountCents: number) {
  return allocateOldest(
    openInvoices.map((invoice) => ({ id: invoice.id, date: invoice.date, totalCents: invoice.remainingCents })),
    amountCents,
  )
}

export function allocationsFromCredit(
  credit: { id: string; leftoverCents: number }[],
  saleId: string,
  saleTotalCents: number,
): { customerPaymentId: string; saleId: string; amountCents: number }[] {
  let left = saleTotalCents
  const rows: { customerPaymentId: string; saleId: string; amountCents: number }[] = []
  for (const payment of credit) {
    if (left <= 0) break
    const amount = Math.min(payment.leftoverCents, left)
    if (amount > 0) rows.push({ customerPaymentId: payment.id, saleId, amountCents: amount })
    left -= amount
  }
  return rows
}
