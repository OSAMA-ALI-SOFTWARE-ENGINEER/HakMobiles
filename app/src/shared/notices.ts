import { isOverdue } from './payments'

export interface TrackerNotice {
  id: string
  kind: 'low_stock' | 'out_of_stock' | 'invoice_overdue' | 'follow_up' | 'large_payment'
  text: string
}

export function trackerNotices(input: {
  stock: { code: string; status: string }[]
  openInvoices: { id: string; label: string; date: string }[]
  today: string
  canSeeStock: boolean
  muted: string[]
  overdueDays?: number
  followUps?: { id: string; title: string; due: string; done: boolean }[]
  payments?: { id: string; label: string; amountCents: number; date: string }[]
  largePaymentCents?: number
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
  if (!input.muted.includes('follow_up')) {
    for (const item of input.followUps ?? []) {
      if (!item.done && item.due.slice(0, 10) <= input.today) {
        notices.push({ id: `follow-${item.id}`, kind: 'follow_up', text: `${item.title} is due` })
      }
    }
  }
  const large = input.largePaymentCents ?? 50000
  if (!input.muted.includes('large_payment')) {
    for (const payment of input.payments ?? []) {
      if (payment.date.slice(0, 10) === input.today && payment.amountCents >= large) {
        notices.push({ id: `pay-${payment.id}`, kind: 'large_payment', text: `${payment.label} received a large payment` })
      }
    }
  }
  return notices
}

export function readToken(id: string, day: string): string {
  return `${day}:${id}`
}

export function unreadNotices(notices: TrackerNotice[], readIds: string[], day?: string): TrackerNotice[] {
  const read = new Set(readIds)
  return notices.filter((notice) => !read.has(day ? readToken(notice.id, day) : notice.id))
}

export function markNoticeRead(readIds: string[], id: string, day?: string): string[] {
  const key = day ? readToken(id, day) : id
  return readIds.includes(key) ? readIds : [...readIds, key]
}

export function markAllNoticesRead(readIds: string[], notices: TrackerNotice[], day?: string): string[] {
  const keys = notices.map((notice) => (day ? readToken(notice.id, day) : notice.id))
  return [...new Set([...readIds, ...keys])]
}

export function noticeReadKey(userId: string): string {
  return `hak.notice.read.${userId}`
}
