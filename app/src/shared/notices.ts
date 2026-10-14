import { isOverdue } from './payments'

export interface TrackerNotice {
  id: string
  kind: 'low_stock' | 'out_of_stock' | 'invoice_overdue'
  text: string
}

export function trackerNotices(input: {
  stock: { code: string; status: string }[]
  openInvoices: { id: string; label: string; date: string }[]
  today: string
  canSeeStock: boolean
  muted: string[]
  overdueDays?: number
}): TrackerNotice[] {
  const notices: TrackerNotice[] = []
  if (input.canSeeStock && !input.muted.includes('low_stock')) {
    for (const item of input.stock) {
      if (item.status === 'LOW') notices.push({ id: `low-${item.code}`, kind: 'low_stock', text: `${item.code} is low on stock` })
      if (item.status === 'OUT') notices.push({ id: `out-${item.code}`, kind: 'out_of_stock', text: `${item.code} is out of stock` })
    }
  }
  if (!input.muted.includes('invoice_overdue')) {
    for (const invoice of input.openInvoices) {
      if (isOverdue(invoice.date, 'Unpaid', input.today, input.overdueDays)) {
        notices.push({ id: `due-${invoice.id}`, kind: 'invoice_overdue', text: `${invoice.label} is overdue` })
      }
    }
  }
  return notices
}
