import { describe, expect, it } from 'vitest'
import { trackerNotices } from './notices'

const stock = [
  { code: 'C1', status: 'LOW' },
  { code: 'CH1', status: 'OK' },
]

const openInvoices = [{ id: 'sale-a', label: 'Shop A', date: '2026-01-10' }]

describe('notices', () => {
  it('shows low stock only to people who can see stock', () => {
    const visible = trackerNotices({ stock, openInvoices, today: '2026-10-09', canSeeStock: true, muted: [] })
    expect(visible.map((notice) => notice.text)).toContain('C1 is low on stock')
    const hidden = trackerNotices({ stock, openInvoices, today: '2026-10-09', canSeeStock: false, muted: [] })
    expect(hidden.some((notice) => notice.kind === 'low_stock')).toBe(false)
  })

  it('hides overdue invoices after that notice is turned off', () => {
    const on = trackerNotices({ stock, openInvoices, today: '2026-10-09', canSeeStock: true, muted: [] })
    expect(on.some((notice) => notice.text === 'Shop A is overdue')).toBe(true)
    const off = trackerNotices({ stock, openInvoices, today: '2026-10-09', canSeeStock: true, muted: ['invoice_overdue'] })
    expect(off.some((notice) => notice.kind === 'invoice_overdue')).toBe(false)
    expect(off.some((notice) => notice.text === 'C1 is low on stock')).toBe(true)
  })
})
