import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftRight, BarChart3, Bell, Calendar, CalendarDays, ChevronDown, Eye, EyeOff, Kanban, LayoutDashboard, LogOut, Package, Receipt, ScrollText, Search, Settings, Shield, ShoppingBag, Store, Truck, Wallet, type LucideIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { z } from 'zod'
import { v7 as uuidv7 } from 'uuid'
import { api, ApiError } from './api'
import { ActivityScreen, DevicesPanel, RolesPanel } from './admin/AdminScreens'
import { SettingsScreen } from './admin/SettingsScreen'
import { Customer360, FollowUps, Pipeline } from './crm/CrmScreens'
import { CalendarScreen } from './crm/CalendarScreen'
import { PurchaseScreen } from './purchases/PurchaseScreen'
import { ReportsScreen } from './reports/ReportsScreen'
import { SalesScreen } from './sales/SalesScreen'
import { browserQuery, loadLocal, saveLocal, whenBatchIdle, wipeLocal } from './db/browser'
import { summarizeTables, type LocalTables, emptyTables } from './data/ledger'
import { loadGoldenSample, replaceBusinessData } from './data/sample'
import { centsToEuros, centsToInput, fxToEurCents, parseEuros, requiredSellingPrice } from './shared/money'
import { hashPin } from './auth/pin'
import { canAccess, visibleMenu } from './shared/access'
import { duplicateGroups, duplicateWarning } from './shared/customers'
import { isValidPortugueseNif, whatsAppLink } from './shared/nif'
import { allocationsForPayment, invoiceStandings, paymentCredit } from './shared/payments'
import { editReasonGate, archiveBlock } from './shared/records'
import { filterProducts } from './shared/products'
import { lisbonToday } from './shared/sales'
import { shopLabel } from './shared/labels'
import { settingJson, settingList, settingNumber } from './shared/settings'
import { FactList, Popup } from './ui/Popup'
import { PageSkeleton, skeletonKindForPath } from './ui/PageSkeleton'
import { ArchiveDialog, RowActions } from './ui/RecordActions'
import { RecordTable } from './ui/RecordTable'
import { ArchivedPanel } from './ui/ArchivedPanel'
import { UndoToast, offerUndo } from './ui/undo'
import { markAllNoticesRead, markNoticeRead, noticeReadKey, trackerNotices, unreadNotices } from './shared/notices'
import { sidebarCollapsed, storedSidebarWidth } from './shared/sidebar'
import { customerStatement } from './shared/reports'
import { onOrderQty, purchaseLedgerRows, supplierMoney } from './shared/purchases'
import { backupName, dashboardView, dueOn, type DashboardPeriod } from './shared/dashboard'
import { documentBrand } from './shared/brand'
import { addDays, dueWithin, recurringDue, reorderSuggestion, settleTransfers, type RecurringCost } from './shared/work'
import { withoutInlineMedia, shouldKeepLocalMedia } from './shared/photos'
import { syncFailureNotice } from './sync/engine'
import { tablesFromWorkbook, tablesToWorkbook } from './shared/trackerImport'
import { RecordImage } from './ui/RecordImage'
import { rowFromServer, rowToServer } from './sync/codec'
import { uploadPendingMedia } from './sync/media'

interface Session {
  token: string
  permissions: string[]
  roles: string[]
  userName: string
  email: string
  phone: string
  avatarPath: string
  notifyOverdue: boolean
  userId: string
  mustChangePassword: boolean
  mustSetupTwoFactor: boolean
  invoicePrefix: string
  deviceId: string
}

const sessionKey = 'hak.session'
const twoFactorEnabled = false
const pinEnabled = false

const menuIcons: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Products: Package,
  Customers: Store,
  Pipeline: Kanban,
  'Follow-ups': CalendarDays,
  Calendar,
  Suppliers: Truck,
  Purchases: ShoppingBag,
  Sales: Receipt,
  Payments: Wallet,
  Expenses: Wallet,
  Transfers: ArrowLeftRight,
  Reports: BarChart3,
  Activity: ScrollText,
  Settings,
  Admin: Shield,
}

function statusTone(status: string) {
  if (status.startsWith('Synced')) return ''
  if (status.startsWith('Offline') || status.startsWith('Needs')) return 'bad'
  return 'warn'
}

function readSession(): Session | null {
  const raw = localStorage.getItem(sessionKey) ?? sessionStorage.getItem(sessionKey)
  return raw ? (JSON.parse(raw) as Session) : null
}

function writeSession(session: Session | null, remember?: boolean) {
  if (!session) {
    sessionStorage.removeItem(sessionKey)
    localStorage.removeItem(sessionKey)
    return
  }
  const persist = remember ?? localStorage.getItem(sessionKey) !== null
  const keep = persist ? localStorage : sessionStorage
  const drop = persist ? sessionStorage : localStorage
  drop.removeItem(sessionKey)
  keep.setItem(sessionKey, JSON.stringify(session))
}

async function readTables(): Promise<LocalTables> {
  const [products, purchases, purchase_lines, sales, sale_lines, stock_adjustments, customer_payments, supplier_payments, expenses, partner_transfers, partners, customers, suppliers, customer_activities, follow_ups, payment_allocations, settings] = await Promise.all([
    loadLocal('products'),
    loadLocal('purchases'),
    loadLocal('purchase_lines'),
    loadLocal('sales'),
    loadLocal('sale_lines'),
    loadLocal('stock_adjustments'),
    loadLocal('customer_payments'),
    loadLocal('supplier_payments'),
    loadLocal('expenses'),
    loadLocal('partner_transfers'),
    loadLocal('partners'),
    loadLocal('customers'),
    loadLocal('suppliers'),
    loadLocal('customer_activities'),
    loadLocal('follow_ups'),
    loadLocal('payment_allocations'),
    loadLocal('settings'),
  ])
  return { products, purchases, purchase_lines, sales, sale_lines, stock_adjustments, customer_payments, supplier_payments, expenses, partner_transfers, partners, customers, suppliers, customer_activities, follow_ups, payment_allocations, settings }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(readSession)
  const [status, setStatus] = useState('Offline')
  const [tables, setTables] = useState<LocalTables>(emptyTables())
  const [booksReady, setBooksReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [unlocked, setUnlocked] = useState(sessionStorage.getItem('hak.unlocked') === 'yes')
  const [query, setQuery] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [noticesOpen, setNoticesOpen] = useState(false)
  const [desktopNew, setDesktopNew] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => storedSidebarWidth(localStorage.getItem('hak.sidebarWidth')))
  const [readNoticeIds, setReadNoticeIds] = useState<string[]>([])
  const [mutedLocal, setMutedLocal] = useState<string[]>([])
  const sidebarDrag = useRef<{ startX: number; startW: number } | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const navigate = useNavigate()

  async function refresh() {
    setTables(await readTables())
    setNotice('')
  }

  useEffect(() => {
    refresh()
      .catch(() => setNotice('Local database is still opening.'))
      .finally(() => setBooksReady(true))
  }, [])

  useEffect(() => {
    if (!session) return
    try {
      const stored = JSON.parse(localStorage.getItem(noticeReadKey(session.userId)) ?? '[]')
      setReadNoticeIds(Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [])
      const muted = JSON.parse(localStorage.getItem(`hak.notice.mute.${session.userId}`) ?? '[]')
      setMutedLocal(Array.isArray(muted) ? muted.filter((id) => typeof id === 'string') : [])
      document.documentElement.dataset.density = localStorage.getItem('hak.density') === 'compact' ? 'compact' : ''
    } catch {
      setReadNoticeIds([])
    }
  }, [session?.userId])

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.top-actions')) return
      setNoticesOpen(false)
      setAccountOpen(false)
      setDesktopNew(false)
    }
    document.addEventListener('mousedown', closeMenus)
    return () => document.removeEventListener('mousedown', closeMenus)
  }, [])

  useEffect(() => {
    if (!session?.token || session.email) return
    let cancelled = false
    api('/api/auth/me', {}, session.token).then((result) => {
      if (cancelled) return
      const user = result.user as { name?: string; email?: string; phone?: string | null; avatar_path?: string | null; notify_overdue?: boolean }
      const next: Session = {
        ...session,
        userName: user.name || session.userName,
        email: user.email ?? '',
        phone: user.phone ?? '',
        avatarPath: user.avatar_path ?? '',
        notifyOverdue: user.notify_overdue !== false,
      }
      writeSession(next)
      setSession(next)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [session?.userId])

  useEffect(() => {
    if (!session) return
    let timer = 0
    let savedTimer = 0
    let running = false
    let queued = false
    const run = async () => {
      if (running) {
        queued = true
        return
      }
        running = true
        try {
          await whenBatchIdle()
          do {
          queued = false
          await syncOnce()
        } while (queued)
      } finally {
        running = false
      }
    }
    const syncOnce = async () => {
      try {
        await whenBatchIdle()
        setStatus('Syncing')
        const rejected: { reason: string }[] = []
        const pending = new Set<string>()
        for (;;) {
          const outbox = await browserQuery<{ op_id: string; table_name: string; record_id: string; payload: string }>('SELECT op_id, table_name, record_id, payload FROM outbox ORDER BY created_at LIMIT 200')
          if (outbox.length === 0) break
          for (const row of outbox) pending.add(row.record_id)
          const pushed = await api('/api/sync/push', {
            method: 'POST',
            body: JSON.stringify({
              ops: outbox.map((row) => ({
                op_id: row.op_id,
                table: row.table_name,
                record_id: row.record_id,
                payload: rowToServer(row.table_name, withoutInlineMedia(JSON.parse(row.payload) as Record<string, unknown>)),
              })),
            }),
          }, session.token)
          rejected.push(...((pushed.rejected as { reason: string }[] | undefined) ?? []))
          const accepted = (pushed.accepted as string[]) ?? []
          if (accepted.length > 0) {
            await browserQuery(`DELETE FROM outbox WHERE op_id IN (${accepted.map(() => '?').join(', ')})`, accepted)
          }
          if (accepted.length === 0) break
        }
        await uploadPendingMedia(session.token)
        let since = (await browserQuery<{ last_seq: number }>('SELECT last_seq FROM sync_state WHERE id = 1'))[0]?.last_seq ?? 0
        for (;;) {
          const pulled = await api(`/api/sync/pull?since=${since}`, {}, session.token)
          const changes = (pulled.changes as { table: string; record_id: string; data: Record<string, unknown> }[]) ?? []
          for (const change of changes) {
            if (pending.has(change.record_id) || !/^[a-z_]+$/.test(change.table)) continue
            const known = new Set((await browserQuery<{ name: string }>(`PRAGMA table_info(${change.table})`)).map((column) => column.name))
            const data = Object.fromEntries(Object.entries(rowFromServer(change.table, change.data)).filter(([column]) => known.has(column)))
            for (const column of ['photo_path', 'receipt_path']) {
              if (!known.has(column)) continue
              const existing = await browserQuery<Record<string, unknown>>(`SELECT ${column} FROM ${change.table} WHERE id = ?`, [change.record_id])
              if (shouldKeepLocalMedia(data[column], existing[0]?.[column])) delete data[column]
            }
            const columns = Object.keys(data)
            if (columns.length === 0) continue
            const updates = columns.filter((column) => column !== 'id').map((column) => `${column} = excluded.${column}`).join(', ')
            await browserQuery(
              `INSERT INTO ${change.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ON CONFLICT(id) DO UPDATE SET ${updates}`,
              columns.map((column) => data[column] ?? null),
            )
          }
          since = Number(pulled.last_seq ?? since)
          await browserQuery('UPDATE sync_state SET last_seq = ? WHERE id = 1', [since])
          if (!pulled.more) break
        }
        await refresh()
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        if (rejected.length > 0) {
          setStatus('Needs attention')
          setNotice(`${rejected.length} change${rejected.length === 1 ? '' : 's'} could not be saved on the server. ${rejected[0]?.reason ?? ''}`.trim())
        } else {
          setNotice('')
          setStatus(`Synced ${time}`)
        }
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.body.status === 'revoked' || error.body.status === 'inactive')) {
          await wipeLocal()
          writeSession(null)
          setSession(null)
          return
        }
        const waiting = await browserQuery('SELECT op_id FROM outbox').catch(() => [])
        const detail = syncFailureNotice(error)
        setNotice(detail)
        setStatus(navigator.onLine ? 'Needs attention' : `Offline with ${waiting.length} waiting`)
      }
    }
    const syncSoon = () => {
      window.clearTimeout(savedTimer)
      savedTimer = window.setTimeout(() => void run(), 2000)
    }
    window.addEventListener('hak-saved', syncSoon)
    window.addEventListener('online', run)
    void run()
    timer = window.setInterval(() => void run(), 10000)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(savedTimer)
      window.removeEventListener('hak-saved', syncSoon)
      window.removeEventListener('online', run)
    }
  }, [session])

  if (!session) return <Login onSuccess={(next, remember) => { writeSession(next, remember); setSession(next) }} />
  if (session.mustChangePassword) {
    return <PasswordChange token={session.token} onDone={() => setSession({ ...session, mustChangePassword: false })} />
  }
  if (twoFactorEnabled && session.mustSetupTwoFactor) {
    return <TwoFactor token={session.token} onDone={() => setSession({ ...session, mustSetupTwoFactor: false })} />
  }
  if (pinEnabled && !unlocked) return <PinGate onUnlock={() => { sessionStorage.setItem('hak.unlocked', 'yes'); setUnlocked(true) }} onLockout={() => { writeSession(null); setSession(null) }} />

  const summary = summarizeTables(tables)
  const showProfit = session.roles.includes('Super Admin') || session.permissions.includes('dashboard.view_profit')
  const today = lisbonToday()
  const openInvoices = tables.customers.flatMap((customer) => {
    const statement = customerStatement(tables, String(customer.id), today)
    return statement.invoices.filter((invoice) => invoice.openCents > 0).map((invoice) => ({ id: invoice.invoiceNo, label: statement.shop, date: invoice.date }))
  })
  const showOverdue = session.notifyOverdue !== false
  const mutedNotices = [...(showOverdue ? [] : ['invoice_overdue']), ...mutedLocal]
  const notices = unreadNotices(trackerNotices({
    stock: summary.stock,
    openInvoices,
    today,
    canSeeStock: session.roles.includes('Super Admin') || session.permissions.includes('products.view'),
    muted: mutedNotices,
    overdueDays: settingNumber(tables.settings, 'overdue_days', 30),
    followUps: tables.follow_ups.map((row) => ({ id: String(row.id), title: String(row.title ?? 'Follow-up'), due: String(row.due_at ?? ''), done: Boolean(row.done_at) })),
    payments: tables.customer_payments.map((row) => ({
      id: String(row.id),
      label: String(tables.customers.find((shop) => shop.id === row.customer_id)?.shop_name ?? 'A shop'),
      amountCents: Number(row.amount ?? 0),
      date: String(row.created_at ?? '').slice(0, 10),
    })),
  }), readNoticeIds, today)
  const rememberRead = (ids: string[]) => {
    setReadNoticeIds(ids)
    localStorage.setItem(noticeReadKey(session.userId), JSON.stringify(ids))
  }
  const markOneNotice = (id: string) => rememberRead(markNoticeRead(readNoticeIds, id, today))
  const markEveryNotice = () => rememberRead(markAllNoticesRead(readNoticeIds, notices, today))
  const noticeHref = (item: { id: string; kind: string; text: string }) => {
    if (item.kind === 'follow_up') return '/follow-ups'
    if (item.kind === 'large_payment') return '/payments'
    if (item.kind === 'low_stock' || item.kind === 'out_of_stock') {
      const code = item.text.split(' is ')[0]
      const product = tables.products.find((row) => String(row.code) === code)
      return product ? `/products?product=${product.id}` : '/products'
    }
    const invoiceNo = item.id.replace(/^due-/, '')
    const sale = tables.sales.find((row) => String(row.invoice_no) === invoiceNo)
    return sale ? `/sales?invoice=${sale.id}` : '/sales'
  }
  const saveSession = (next: Session) => {
    writeSession(next)
    setSession(next)
  }
  const setOverdueNotices = async (show: boolean) => {
    const result = await api('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ notify_overdue: show }),
    }, session.token)
    const user = result.user as { notify_overdue?: boolean }
    saveSession({ ...session, notifyOverdue: user.notify_overdue !== false })
  }

  const menu = visibleMenu(session.permissions, session.roles.includes('Super Admin'))
  const needle = query.trim().toLowerCase()
  const found = needle === '' ? [] : [
    ...tables.products.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(needle)).slice(0, 5).map((row) => ({ id: String(row.id), kind: 'Product', label: `${row.code} ${row.name}`, to: `/products?product=${row.id}`, saleTo: '' })),
    ...tables.customers.filter((row) => String(row.shop_name ?? '').toLowerCase().includes(needle)).slice(0, 5).map((row) => ({ id: String(row.id), kind: 'Shop', label: String(row.shop_name), to: `/customers/${row.id}`, saleTo: `/sales?new=1&customer=${row.id}` })),
    ...tables.sales.filter((row) => String(row.invoice_no ?? '').toLowerCase().includes(needle)).slice(0, 5).map((row) => ({ id: String(row.id), kind: 'Invoice', label: String(row.invoice_no), to: `/sales?invoice=${row.id}`, saleTo: '' })),
  ].slice(0, 8)
  const newLinks = [
    ['Sale', '/sales?new=1'],
    ['Payment', '/payments?new=1'],
    ['Customer', '/customers?new=1'],
    ['Product', '/products?new=1'],
    ['Purchase', '/purchases?new=1'],
    ['Expense', '/expenses?new=1'],
    ['Follow-up', '/follow-ups?new=1'],
  ] as const
  const signOut = () => { sessionStorage.removeItem('hak.unlocked'); writeSession(null); setSession(null); setUnlocked(false) }

  const menuCollapsed = sidebarCollapsed(sidebarWidth)
  const brand = documentBrand(tables.settings)
  const resizeSidebar = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.type === 'pointerdown') {
      sidebarDrag.current = { startX: event.clientX, startW: sidebarWidth }
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer capture is optional */ }
      return
    }
    const drag = sidebarDrag.current
    if (!drag) return
    const next = storedSidebarWidth(String(drag.startW + event.clientX - drag.startX))
    setSidebarWidth(next)
    if (event.type === 'pointerup' || event.type === 'pointercancel') {
      sidebarDrag.current = null
      localStorage.setItem('hak.sidebarWidth', String(next))
    }
  }

  return (
    <div className="app-shell" style={{ ['--sidebar-width' as string]: `${sidebarWidth}px` }}>
      <aside className="sidebar" data-collapsed={menuCollapsed ? 'true' : 'false'}>
        <div className="brand">
          {brand.logo ? <img className="brand-logo" src={brand.logo} alt="" /> : <span className="mark" aria-hidden="true"><i /><i /></span>}
          <p className={`brand-name${menuCollapsed ? ' sr-only' : ''}`}>{brand.name}</p>
        </div>
        <p className={`menu-label${menuCollapsed ? ' sr-only' : ''}`}>Menu</p>
        <nav className="nav" aria-label="Menu">
          {menu.map((item) => {
            const Icon = menuIcons[item.label] ?? LayoutDashboard
            return (
              <NavLink key={item.path} to={item.path} end={item.path === '/'} aria-label={item.label} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <Icon aria-hidden="true" strokeWidth={1.75} />
                <span className={menuCollapsed ? 'sr-only' : undefined}>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
        <div
          className="sidebar-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize menu"
          aria-valuemin={76}
          aria-valuemax={420}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={resizeSidebar}
          onPointerMove={resizeSidebar}
          onPointerUp={resizeSidebar}
          onPointerCancel={resizeSidebar}
          onDoubleClick={() => {
            const next = menuCollapsed ? 290 : 76
            setSidebarWidth(next)
            localStorage.setItem('hak.sidebarWidth', String(next))
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            const next = storedSidebarWidth(String(sidebarWidth + (event.key === 'ArrowRight' ? 24 : -24)))
            setSidebarWidth(next)
            localStorage.setItem('hak.sidebarWidth', String(next))
          }}
        />
      </aside>
      <div className="workspace">
        <header className="topbar">
          <label className="search">
            <Search aria-hidden="true" size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a product, shop or invoice" aria-label="Find a record" />
            {found.length > 0 && (
              <ul className="find-results">
                {found.map((item) => (
                  <li key={item.id}>
                    <span className="kind">{item.kind}</span>
                    <button type="button" role="option" onClick={() => { setQuery(''); navigate(item.to) }}>{item.label}</button>
                    {item.saleTo && <button type="button" onClick={() => { setQuery(''); navigate(item.saleTo) }}>New sale</button>}
                  </li>
                ))}
              </ul>
            )}
          </label>
          <div className="top-actions">
            <div className="account">
              <button type="button" className="btn" aria-expanded={desktopNew} aria-haspopup="menu" onClick={() => { setNoticesOpen(false); setAccountOpen(false); setDesktopNew((open) => !open) }}>New</button>
              {desktopNew && (
                <div className="new-menu" role="menu" aria-label="New">
                  {newLinks.map(([label, to]) => <Link key={to} to={to} role="menuitem" onClick={() => setDesktopNew(false)}>{label}</Link>)}
                </div>
              )}
            </div>
            <p className={`status ${statusTone(status)}`}><i />{status}{notice ? ` · ${notice}` : ''}</p>
            <div className="account">
              <button type="button" className="icon-btn" aria-label="Notifications" aria-expanded={noticesOpen} onClick={() => { setAccountOpen(false); setNoticesOpen((open) => !open) }}>
                <Bell size={18} />
                {notices.length > 0 && <span className="count">{notices.length}</span>}
              </button>
              {noticesOpen && (
                <div className="user-menu notice-menu" role="region" aria-label="Notices">
                  <div className="notice-head">
                    <p className="user-name">Notices</p>
                    <button type="button" className="btn-ghost notice-read" disabled={notices.length === 0} onClick={markEveryNotice}>Mark all as read</button>
                  </div>
                  <p className="quiet">Stock warnings and invoices that are past due.</p>
                  {notices.length === 0 && <p className="quiet">Nothing needs attention.</p>}
                  {notices.map((item) => (
                    <div className="notice-row" key={item.id}>
                      <Link to={noticeHref(item)} onClick={() => setNoticesOpen(false)}>{item.text}</Link>
                      <button type="button" className="btn-ghost notice-read" aria-label={`Mark ${item.text} as read`} onClick={() => markOneNotice(item.id)}>Read</button>
                    </div>
                  ))}
                  <label className="check">
                    <input type="checkbox" checked={showOverdue} onChange={(event) => void setOverdueNotices(event.target.checked)} />
                    Show overdue invoices
                  </label>
                </div>
              )}
            </div>
            <div className="account">
              <button type="button" className="user-chip" aria-label={`Account, ${session.userName}`} aria-expanded={accountOpen} onClick={() => { setNoticesOpen(false); setAccountOpen((open) => !open) }}>
                <AccountAvatar session={session} />
                {session.userName}
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {accountOpen && (
                <div className="user-menu" role="region" aria-label="Account">
                  <p className="user-name">{session.userName}</p>
                  {session.email && <p className="user-role">{session.email}</p>}
                  {session.phone && <p className="user-role">{session.phone}</p>}
                  <p className="user-role">{session.roles.join(' · ')}</p>
                  <button type="button" className="sign-out" onClick={() => { setAccountOpen(false); setProfileOpen(true) }}>Profile</button>
                  <button type="button" className="sign-out" onClick={signOut}><LogOut size={16} aria-hidden="true" /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">
        <ModuleBody ready={booksReady}>
        <Routes>
          <Route path="/" element={<Dashboard tables={tables} showProfit={showProfit} canBackup={session.roles.includes('Super Admin')} notices={notices.map((item) => ({ ...item, href: noticeHref(item) }))} onMarkRead={markOneNotice} onMarkAllRead={markEveryNotice} />} />
          <Route path="/products" element={<Guard session={session} path="/products"><Products tables={tables} token={session.token} canManage={session.roles.includes('Super Admin') || session.permissions.includes('products.manage')} canAdjust={session.roles.includes('Super Admin') || session.permissions.includes('stock.adjust')} canSeeCost={session.roles.includes('Super Admin') || session.permissions.includes('products.view_cost')} onSaved={refresh} /></Guard>} />
          <Route path="/sales" element={<Guard session={session} path="/sales"><SalesScreen tables={tables} prefix={session.invoicePrefix} userId={session.userId} userName={session.userName} isSuperAdmin={session.roles.includes('Super Admin')} canManageSales={session.permissions.includes('sales.manage')} canEditOwn={session.permissions.includes('sales.edit_own')} onSaved={refresh} /></Guard>} />
          <Route path="/customers" element={<Guard session={session} path="/customers"><SimpleEntry title="Customers" table="customers" fields={['shop_name', 'contact', 'phone', 'whatsapp', 'nif', 'city', 'postcode', 'email', 'address', 'shop_type', 'tags', 'payment_terms', 'credit_limit', 'notes']} onSaved={refresh} rows={tables.customers} canManage={session.roles.includes('Super Admin') || session.permissions.includes('customers.manage')} isSuperAdmin={session.roles.includes('Super Admin')} canMerge={session.roles.includes('Super Admin')} sales={tables.sales} lines={tables.sale_lines} allocations={tables.payment_allocations} payments={tables.customer_payments} /></Guard>} />
          <Route path="/customers/:id" element={<Guard session={session} path="/customers"><Customer360 tables={tables} canManage={session.roles.includes('Super Admin') || session.permissions.includes('customers.manage')} isSuperAdmin={session.roles.includes('Super Admin')} onSaved={refresh} /></Guard>} />
          <Route path="/pipeline" element={<Guard session={session} path="/pipeline"><Pipeline tables={tables} canManage={session.roles.includes('Super Admin') || session.permissions.includes('customers.manage')} onSaved={refresh} /></Guard>} />
          <Route path="/follow-ups" element={<Guard session={session} path="/follow-ups"><FollowUps tables={tables} canManage={session.roles.includes('Super Admin') || session.permissions.includes('customers.manage')} onSaved={refresh} /></Guard>} />
          <Route path="/calendar" element={<Guard session={session} path="/calendar"><CalendarScreen tables={tables} /></Guard>} />
          <Route path="/suppliers" element={<Guard session={session} path="/suppliers"><SimpleEntry title="Suppliers" table="suppliers" fields={['name', 'first_name', 'last_name', 'email', 'phone', 'whatsapp', 'nif', 'address', 'home_address', 'country']} onSaved={refresh} rows={tables.suppliers} canManage={session.roles.includes('Super Admin') || session.permissions.includes('suppliers.manage')} isSuperAdmin={session.roles.includes('Super Admin')} balanceOf={(row) => supplierMoney({ supplierId: String(row.id), purchases: tables.purchases, lines: tables.purchase_lines, payments: tables.supplier_payments }).owedCents} detail={(row) => {
            const money = supplierMoney({ supplierId: String(row.id), purchases: tables.purchases, lines: tables.purchase_lines, payments: tables.supplier_payments })
            return (
              <span className="balance-bits">
                <span>Purchased {centsToEuros(money.purchasedCents)}</span>
                <span>Paid {centsToEuros(money.paidCents)}</span>
                <span className={money.owedCents > 0 ? 'owe' : 'settled'}>We owe {centsToEuros(money.owedCents)}</span>
              </span>
            )
          }} previewExtra={(row) => {
            const purchases = tables.purchases.filter((purchase) => purchase.supplier_id === row.id)
            const purchaseIds = new Set(purchases.map((purchase) => purchase.id))
            const orders = purchaseLedgerRows({ purchases, lines: tables.purchase_lines.filter((line) => purchaseIds.has(line.purchase_id)) })
            const paid = tables.supplier_payments.filter((payment) => payment.supplier_id === row.id)
            return (
              <ul className="record-list">
                {orders.map((line, index) => <li key={`${line.productId}-${index}`}>Order · {String(tables.products.find((product) => product.id === line.productId)?.code ?? 'Product')} · {line.qty} ordered · {centsToEuros(line.unitCostCents)} landed</li>)}
                {paid.map((payment) => <li key={String(payment.id)}>Payment · {centsToEuros(Number(payment.amount_eur ?? payment.amount))}</li>)}
                {orders.length === 0 && paid.length === 0 && <li>No orders or payments</li>}
              </ul>
            )
          }} /></Guard>} />
          <Route path="/purchases" element={<Guard session={session} path="/purchases"><PurchaseScreen tables={tables} canManage={session.roles.includes('Super Admin') || session.permissions.includes('purchases.manage')} onSaved={refresh} /></Guard>} />
          <Route path="/payments" element={<Guard session={session} path="/payments"><PaymentEntry tables={tables} canManage={session.roles.includes('Super Admin') || session.permissions.includes('payments.manage')} canManagePurchases={session.roles.includes('Super Admin') || session.permissions.includes('purchases.manage')} onSaved={refresh} /></Guard>} />
          <Route path="/expenses" element={<Guard session={session} path="/expenses"><ExpenseEntry tables={tables} token={session.token} canManage={session.roles.includes('Super Admin') || session.permissions.includes('expenses.manage')} onSaved={refresh} /></Guard>} />
          <Route path="/transfers" element={<Guard session={session} path="/transfers"><TransferEntry tables={tables} canManage={session.roles.includes('Super Admin') || session.permissions.includes('transfers.manage')} onSaved={refresh} /></Guard>} />
          <Route path="/reports" element={<Guard session={session} path="/reports"><ReportsScreen tables={tables} showProfit={showProfit} /></Guard>} />
          <Route path="/activity" element={<Guard session={session} path="/activity"><ActivityScreen token={session.token} /></Guard>} />
          <Route path="/settings" element={<Guard session={session} path="/settings"><SettingsScreen tables={tables} onSaved={refresh} onLoadSample={session.roles.includes('Super Admin') ? async () => { await loadGoldenSample(session.token); await refresh() } : undefined} onImport={session.roles.includes('Super Admin') ? async (bytes) => { await replaceBusinessData(session.token, tablesFromWorkbook(bytes)); await refresh() } : undefined} /></Guard>} />
          <Route path="/admin/users" element={<Guard session={session} path="/admin/users"><Admin token={session.token} /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ModuleBody>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Primary">
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/sales">Sales</NavLink>
        <button type="button" onClick={() => { setMoreOpen(false); setNewOpen((open) => !open) }}>New</button>
        <NavLink to="/customers">Customers</NavLink>
        <button type="button" onClick={() => { setNewOpen(false); setMoreOpen((open) => !open) }}>More</button>
      </nav>
      {newOpen && (
        <div className="bottom-sheet" role="menu" aria-label="New">
          <Link to="/sales" onClick={() => setNewOpen(false)}>New sale</Link>
          <Link to="/payments" onClick={() => setNewOpen(false)}>New payment</Link>
          <Link to="/customers" onClick={() => setNewOpen(false)}>New customer</Link>
        </div>
      )}
      {moreOpen && (
        <div className="bottom-sheet" aria-label="More">
          {menu.filter((item) => !['Dashboard', 'Sales', 'Customers'].includes(item.label)).map((item) => (
            <NavLink key={item.path} to={item.path} onClick={() => setMoreOpen(false)}>{item.label}</NavLink>
          ))}
        </div>
      )}
      <ProfileDialog session={session} open={profileOpen} muted={mutedLocal} onClose={() => setProfileOpen(false)} onSaved={saveSession} onMute={setMutedLocal} />
      <UndoToast />
    </div>
  )
}

function AccountAvatar({ session }: { session: Session }) {
  if (session.avatarPath) {
    return <span className="avatar"><RecordImage path={session.avatarPath} token={session.token} alt="" /></span>
  }
  return <span className="avatar">{session.userName.slice(0, 1)}</span>
}

function ProfileDialog({ session, open, muted, onClose, onSaved, onMute }: { session: Session; open: boolean; muted: string[]; onClose: () => void; onSaved: (next: Session) => void; onMute: (kinds: string[]) => void }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    const nextMuted = ['low_stock', 'follow_up', 'large_payment'].filter((kind) => form.get(`mute_${kind}`) === 'on')
    localStorage.setItem(`hak.notice.mute.${session.userId}`, JSON.stringify(nextMuted))
    onMute(nextMuted)
    document.documentElement.dataset.density = form.get('compact') === 'on' ? 'compact' : ''
    localStorage.setItem('hak.density', form.get('compact') === 'on' ? 'compact' : '')
    setSaving(true)
    setError('')
    try {
      if (password) {
        await api('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ password, password_confirmation: form.get('password_confirmation') }),
        }, session.token)
      }
      const result = await api('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          phone: String(form.get('phone') ?? '') || null,
          notify_overdue: form.get('notify_overdue') === 'on',
        }),
      }, session.token)
      const file = form.get('avatar')
      let avatarPath = session.avatarPath
      if (file instanceof File && file.size > 0) {
        const body = new FormData()
        body.set('table', 'users')
        body.set('record_id', session.userId)
        body.set('file', file)
        const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${session.token}` })
        const response = await fetch('/api/files', { method: 'POST', headers, body })
        const uploaded = await response.json().catch(() => ({})) as { path?: string; message?: string }
        if (!response.ok || !uploaded.path) throw new Error(uploaded.message ?? 'The photo could not be saved.')
        avatarPath = uploaded.path
      }
      const user = result.user as { name: string; email: string; phone?: string | null; notify_overdue?: boolean }
      onSaved({
        ...session,
        userName: user.name,
        email: user.email,
        phone: user.phone ?? '',
        avatarPath,
        notifyOverdue: user.notify_overdue !== false,
      })
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popup title="Profile" open={open} onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
        <label>Name<input className="control" name="name" aria-label="Name" defaultValue={session.userName} required /></label>
        <label>Email<input className="control" name="email" type="email" aria-label="Email" defaultValue={session.email} required /></label>
        <label>Phone<input className="control" name="phone" aria-label="Phone" defaultValue={session.phone} /></label>
        <label>Photo<input className="control" name="avatar" type="file" accept="image/*" aria-label="Photo" /></label>
        <label>New password<input className="control" name="password" type="password" aria-label="New password" autoComplete="new-password" minLength={10} /></label>
        <label>Confirm password<input className="control" name="password_confirmation" type="password" aria-label="Confirm password" autoComplete="new-password" /></label>
        <label className="check">
          <input type="checkbox" name="notify_overdue" defaultChecked={session.notifyOverdue !== false} />
          Show overdue invoices
        </label>
        <label className="check"><input type="checkbox" name="mute_low_stock" defaultChecked={muted.includes('low_stock')} /> Hide low-stock alerts</label>
        <label className="check"><input type="checkbox" name="mute_follow_up" defaultChecked={muted.includes('follow_up')} /> Hide follow-up alerts</label>
        <label className="check"><input type="checkbox" name="mute_large_payment" defaultChecked={muted.includes('large_payment')} /> Hide large-payment alerts</label>
        <label className="check"><input type="checkbox" name="compact" defaultChecked={localStorage.getItem('hak.density') === 'compact'} /> Compact tables</label>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit" disabled={saving}>Save profile</button>
      </form>
    </Popup>
  )
}

function ModuleBody({ ready, children }: { ready: boolean; children: ReactNode }) {
  const { pathname } = useLocation()
  if (!ready) return <PageSkeleton kind={skeletonKindForPath(pathname)} />
  return children
}

function Guard({ session, path, children }: { session: Session; path: string; children: ReactNode }) {
  if (!canAccess(path, session.permissions, session.roles.includes('Super Admin'))) return <Navigate to="/" replace />
  return children
}

function Login({ onSuccess }: { onSuccess: (session: Session, remember: boolean) => void }) {
  const [error, setError] = useState('')
  const [otp, setOtp] = useState('')
  const [needsOtp, setNeedsOtp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const result = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
          device_name: 'Browser',
          platform: 'web',
          app_version: '1.0.0',
          otp: otp || undefined,
        }),
      })
      const user = result.user as { id: string; name: string; email?: string; phone?: string | null; avatar_path?: string | null; notify_overdue?: boolean; roles: string[] }
      const device = result.device as { id: string; invoice_prefix: string }
      onSuccess({
        token: String(result.token),
        permissions: result.permissions as string[],
        roles: user.roles,
        userName: user.name,
        email: user.email ?? '',
        phone: user.phone ?? '',
        avatarPath: user.avatar_path ?? '',
        notifyOverdue: user.notify_overdue !== false,
        userId: user.id,
        mustChangePassword: Boolean(result.must_change_password),
        mustSetupTwoFactor: twoFactorEnabled && Boolean(result.must_setup_two_factor),
        invoicePrefix: device.invoice_prefix,
        deviceId: device.id,
      }, form.get('remember') === 'on')
    } catch (caught) {
      if (caught instanceof ApiError && caught.body.two_factor_required) {
        setNeedsOtp(true)
        setError('Enter the code from your authenticator app.')
        return
      }
      setError(caught instanceof Error ? caught.message : 'Login failed')
    }
  }

  return (
    <div className="gate">
      <section className="gate-hero">
        <p className="eyebrow">Lisbon · Wholesale</p>
        <h2>The counter, kept to the cent.</h2>
        <p>Stock, balances, and profit are read from the ledger. Nothing on this screen is typed in as a total.</p>
      </section>
      <form onSubmit={submit} className="gate-card">
        <h1>HAK Wholesales</h1>
        <p className="lede">Sign in on this device. The books stay here first, then sync.</p>
        <input name="email" type="email" required placeholder="Email" aria-label="Email" className="control" />
        <div className="secret-field">
          <input name="password" type={showPassword ? 'text' : 'password'} required placeholder="Password" aria-label="Password" className="control" />
          <button type="button" className="eye" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)}>
            {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
          </button>
        </div>
        {needsOtp && <input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Authenticator code" aria-label="Authenticator code" className="control" />}
        <label className="check"><input name="remember" type="checkbox" /> Remember me</label>
        {error && <p className="error">{error}</p>}
        <button className="btn">Log in</button>
      </form>
    </div>
  )
}

function PasswordChange({ token, onDone }: { token: string; onDone: () => void }) {
  const [error, setError] = useState('')
  return (
    <div className="gate">
      <section className="gate-hero">
        <p className="eyebrow">HAK Wholesales</p>
        <h2>A new password before the books.</h2>
        <p>This account cannot continue until the temporary password is replaced.</p>
      </section>
      <form className="gate-card" onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        try {
          await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ password: form.get('password'), password_confirmation: form.get('password_confirmation') }) }, token)
          onDone()
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Could not change password')
        }
      }}>
        <h1>Choose a new password</h1>
        <input name="password" type="password" minLength={10} required placeholder="New password" aria-label="New password" className="control" />
        <input name="password_confirmation" type="password" minLength={10} required placeholder="Confirm password" aria-label="Confirm password" className="control" />
        {error && <p className="error">{error}</p>}
        <button className="btn">Save password</button>
      </form>
    </div>
  )
}

function TwoFactor({ token, onDone }: { token: string; onDone: () => void }) {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    api('/api/auth/two-factor/setup', { method: 'POST' }, token).then((result) => setSecret(String(result.secret))).catch(() => setError('Could not start two-factor setup'))
  }, [token])
  return (
    <div className="gate">
      <section className="gate-hero">
        <p className="eyebrow">HAK Wholesales</p>
        <h2>Two keys for the partners.</h2>
        <p>Super admins and partners confirm each sign-in with an authenticator code.</p>
      </section>
      <form className="gate-card" onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        try {
          await api('/api/auth/two-factor/confirm', { method: 'POST', body: JSON.stringify({ code: form.get('code') }) }, token)
          onDone()
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Code was not accepted')
        }
      }}>
        <h1>Set up two-factor login</h1>
        <p className="lede">Add this secret to your authenticator app, then enter the 6-digit code.</p>
        <code className="secret" data-testid="totp-secret">{secret}</code>
        <input name="code" required aria-label="Authenticator code" inputMode="numeric" className="control pin-input" />
        {error && <p className="error">{error}</p>}
        <button className="btn">Confirm</button>
      </form>
    </div>
  )
}

function PinGate({ onUnlock, onLockout }: { onUnlock: () => void; onLockout: () => void }) {
  const [mode, setMode] = useState<'set' | 'enter'>('enter')
  const [error, setError] = useState('')

  useEffect(() => {
    browserQuery<{ pin_hash: string | null }>('SELECT pin_hash FROM sync_state WHERE id = 1')
      .then((rows) => setMode(rows[0]?.pin_hash ? 'enter' : 'set'))
      .catch(() => setError('Open the app online once before using the PIN.'))
  }, [])

  return (
    <div className="gate">
      <section className="gate-hero">
        <p className="eyebrow">HAK Wholesales</p>
        <h2>This device stays locked.</h2>
        <p>The PIN opens the books already stored on this browser. It is not your account password.</p>
      </section>
      <form className="gate-card" onSubmit={async (event) => {
      event.preventDefault()
      const pin = String(new FormData(event.currentTarget).get('pin') ?? '')
      if (!/^\d{6}$/.test(pin)) {
        setError('Use a 6-digit PIN.')
        return
      }
      const rows = await browserQuery<{ pin_hash: string | null; pin_salt: string | null; pin_attempts: number }>('SELECT pin_hash, pin_salt, pin_attempts FROM sync_state WHERE id = 1')
      const state = rows[0]
      if (mode === 'set' || !state?.pin_hash) {
        const salt = crypto.randomUUID()
        await browserQuery('UPDATE sync_state SET pin_hash = ?, pin_salt = ?, pin_attempts = 0 WHERE id = 1', [await hashPin(pin, salt), salt])
        onUnlock()
        return
      }
      if ((state.pin_attempts ?? 0) >= 5) {
        onLockout()
        return
      }
      if ((await hashPin(pin, String(state.pin_salt))) === state.pin_hash) {
        await browserQuery('UPDATE sync_state SET pin_attempts = 0 WHERE id = 1')
        onUnlock()
        return
      }
      const attempts = Number(state.pin_attempts ?? 0) + 1
      await browserQuery('UPDATE sync_state SET pin_attempts = ? WHERE id = 1', [attempts])
      if (attempts >= 5) onLockout()
      else setError('Wrong PIN.')
    }}>
        <h1>{mode === 'set' ? 'Set a 6-digit PIN' : 'Enter your PIN'}</h1>
        <input name="pin" inputMode="numeric" maxLength={6} required aria-label="PIN" className="control pin-input" />
        {error && <p className="error">{error}</p>}
        <button className="btn">{mode === 'set' ? 'Save PIN' : 'Unlock'}</button>
      </form>
    </div>
  )
}

function Dashboard({ tables, showProfit, canBackup = false, notices = [], onMarkRead, onMarkAllRead }: {
  tables: LocalTables
  showProfit: boolean
  canBackup?: boolean
  notices?: { id: string; text: string; href: string }[]
  onMarkRead?: (id: string) => void
  onMarkAllRead?: () => void
}) {
  const [backupError, setBackupError] = useState('')
  const [history, setHistory] = useState<{ at: string; name: string; status: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('hak.backupHistory') ?? '[]') } catch { return [] }
  })
  const [period, setPeriod] = useState<DashboardPeriod>('twelve')
  const [from, setFrom] = useState(() => `${lisbonToday().slice(0, 7)}-01`)
  const [to, setTo] = useState(() => lisbonToday())
  const view = dashboardView(tables, period, lisbonToday(), period === 'custom' ? { start: from, end: to } : undefined)
  const downloadBackup = () => {
    const bytes = tablesToWorkbook(tables)
    let checked = false
    try { checked = summarizeTables(tablesFromWorkbook(bytes)).revenueCents === summarizeTables(tables).revenueCents } catch { checked = false }
    if (!checked) { setBackupError('The backup could not be checked.'); return }
    setBackupError('')
    const name = backupName(lisbonToday())
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
    const next = [{ at: new Date().toISOString(), name, status: 'Downloaded' }, ...history].slice(0, 12)
    localStorage.setItem('hak.backupHistory', JSON.stringify(next))
    setHistory(next)
  }
  return (
    <section className="page insight-page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="lede">Figures below are calculated from purchases, sales, payments, and adjustments.</p>
        </div>
        <label className="control-line period-pick">Period
          <select aria-label="Period" className="control" value={period} onChange={(event) => setPeriod(event.target.value as DashboardPeriod)}>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="last">Last month</option>
            <option value="quarter">This quarter</option>
            <option value="year">This year</option>
            <option value="twelve">Last 12 months</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
      </div>
      {period === 'custom' && (
        <div className="filters">
          <label className="control-line">From
            <input aria-label="From" type="date" className="control" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="control-line">To
            <input aria-label="To" type="date" className="control" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      )}
      {backupError && <p className="error">{backupError}</p>}
      <section className="panel alert-panel" aria-label="Alerts">
        <div className="notice-head">
          <h2>Alerts</h2>
          <button type="button" className="btn-ghost notice-read" disabled={notices.length === 0} onClick={onMarkAllRead}>Mark all as read</button>
        </div>
        {notices.length === 0 && <p className="quiet">Nothing needs attention.</p>}
        {notices.length > 0 && (
          <ul className="record-list">
            {notices.map((item) => (
              <li key={item.id}>
                <Link to={item.href}>{item.text}</Link>
                <button type="button" className="btn-ghost notice-read" aria-label={`Mark ${item.text} as read`} onClick={() => onMarkRead?.(item.id)}>Read</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <h2 className="section-label">This period</h2>
      <div className="metrics">
        <Card label="Sales" to="/sales" value={centsToEuros(view.revenueCents)} note={`Previous period ${centsToEuros(view.previousRevenueCents)}`} tone="brand" />
        {showProfit && <Card label="Net profit" value={centsToEuros(view.netProfitCents)} note={`Previous period ${centsToEuros(view.previousNetProfitCents)}`} tone={view.netProfitCents >= 0 ? 'ok' : 'danger'} />}
        {showProfit && <Card label="Margin" value={`${view.marginPercent}%`} tone={view.marginPercent >= 0 ? 'ok' : 'danger'} />}
        {showProfit && <Card label="Expenses" value={centsToEuros(view.expenseCents)} tone="danger" />}
        {showProfit && <Card label="Cash in" value={centsToEuros(view.cashInCents)} tone="ok" />}
        {showProfit && <Card label="Cash out" value={centsToEuros(view.cashOutCents)} tone="danger" />}
        {showProfit && <Card label="Net cash" value={centsToEuros(view.netCashCents)} tone={view.netCashCents >= 0 ? 'ok' : 'danger'} />}
      </div>
      <h2 className="section-label">Right now</h2>
      <div className="metrics">
        <Card label="Customers owe" to="/customers?owes=1" value={centsToEuros(view.customersOweCents)} tone={view.customersOweCents > 0 ? 'danger' : 'ok'} />
        <Card label="We owe suppliers" to="/suppliers" value={centsToEuros(view.suppliersOweCents)} tone={view.suppliersOweCents > 0 ? 'danger' : 'ok'} />
        <Card label="Stock value" to="/products" value={centsToEuros(view.stockValueCents)} tone="brand" />
        {showProfit && <Card label="Total investment" value={centsToEuros(view.investmentCents)} tone="brand" />}
      </div>
      {view.revenueCents === 0 && <p className="quiet">No sales in this period. <Link to="/sales?new=1">Record a sale</Link></p>}
      <div className="split">
        {showProfit && (
          <div className="panel partner-panel">
            <h2>Partners</h2>
            <p className="quiet">{view.whoOwesWhom}</p>
            {view.sharesMessage && <p className="warn">{view.sharesMessage}</p>}
            <table className="record-table">
              <caption className="sr-only">Partner shares</caption>
              <thead>
                <tr><th>Partner</th><th>Ownership</th><th>Profit share</th><th>Allocated</th><th>Transfers in</th><th>Transfers out</th></tr>
              </thead>
              <tbody>
                {view.partners.map((partner) => (
                  <tr key={partner.id}>
                    <td>{partner.name}</td>
                    <td>{partner.ownsPercent}%</td>
                    <td>{partner.profitPercent}%</td>
                    <td className="num">{centsToEuros(partner.shareCents)}</td>
                    <td className="num">{centsToEuros(partner.transferInCents)}</td>
                    <td className="num">{centsToEuros(partner.transferOutCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="panel">
          <h2>Stock</h2>
          {view.stock.filter((item) => item.status === 'LOW' || item.status === 'OUT').length === 0 && <p className="quiet">Stock is OK.</p>}
          <ul className="stock-list">{view.stock.filter((item) => item.status === 'LOW' || item.status === 'OUT').map((item) => {
            const product = tables.products.find((row) => String(row.code) === item.code)
            const label = `${item.code}: ${item.qty} pcs ${item.status}`
            const since = addDays(lisbonToday(), -30)
            const sold = tables.sale_lines.filter((line) => line.product_id === product?.id && String(tables.sales.find((sale) => sale.id === line.sale_id)?.date ?? '') >= since).reduce((sum, line) => sum + Number(line.qty), 0)
            const ordered = tables.purchase_lines.filter((line) => line.product_id === product?.id).reduce((sum, line) => sum + onOrderQty(Number(line.qty), line.qty_received == null || line.qty_received === '' ? Number(line.qty) : Number(line.qty_received)), 0)
            const suggest = product ? reorderSuggestion(sold, item.qty, ordered) : 0
            return <li key={item.code} data-status={item.status}>{product ? <Link to={`/products?product=${product.id}`}>{label}</Link> : label}{suggest > 0 && product ? <> · <Link to={`/purchases?new=1&product=${product.id}`}>Reorder {suggest}</Link></> : null}</li>
          })}</ul>
          <Link to="/products">All products</Link>
        </div>
      </div>
      <div className="split">
        <div className="panel">
          <h2>Next 7 days</h2>
          <ul className="record-list">
            {tables.follow_ups.filter((row) => !row.done_at && dueWithin(String(row.due_at ?? ''), lisbonToday(), 7)).map((row) => (
              <li key={String(row.id)}><Link to="/follow-ups">{String(row.title)} · {String(row.due_at).slice(0, 10)}</Link></li>
            ))}
            {invoiceStandings({
              sales: tables.sales.map((sale) => ({ id: String(sale.id), invoice_no: String(sale.invoice_no ?? ''), customer_id: String(sale.customer_id), date: sale.date == null ? null : String(sale.date) })),
              lines: tables.sale_lines.map((line) => ({ sale_id: String(line.sale_id), qty: Number(line.qty), unit_price: Number(line.unit_price), discount: Number(line.discount ?? 0) })),
              allocations: tables.payment_allocations.map((row) => ({ sale_id: String(row.sale_id), amount: Number(row.amount) })),
              today: lisbonToday(),
              overdueDays: settingNumber(tables.settings, 'overdue_days', 30),
            }).filter((invoice) => invoice.status !== 'Paid' && dueWithin(dueOn(invoice.date, settingNumber(tables.settings, 'overdue_days', 30)), lisbonToday(), 7)).map((invoice) => (
              <li key={invoice.id}><Link to={`/sales?invoice=${invoice.id}`}>{invoice.invoiceNo} due {dueOn(invoice.date, settingNumber(tables.settings, 'overdue_days', 30))}</Link></li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <h2>Recent invoices</h2>
          <ul className="record-list">
            {[...tables.sales].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))).slice(0, 10).map((sale) => {
              const standing = invoiceStandings({
                sales: [{ id: String(sale.id), invoice_no: String(sale.invoice_no ?? ''), customer_id: String(sale.customer_id), date: sale.date == null ? null : String(sale.date) }],
                lines: tables.sale_lines.filter((line) => line.sale_id === sale.id).map((line) => ({ sale_id: String(line.sale_id), qty: Number(line.qty), unit_price: Number(line.unit_price), discount: Number(line.discount ?? 0) })),
                allocations: tables.payment_allocations.filter((row) => row.sale_id === sale.id).map((row) => ({ sale_id: String(row.sale_id), amount: Number(row.amount) })),
                today: lisbonToday(),
              })[0]
              return <li key={String(sale.id)}><Link to={`/sales?invoice=${sale.id}`}>{String(sale.invoice_no)}</Link> <span data-status={standing?.status}>{standing?.status}</span></li>
            })}
          </ul>
        </div>
      </div>
      {showProfit && (
        <div className="panel">
          <h2>Settle up</h2>
          {settleTransfers(view.partners).length === 0 && <p className="quiet">Partners are settled.</p>}
          <ul className="record-list">
            {settleTransfers(view.partners).map((move) => (
              <li key={`${move.fromId}-${move.toId}`}>
                <span>{move.fromName} pays {move.toName} {centsToEuros(move.amountCents)}</span>
                <Link className="btn-ghost" to={`/transfers?new=1&from=${move.fromId}&to=${move.toId}&amount=${move.amountCents}`}>Record</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="split">
        <div className="panel">
          <h2>Sales by category</h2>
          <ul className="record-list">
            {(() => {
              const totals = new Map<string, number>()
              for (const line of tables.sale_lines) {
                const sale = tables.sales.find((row) => row.id === line.sale_id)
                const date = String(sale?.date ?? '')
                if (date < view.range.start || date > view.range.end) continue
                const product = tables.products.find((row) => row.id === line.product_id)
                const name = String(product?.category || 'Uncategorised')
                totals.set(name, (totals.get(name) ?? 0) + Number(line.qty) * Number(line.unit_price) - Number(line.discount ?? 0))
              }
              return [...totals.entries()].map(([name, cents]) => <li key={name}>{name} · {centsToEuros(cents)}</li>)
            })()}
          </ul>
        </div>
        <div className="panel">
          <h2>Top debtors</h2>
          <ul className="record-list">
            {tables.customers.map((shop) => ({ shop, owed: customerStatement(tables, String(shop.id), lisbonToday()).balanceCents }))
              .filter((row) => row.owed > 0)
              .sort((a, b) => b.owed - a.owed)
              .slice(0, 5)
              .map((row) => (
                <li key={String(row.shop.id)}>
                  <Link to={`/customers/${row.shop.id}`}>{String(row.shop.shop_name)}</Link> · {centsToEuros(row.owed)}
                  {(row.shop.whatsapp || row.shop.phone) && <a className="btn-ghost" href={`${whatsAppLink(String(row.shop.whatsapp || row.shop.phone))}?text=${encodeURIComponent(`${row.shop.shop_name} statement. Balance due ${centsToEuros(row.owed)}.`)}`} target="_blank" rel="noreferrer">Remind</a>}
                </li>
              ))}
          </ul>
        </div>
      </div>
      <div className="panel chart">
        <h2>Sales by month</h2>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={view.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e0e7ff" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <Tooltip cursor={{ fill: 'rgba(49, 46, 129, 0.08)' }} formatter={(value) => centsToEuros(Math.round(Number(value) * 100))} />
            <Legend />
            <Bar dataKey="sales" name="Sales" fill="#312e81" radius={[6, 6, 0, 0]} barSize={18} isAnimationActive={false} />
            <Bar dataKey="profit" name="Profit" fill="#059669" radius={[6, 6, 0, 0]} barSize={18} isAnimationActive={false} />
            <Bar dataKey="expenses" name="Expenses" fill="#b45309" radius={[6, 6, 0, 0]} barSize={18} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {canBackup && <section className="panel data-tools">
          <h2>Business data</h2>
          <p className="quiet">Save a copy of the current business. Replacing the books is in Settings.</p>
          <div className="tool-row">
            <button type="button" className="btn-ghost" onClick={downloadBackup}>Download monthly backup</button>
          </div>
          {history.length > 0 && (
            <ul className="record-list">
              {history.map((item) => <li key={`${item.at}-${item.name}`}><span>{item.name}</span><span className="quiet">{item.at.slice(0, 10)} · {item.status}</span></li>)}
            </ul>
          )}
        </section>}
    </section>
  )
}

function Card({ label, value, note, tone, to }: { label: string; value: string; note?: string; tone: 'brand' | 'ok' | 'danger'; to?: string }) {
  const card = <article className="metric" data-tone={tone}><span>{label}</span><strong className="money">{value}</strong>{note && <small className="quiet">{note}</small>}</article>
  return to ? <Link className="metric-link" to={to}>{card}</Link> : card
}

function Field({ label, hint, wide, error, children }: { label: string; hint?: string; wide?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className={wide ? 'control-line wide-field' : 'control-line'}>
      <label>
        <span className="field-label">{label}{hint && <span className="info-i" title={hint} aria-hidden="true">i</span>}</span>
        {children}
      </label>
      {hint && <span className="field-hint">{hint}</span>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}

function ProductThumb({ path, token, alt, large = false }: { path: string; token: string; alt: string; large?: boolean }) {
  if (path) return <RecordImage path={path} token={token} alt={alt} large={large} />
  return <span className={large ? 'photo-placeholder large' : 'photo-placeholder'} aria-hidden="true"><Package size={large ? 36 : 18} /></span>
}

function withChoice(options: string[], current?: string) {
  if (current && !options.includes(current)) return [current, ...options]
  return options
}

const priceMissing = 'Enter the selling price in euros, for example 8,50.'

const productSchema = z.object({
  code: z.string().trim().min(1, 'Enter a short code, for example C1.'),
  name: z.string().trim().min(1, 'Enter the product name, for example Case.'),
  category: z.string().optional(),
  colour: z.string().optional(),
  model: z.string().optional(),
  barcode: z.string().optional(),
  sellPrice: z.string().refine((value) => requiredSellingPrice(value) != null, priceMissing),
  alertLevel: z.string().optional(),
})

function blankToNull(value?: string) {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

function Products({ tables, token, canManage, canAdjust, canSeeCost, onSaved }: { tables: LocalTables; token: string; canManage: boolean; canAdjust: boolean; canSeeCost: boolean; onSaved: () => Promise<void> }) {
  const summary = summarizeTables(tables)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [productOpen, setProductOpen] = useState(false)
  const [countOpen, setCountOpen] = useState(false)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [previewId, setPreviewId] = useState('')
  const [archiveId, setArchiveId] = useState('')
  const [adjustId, setAdjustId] = useState('')
  const [adjustPreviewId, setAdjustPreviewId] = useState('')
  const [adjustArchiveId, setAdjustArchiveId] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [formError, setFormError] = useState('')
  const blankProduct = { code: '', name: '', category: '', colour: '', model: '', barcode: '', sellPrice: '', alertLevel: '10' }
  const form = useForm({ resolver: zodResolver(productSchema), defaultValues: blankProduct })
  useEffect(() => {
    if (params.get('new') === '1') {
      setEditingId('')
      setPhoto(null)
      setFormError('')
      form.reset(blankProduct)
      setProductOpen(true)
      setParams({}, { replace: true })
      return
    }
    const id = params.get('product')
    if (!id || !tables.products.some((row) => row.id === id)) return
    setPreviewId(id)
    setParams({}, { replace: true })
  }, [params, setParams, tables.products])
  const categories = [...new Set(tables.products.map((row) => String(row.category ?? '')).filter(Boolean))]
  const categoryChoices = withChoice(settingList(tables.settings, 'categories', categories.length > 0 ? categories : ['Cases', 'Chargers', 'Cables', 'Protection']), form.watch('category'))
  const colourChoices = withChoice(settingList(tables.settings, 'colours', ['Black', 'White', 'Clear']), form.watch('colour'))
  const stockByCode = new Map(summary.stock.map((item) => [item.code, item]))
  const visible = filterProducts(tables.products.map((row) => ({
    ...row,
    code: String(row.code),
    name: String(row.name),
    category: row.category == null ? null : String(row.category),
    barcode: row.barcode == null ? null : String(row.barcode),
  })), summary.stock, query, category, status)

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Products</h1>
          {!canManage && <p className="lede">You can look products up. Adding or pricing them is limited to managers.</p>}
        </div>
        <div className="quick-actions">
          {canAdjust && <button type="button" className="btn-ghost" onClick={() => { setCounts(Object.fromEntries(tables.products.map((row) => [String(row.id), String(summary.stock.find((item) => item.code === row.code)?.qty ?? 0)]))); setCountOpen(true) }}>Stock count</button>}
          {canManage && <button type="button" className="btn" onClick={() => { setEditingId(''); setPhoto(null); setFormError(''); form.reset(blankProduct); setProductOpen(true) }}>New product</button>}
          {canAdjust && <button type="button" className="btn-ghost" onClick={() => { setAdjustId(''); setAdjustNote(''); setAdjustOpen(true) }}>Adjust stock</button>}
        </div>
      </div>
      <div className="filters">
        <label className="control-line">Find product
          <input aria-label="Find product" placeholder="Search products" className="control" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="control-line">Category
          <select aria-label="Category" className="control" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="control-line">Stock status
          <select aria-label="Stock status" className="control" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {['OK', 'LOW', 'OUT', 'CHECK'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <RecordTable
        caption="Products"
        headers={['Product', 'Status', 'Quantity', 'Price']}
        rows={visible.map((row) => {
          const stock = stockByCode.get(String(row.code))
          const qty = stock?.qty ?? 0
          const average = qty !== 0 ? Math.round((stock?.valueCents ?? 0) / qty) : 0
          const status = stock?.status ?? 'OUT'
          const ordered = onOrderQty(
            tables.purchase_lines.filter((line) => line.product_id === row.id).reduce((sum, line) => sum + Number(line.qty), 0),
            tables.purchase_lines.filter((line) => line.product_id === row.id).reduce((sum, line) => sum + (line.qty_received == null || line.qty_received === '' ? Number(line.qty) : Number(line.qty_received)), 0),
          )
          const since = addDays(lisbonToday(), -30)
          const sold = tables.sale_lines.filter((line) => line.product_id === row.id && String(tables.sales.find((sale) => sale.id === line.sale_id)?.date ?? '') >= since).reduce((sum, line) => sum + Number(line.qty), 0)
          const suggest = reorderSuggestion(sold, qty, ordered)
          return {
            key: String(row.id),
            status,
            cells: [
              <span className="cell-main" key="name">
                <span className="product-name">
                  <ProductThumb path={row.photo_path ? String(row.photo_path) : ''} token={token} alt={`${row.code} ${row.name}`} />
                  <span className="product-meta">
                    <span>{String(row.code)} {String(row.name)}</span>
                    {row.category ? <small>{String(row.category)}</small> : null}
                    {suggest > 0 ? <Link to={`/purchases?new=1&product=${row.id}`}>Reorder {suggest}</Link> : null}
                  </span>
                </span>
                <RowActions
                  canWrite={canManage}
                  onPreview={() => setPreviewId(String(row.id))}
                  onEdit={() => {
                    const source = tables.products.find((item) => item.id === row.id)
                    if (!source) return
                    setEditingId(String(source.id))
                    setPhoto(source.photo_path == null ? null : String(source.photo_path))
                    setFormError(Number(source.sell_price) > 0 ? '' : priceMissing)
                    form.reset({
                      code: String(source.code ?? ''),
                      name: String(source.name ?? ''),
                      category: String(source.category ?? ''),
                      colour: String(source.colour ?? ''),
                      model: String(source.model ?? ''),
                      barcode: String(source.barcode ?? ''),
                      sellPrice: Number(source.sell_price) > 0 ? centsToInput(Number(source.sell_price)) : '',
                      alertLevel: String(source.alert_level ?? 10),
                    })
                    setProductOpen(true)
                  }}
                  onArchive={() => setArchiveId(String(row.id))}
                />
              </span>,
              status,
              ordered > 0 ? `${qty} pcs · ${ordered} on order` : `${qty} pcs`,
              <span className="price-stack" key="price">
                {Number(row.sell_price) > 0 ? <span>{centsToEuros(Number(row.sell_price))}</span> : <span className="owe">No selling price</span>}
                {canSeeCost && qty !== 0 ? <span className="quiet">Average cost {centsToEuros(average)}</span> : null}
                {canSeeCost && Number(row.sell_price) > 0 ? <span className="quiet">Margin {Math.round(((Number(row.sell_price) - average) / Number(row.sell_price)) * 1000) / 10}%</span> : null}
              </span>,
            ],
          }
        })}
      />
      <Popup title="Stock count" open={countOpen} onClose={() => setCountOpen(false)}>
          <form className="form-grid" onSubmit={async (event) => {
            event.preventDefault()
            for (const row of tables.products) {
              const counted = Number(counts[String(row.id)])
              const current = summary.stock.find((item) => item.code === row.code)?.qty ?? 0
              if (!Number.isFinite(counted) || counted === current) continue
              await saveLocal('stock_adjustments', { id: uuidv7(), product_id: row.id, qty: counted - current, reason: 'count correction', deleted_at: null })
            }
            setCountOpen(false)
            await onSaved()
          }}>
            <p className="lede">Type the quantity you counted. The difference is saved as a count correction.</p>
            {tables.products.map((row) => (
              <label key={String(row.id)} className="control-line">{String(row.code)} {String(row.name)}
                <input aria-label={`Count ${String(row.code)}`} className="control" inputMode="numeric" value={counts[String(row.id)] ?? ''} onChange={(event) => setCounts((current) => ({ ...current, [String(row.id)]: event.target.value }))} />
              </label>
            ))}
            <button className="btn">Save count</button>
          </form>
        </Popup>
      {canManage && (
        <Popup title={editingId ? 'Edit product' : 'New product'} open={productOpen} onClose={() => setProductOpen(false)}>
        <form className="form-grid two" onSubmit={form.handleSubmit(async (values) => {
          const sellPrice = requiredSellingPrice(values.sellPrice)
          if (sellPrice == null) {
            setFormError(priceMissing)
            return
          }
          const existing = tables.products.find((row) => row.id === editingId)
          try {
          await saveLocal('products', {
            ...(existing ?? {}),
            id: editingId || uuidv7(),
            code: values.code,
            name: values.name,
            category: blankToNull(values.category),
            colour: blankToNull(values.colour),
            model: blankToNull(values.model),
            barcode: blankToNull(values.barcode),
            sell_price: sellPrice,
            alert_level: Number(values.alertLevel || 10),
            photo_path: photo,
            deleted_at: null,
          })
          } catch (caught) {
            setFormError(caught instanceof Error ? caught.message : 'Could not save this product.')
            return
          }
          setFormError('')
          setPhoto(null)
          setEditingId('')
          form.reset(blankProduct)
          setProductOpen(false)
          await onSaved()
        })}>
          <Field label="Code" hint="A short unique code, for example C1." error={form.formState.errors.code?.message}><input placeholder="C1" aria-label="Code" className="control" {...form.register('code')} /></Field>
          <Field label="Product name" hint="What you sell, for example Case." error={form.formState.errors.name?.message}><input placeholder="Name" aria-label="Product name" className="control" {...form.register('name')} /></Field>
          <Field label="Product category" hint="Cases, Chargers, Cables or Protection. Pick one you already use."><input placeholder="Category" aria-label="Product category" className="control" list="product-categories" {...form.register('category')} /></Field>
          <datalist id="product-categories">{categoryChoices.map((item) => <option key={item} value={item} />)}</datalist>
          <Field label="Colour" hint="Optional. Black, White, Clear, or another colour from Settings."><input placeholder="Black" aria-label="Colour" className="control" list="product-colours" {...form.register('colour')} /></Field>
          <datalist id="product-colours">{colourChoices.map((item) => <option key={item} value={item} />)}</datalist>
          <Field label="Model" hint="Optional. The phone or device this product fits."><input placeholder="iPhone 15" aria-label="Model" className="control" {...form.register('model')} /></Field>
          <Field label="Barcode" hint="Optional. The number on the product barcode."><input placeholder="Barcode" aria-label="Barcode" className="control" {...form.register('barcode')} /></Field>
          <Field label="Selling price (EUR)" hint="Required. The price you charge a shop, in euros. Example 8,50." error={form.formState.errors.sellPrice?.message ?? (formError || undefined)}><input placeholder="Selling price" aria-label="Selling price" aria-invalid={form.formState.errors.sellPrice || formError ? true : undefined} className="control" {...form.register('sellPrice')} /></Field>
          <Field label="Alert level" hint="Warn when the pieces in stock fall to this number. Example 10."><input placeholder="10" aria-label="Alert level" className="control" {...form.register('alertLevel')} /></Field>
          <label className="control-line wide-field">Photo
            <span className="field-hint">Optional for now. A placeholder is shown until you add a photo.</span>
            <input aria-label="Photo" type="file" accept="image/*" className="control" onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) { setPhoto(null); return }
              const reader = new FileReader()
              reader.onload = () => setPhoto(typeof reader.result === 'string' ? reader.result : null)
              reader.readAsDataURL(file)
            }} />
          </label>
          <div className="form-span">{photo ? <RecordImage path={photo} token={token} alt="Chosen photo" large /> : <span className="photo-placeholder large" aria-hidden="true"><Package size={36} /></span>}</div>
          <button className="btn form-span">{editingId ? 'Save changes' : 'Save product'}</button>
        </form>
        </Popup>
      )}
      <Popup sheet title="Product" open={tables.products.some((row) => row.id === previewId)} onClose={() => setPreviewId('')}>
        {tables.products.filter((row) => row.id === previewId).map((row) => {
          const stock = stockByCode.get(String(row.code))
          return (
            <div key={String(row.id)}>
              <ProductThumb path={row.photo_path ? String(row.photo_path) : ''} token={token} alt={`${row.code} ${row.name}`} large />
              <FactList items={[
                { label: 'Product', value: `${row.code} ${row.name}` },
                { label: 'Category', value: String(row.category ?? '') },
                { label: 'Colour', value: String(row.colour ?? '') },
                { label: 'Model', value: String(row.model ?? '') },
                { label: 'Price', value: Number(row.sell_price) > 0 ? centsToEuros(Number(row.sell_price)) : 'No selling price' },
                { label: 'Alert', value: String(row.alert_level ?? 10) },
                { label: 'Stock', value: `${stock?.qty ?? 0} pcs ${stock?.status ?? 'OUT'}` },
                ...(row.barcode ? [{ label: 'Barcode', value: String(row.barcode) }] : []),
              ]} />
            </div>
          )
        })}
      </Popup>
      <ArchiveDialog open={tables.products.some((row) => row.id === archiveId)} title="Archive product" needsReason={false} onClose={() => setArchiveId('')} onConfirm={async () => {
        const row = tables.products.find((item) => item.id === archiveId)
        if (!row) return
        await saveLocal('products', { ...row, deleted_at: new Date().toISOString() })
        setArchiveId('')
        offerUndo('Product archived', async () => {
          await saveLocal('products', { ...row, deleted_at: null })
          await onSaved()
        })
        await onSaved()
      }} />
      {canManage && <ArchivedPanel table="products" refreshKey={String(tables.products.length)} label={(row) => `${row.code} ${row.name}`} onRestore={async (row) => {
        await saveLocal('products', { ...row, deleted_at: null, purged_at: null })
        await onSaved()
      }} onChanged={onSaved} />}
      {canAdjust && (
        <Popup title={adjustId ? 'Edit adjustment' : 'Adjust stock'} open={adjustOpen} onClose={() => setAdjustOpen(false)}>
        <form key={adjustId || 'new'} className="form-grid" onSubmit={async (event) => {
          event.preventDefault()
          const formElement = event.currentTarget
          const data = new FormData(formElement)
          const existing = tables.stock_adjustments.find((row) => row.id === adjustId)
          const gate = editReasonGate(String(existing?.created_at ?? lisbonToday()), lisbonToday(), adjustNote)
          if (adjustId && !gate.canSave) return
          await saveLocal('stock_adjustments', {
            ...(existing ?? {}),
            id: adjustId || uuidv7(),
            product_id: data.get('product_id'),
            qty: Number(data.get('qty')),
            reason: data.get('reason'),
            deleted_at: null,
          })
          setAdjustId('')
          setAdjustOpen(false)
          await onSaved()
        }}>
          <Field label="Product"><select name="product_id" aria-label="Adjustment product" className="control" required defaultValue={String(tables.stock_adjustments.find((row) => row.id === adjustId)?.product_id ?? '')}>
            {tables.products.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.code)} {String(row.name)}</option>)}
          </select></Field>
          <Field label="Quantity change"><input name="qty" type="number" required placeholder="Quantity change" aria-label="Quantity change" className="control" defaultValue={adjustId ? String(tables.stock_adjustments.find((row) => row.id === adjustId)?.qty ?? '') : ''} /></Field>
          <Field label="Reason"><input name="reason" required placeholder="Reason" aria-label="Reason" className="control" defaultValue={adjustId ? String(tables.stock_adjustments.find((row) => row.id === adjustId)?.reason ?? '') : ''} /></Field>
          {adjustId && editReasonGate(String(tables.stock_adjustments.find((row) => row.id === adjustId)?.created_at ?? ''), lisbonToday(), adjustNote).needsReason && (
            <Field label="Change reason"><input aria-label="Change reason" required className="control" value={adjustNote} onChange={(event) => setAdjustNote(event.target.value)} placeholder="Why this older record is changing" /></Field>
          )}
          <button className="btn">{adjustId ? 'Save changes' : 'Save adjustment'}</button>
        </form>
        </Popup>
      )}
      <Popup sheet title="Adjustment" open={tables.stock_adjustments.some((row) => row.id === adjustPreviewId)} onClose={() => setAdjustPreviewId('')}>
        {tables.stock_adjustments.filter((row) => row.id === adjustPreviewId).map((row) => {
          const product = tables.products.find((item) => item.id === row.product_id)
          return (
            <FactList key={String(row.id)} items={[
              { label: 'Product', value: `${product?.code ?? 'Product'} ${product?.name ?? ''}`.trim() },
              { label: 'Quantity', value: String(row.qty ?? '') },
              { label: 'Reason', value: String(row.reason ?? ''), wide: true },
            ]} />
          )
        })}
      </Popup>
      <h2>Adjustments</h2>
      <ul className="record-list">
        {tables.stock_adjustments.map((row) => {
          const product = tables.products.find((item) => item.id === row.product_id)
          return (
            <li key={String(row.id)}>
              <span>{String(product?.code ?? 'Product')} · {String(row.qty)} · {String(row.reason)}</span>
              <RowActions canWrite={canAdjust} onPreview={() => setAdjustPreviewId(String(row.id))} onEdit={() => { setAdjustId(String(row.id)); setAdjustNote(''); setAdjustOpen(true) }} onArchive={() => setAdjustArchiveId(String(row.id))} />
            </li>
          )
        })}
      </ul>
      <ArchiveDialog open={tables.stock_adjustments.some((row) => row.id === adjustArchiveId)} title="Archive adjustment" needsReason={editReasonGate(String(tables.stock_adjustments.find((row) => row.id === adjustArchiveId)?.created_at ?? ''), lisbonToday(), '').needsReason} onClose={() => setAdjustArchiveId('')} onConfirm={async () => {
        const row = tables.stock_adjustments.find((item) => item.id === adjustArchiveId)
        if (!row) return
        await saveLocal('stock_adjustments', { ...row, deleted_at: new Date().toISOString() })
        setAdjustArchiveId('')
        offerUndo('Adjustment archived', async () => {
          await saveLocal('stock_adjustments', { ...row, deleted_at: null })
          await onSaved()
        })
        await onSaved()
      }} />
    </section>
  )
}

function SimpleEntry({ title, table, fields, rows, onSaved, canManage = true, isSuperAdmin = false, canMerge = false, sales = [], lines = [], allocations = [], payments = [], detail, balanceOf, previewExtra }: { title: string; table: string; fields: string[]; rows: Record<string, unknown>[]; onSaved: () => Promise<void>; canManage?: boolean; isSuperAdmin?: boolean; canMerge?: boolean; sales?: Record<string, unknown>[]; lines?: Record<string, unknown>[]; allocations?: Record<string, unknown>[]; payments?: Record<string, unknown>[]; detail?: (row: Record<string, unknown>) => ReactNode; balanceOf?: (row: Record<string, unknown>) => number; previewExtra?: (row: Record<string, unknown>) => ReactNode }) {
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [previewId, setPreviewId] = useState('')
  const [archiveId, setArchiveId] = useState('')
  const action = title === 'Customers' ? 'New customer' : title === 'Suppliers' ? 'New supplier' : `New ${title.toLowerCase()}`
  const singular = title === 'Customers' ? 'customer' : title === 'Suppliers' ? 'supplier' : title.toLowerCase()
  const shops = rows.map((row) => ({ id: String(row.id), shop_name: String(row.shop_name ?? row.name ?? ''), nif: row.nif == null ? null : String(row.nif), phone: row.phone == null ? null : String(row.phone) }))
  const warning = table === 'customers' || table === 'suppliers' ? duplicateWarning(shops.filter((shop) => shop.id !== editingId), { nif: draft.nif, phone: draft.phone }) : ''
  const groups = table === 'customers' && canMerge ? duplicateGroups(shops) : []
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    if (params.get('new') !== '1') return
    setEditingId('')
    setDraft(table === 'suppliers' ? { country: 'Portugal' } : {})
    setError('')
    setOpen(true)
    setParams({}, { replace: true })
  }, [params, setParams, table])
  const labels = { shop_name: 'Shop name', contact: 'Contact person', phone: 'Phone', nif: 'NIF', city: 'City', postcode: 'Postcode', email: 'Email', address: table === 'suppliers' ? 'Shop address' : 'Address', home_address: 'Home address', shop_type: 'Shop type', tags: 'Tags', payment_terms: 'Payment terms (days)', credit_limit: 'Credit limit (EUR)', notes: 'Notes', name: 'Name', country: 'Country', first_name: 'First name', last_name: 'Last name', whatsapp: 'WhatsApp' } as Record<string, string>
  const hints = (table === 'customers' ? {
    shop_name: 'The name on the shop front. This is how the shop appears on invoices.',
    phone: 'Portuguese mobile or landline, so you can call or WhatsApp the shop.',
    nif: 'Portuguese tax number, 9 digits. Optional. Example 123456789.',
    city: 'The town or city, for example Lisboa or Porto.',
    email: 'Where invoices and statements are sent. Optional.',
    address: 'Street and door number of the shop.',
    credit_limit: 'The most this shop can owe, in euros. Leave empty for no limit.',
    contact: 'The person you speak to at the shop.',
    whatsapp: 'Optional. Leave empty to use the phone number.',
    postcode: 'Portuguese postcode, for example 1100-053.',
    shop_type: 'Retail, wholesale, or another type you use.',
    tags: 'Short labels separated by commas, for example Lisbon, Key account.',
    payment_terms: 'How many days after the invoice the shop usually pays.',
    notes: 'Anything the next person should know about this shop.',
  } : {
    name: 'The company name. This is how the supplier appears on purchases.',
    first_name: 'The person you speak to. Optional.',
    last_name: 'Family name of that person. Optional.',
    email: 'Where orders and statements are sent. Optional.',
    phone: 'Portuguese mobile or landline.',
    whatsapp: 'Optional. Leave empty to use the phone number.',
    nif: 'Portuguese tax number, 9 digits. Optional.',
    address: 'Street and door number of the shop or warehouse.',
    home_address: 'Optional home address, if it is different from the shop.',
    country: 'Defaults to Portugal.',
  }) as Record<string, string>
  const placeholders = {
    shop_name: 'Loja Central',
    phone: '910 000 000',
    nif: '123456789',
    city: 'Lisboa',
    email: 'loja@example.pt',
    address: 'Rua Augusta 12',
    home_address: 'Rua do Ouro 5',
    credit_limit: '500,00',
    contact: 'Ana Silva',
    postcode: '1100-053',
    shop_type: 'Retail',
    tags: 'Lisbon',
    payment_terms: '30',
    notes: 'Prefers morning calls',
    name: 'Lisbon Parts',
    first_name: 'Ana',
    last_name: 'Silva',
    whatsapp: '910 000 000',
    country: 'Portugal',
  } as Record<string, string>
  const fieldValue = (row: Record<string, unknown>, field: string) => field === 'credit_limit' ? (row.credit_limit == null || row.credit_limit === '' ? '' : centsToInput(Number(row.credit_limit))) : (row[field] == null ? '' : String(row[field]))
  const owed = (id: string) => {
    const row = rows.find((item) => item.id === id)
    if (balanceOf && row) return balanceOf(row)
    if (table !== 'customers') return 0
    return invoiceStandings({
      sales: sales.map((sale) => ({ id: String(sale.id), invoice_no: String(sale.invoice_no ?? ''), customer_id: String(sale.customer_id), date: sale.date == null ? null : String(sale.date) })),
      lines: lines.map((line) => ({ sale_id: String(line.sale_id), qty: Number(line.qty), unit_price: Number(line.unit_price), discount: Number(line.discount ?? 0) })),
      allocations: allocations.map((row) => ({ sale_id: String(row.sale_id), amount: Number(row.amount) })),
      today: lisbonToday(),
    }).filter((invoice) => invoice.customerId === id).reduce((sum, invoice) => sum + Math.max(0, invoice.totalCents - invoice.paidCents), 0)
  }
  const preview = rows.find((row) => row.id === previewId)
  return (
    <section className="page">
      <div className="page-head"><div><h1>{title}</h1></div>{canManage && <button type="button" className="btn" onClick={() => { setEditingId(''); setDraft(table === 'suppliers' ? { country: 'Portugal' } : {}); setError(''); setOpen(true) }}>{action}</button>}</div>
      <Popup title={editingId ? `Edit ${singular}` : action} open={open} onClose={() => setOpen(false)}>
      <form className="form-grid two" onSubmit={async (event) => {
        event.preventDefault()
        const existing = rows.find((item) => item.id === editingId)
        const row: Record<string, unknown> = { ...(existing ?? {}), id: editingId || uuidv7(), deleted_at: null }
        for (const field of fields) {
          const value = (draft[field] ?? '').trim()
          if (field === 'credit_limit') {
            if (value === '') { row[field] = null; continue }
            const cents = parseEuros(value)
            if (cents == null) { setError('Enter the credit limit in euros, for example 50,00.'); return }
            row[field] = cents
            continue
          }
          if (field === 'payment_terms') {
            row[field] = value === '' ? null : Number(value)
            continue
          }
          row[field] = value === '' && field !== 'shop_name' && field !== 'name' ? null : value
        }
        if ((table === 'customers' || table === 'suppliers') && typeof row.nif === 'string' && row.nif !== '' && !isValidPortugueseNif(row.nif)) {
          setError('Enter a valid Portuguese NIF (9 digits).')
          return
        }
        if (table === 'suppliers') {
          const person = [row.first_name, row.last_name].filter((part) => typeof part === 'string' && part.trim() !== '').join(' ')
          row.contact = person || null
          if (row.country == null || row.country === '') row.country = 'Portugal'
        }
        try {
          await saveLocal(table, row)
          setDraft({})
          setEditingId('')
          setError('')
          setOpen(false)
          await onSaved()
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Could not save')
        }
      }}>
        {fields.map((field) => {
          const label = labels[field] ?? field
          const long = field === 'address' || field === 'home_address' || field === 'notes'
          return (
            <Field key={field} label={label} hint={hints[field]} wide={long}>
              {long ? (
                <textarea name={field} aria-label={label} placeholder={placeholders[field] ?? label} className="control" rows={2} value={draft[field] ?? ''} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} />
              ) : (
                <input name={field} aria-label={label} placeholder={placeholders[field] ?? label} required={field === 'shop_name' || field === 'name'} className="control" type={field === 'email' ? 'email' : field === 'phone' || field === 'whatsapp' ? 'tel' : 'text'} inputMode={field === 'nif' || field === 'payment_terms' ? 'numeric' : field === 'credit_limit' ? 'decimal' : undefined} maxLength={field === 'nif' ? 9 : undefined} value={draft[field] ?? ''} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} />
              )}
            </Field>
          )
        })}
        <div className="form-span">
          {warning && <p className="warn" role="status">{warning}</p>}
          {error && <p className="error">{error}</p>}
          <button className="btn">{editingId ? 'Save changes' : 'Save'}</button>
        </div>
      </form>
      </Popup>
      <Popup sheet title={singular[0].toUpperCase() + singular.slice(1)} open={preview != null} onClose={() => setPreviewId('')}>
        {preview && (
          <FactList items={[
            ...fields.map((field) => ({
              label: field === 'credit_limit' ? 'Credit limit' : (labels[field] ?? field),
              value: field === 'credit_limit'
                ? (preview.credit_limit == null || preview.credit_limit === '' ? '' : centsToEuros(Number(preview.credit_limit)))
                : fieldValue(preview, field),
              wide: field === 'address' || field === 'home_address' || field === 'email',
            })),
            ...(detail ? detail(preview).split(' · ').map((part) => {
              const amount = part.match(/€\s*[\d.,-]+/)
              const label = amount ? part.slice(0, amount.index).trim() : 'Detail'
              return { label: label || 'Detail', value: amount ? amount[0] : part }
            }) : []),
          ]} />
        )}
        {preview && previewExtra?.(preview)}
      </Popup>
      <ArchiveDialog open={rows.some((row) => row.id === archiveId)} title={`Archive ${singular}`} needsReason={false} onClose={() => setArchiveId('')} onConfirm={async () => {
        const row = rows.find((item) => item.id === archiveId)
        if (!row) return
        await saveLocal(table, { ...row, deleted_at: new Date().toISOString() })
        setArchiveId('')
        offerUndo(`${singular[0].toUpperCase()}${singular.slice(1)} archived`, async () => {
          await saveLocal(table, { ...row, deleted_at: null })
          await onSaved()
        })
        await onSaved()
      }} />
      <ArchivedPanel table={table} refreshKey={rows.map((row) => String(row.id)).join(',')} label={(row) => String(row.shop_name ?? row.name ?? 'Record')} onRestore={async (row) => {
        await saveLocal(table, { ...row, deleted_at: null, purged_at: null })
        await onSaved()
      }} onChanged={onSaved} />
      {error && !open && <p className="error">{error}</p>}
      {rows.length === 0 && <p className="quiet">No {title.toLowerCase()} yet.</p>}
      {table === 'customers' && params.get('owes') === '1' && <p className="quiet">Showing shops with a balance.</p>}
      <RecordTable
        caption={title}
        headers={table === 'customers' ? ['Shop', 'Phone', 'City', 'Owed', 'Last order', ''] : ['Name', 'Contact', 'Phone', 'Country', 'Balance', '']}
        rows={(table === 'customers' && params.get('owes') === '1' ? rows.filter((row) => owed(String(row.id)) > 0) : rows).map((row) => {
          const actions = <RowActions canWrite={canManage} onPreview={() => setPreviewId(String(row.id))} onEdit={() => {
            setEditingId(String(row.id))
            setDraft(Object.fromEntries(fields.map((field) => [field, fieldValue(row, field)])))
            setError('')
            setOpen(true)
          }} onArchive={() => {
            const block = archiveBlock({
              blocked: owed(String(row.id)) > 0,
              isSuperAdmin,
              message: table === 'customers' ? 'This shop still has an open invoice.' : 'We still owe this supplier.',
            })
            if (block) { setError(block); return }
            setError('')
            setArchiveId(String(row.id))
          }} />
          if (table === 'customers') {
            const last = sales.filter((sale) => sale.customer_id === row.id).map((sale) => String(sale.date ?? '')).filter(Boolean).sort().at(-1)
            const due = owed(String(row.id))
            return {
              key: String(row.id),
              cells: [
                <Link key="shop" to={`/customers/${String(row.id)}`} aria-label={`Open ${String(row.shop_name ?? '')}`}>{String(row.shop_name ?? '')}</Link>,
                String(row.phone ?? '').trim() || '—',
                String(row.city ?? '').trim() || '—',
                <span key="owed" className={due > 0 ? 'owe' : 'settled'}>{centsToEuros(due)}</span>,
                last ? last.slice(0, 10) : '—',
                actions,
              ],
            }
          }
          return {
            key: String(row.id),
            cells: [String(row.name ?? ''), [row.first_name, row.last_name].filter((part) => part != null && String(part).trim() !== '').join(' ') || '—', String(row.phone ?? ''), String(row.country ?? ''), detail?.(row) ?? '', actions],
          }
        })}
      />
      {groups.length > 0 && (
        <div className="panel">
          <h2>Possible duplicates</h2>
          <ul className="record-list">
            {groups.map((group) => (
              <li key={group.key}>
                {group.customers.map((shop) => shop.shop_name).join(', ')}
                <button type="button" className="btn-ghost" onClick={async () => {
                  const [keep, ...others] = group.customers
                  for (const other of others) {
                    for (const sale of sales) {
                      if (sale.customer_id === other.id) await saveLocal('sales', { ...sale, customer_id: keep.id })
                    }
                    for (const payment of payments) {
                      if (payment.customer_id === other.id) await saveLocal('customer_payments', { ...payment, customer_id: keep.id })
                    }
                    const row = rows.find((item) => item.id === other.id)
                    if (row) await saveLocal('customers', { ...row, deleted_at: new Date().toISOString() })
                  }
                  await onSaved()
                }}>Merge into {group.customers[0].shop_name}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function PaymentEntry({ tables, canManage = true, canManagePurchases = true, onSaved }: { tables: LocalTables; canManage?: boolean; canManagePurchases?: boolean; onSaved: () => Promise<void> }) {
  const [customerId, setCustomerId] = useState(() => sessionStorage.getItem('hak.payCustomer') ?? '')
  const [paySupplierId, setPaySupplierId] = useState(() => sessionStorage.getItem('hak.paySupplier') ?? '')
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('customer')
  const [editing, setEditing] = useState<{ table: 'customer_payments' | 'supplier_payments'; id: string } | null>(null)
  const [amountValue, setAmountValue] = useState('')
  const [reason, setReason] = useState('')
  const [warning, setWarning] = useState('')
  const [preview, setPreview] = useState<{ table: 'customer_payments' | 'supplier_payments'; id: string } | null>(null)
  const [archive, setArchive] = useState<{ table: 'customer_payments' | 'supplier_payments'; id: string } | null>(null)
  const [invoiceFilter, setInvoiceFilter] = useState('All')
  const [payParams, setPayParams] = useSearchParams()
  const methods = settingList(tables.settings, 'payment_methods', ['Cash', 'Bank Transfer', 'MB Way', 'Card', 'Cheque'])
  const overdueDays = settingNumber(tables.settings, 'overdue_days', 30)
  useEffect(() => {
    if (payParams.get('new') !== '1' && !payParams.get('customer')) return
    const customer = payParams.get('customer')
    if (customer) {
      sessionStorage.setItem('hak.payCustomer', customer)
      setCustomerId(customer)
    }
    if (payParams.get('kind') === 'supplier') setKind('supplier')
    if (payParams.get('new') === '1') { setEditing(null); setAmountValue(''); setOpen(true) }
    setPayParams({}, { replace: true })
  }, [payParams, setPayParams])
  const selectedCustomer = tables.customers.some((row) => row.id === customerId) ? customerId : String(tables.customers[0]?.id ?? '')
  const selectedSupplier = tables.suppliers.some((row) => row.id === paySupplierId) ? paySupplierId : String(tables.suppliers[0]?.id ?? '')
  const chooseCustomer = (id: string) => {
    sessionStorage.setItem('hak.payCustomer', id)
    setCustomerId(id)
  }
  const chooseSupplier = (id: string) => {
    sessionStorage.setItem('hak.paySupplier', id)
    setPaySupplierId(id)
  }
  const supplierBalance = supplierMoney({ supplierId: selectedSupplier, purchases: tables.purchases, lines: tables.purchase_lines, payments: tables.supplier_payments })
  const supplierName = String(tables.suppliers.find((row) => row.id === selectedSupplier)?.name ?? 'Supplier')
  const today = new Date().toISOString().slice(0, 10)
  const standings = invoiceStandings({
    sales: tables.sales.map((row) => ({ id: String(row.id), invoice_no: String(row.invoice_no ?? ''), customer_id: String(row.customer_id), date: row.date == null ? null : String(row.date) })),
    lines: tables.sale_lines.map((row) => ({ sale_id: String(row.sale_id), qty: Number(row.qty), unit_price: Number(row.unit_price), discount: Number(row.discount ?? 0) })),
    allocations: tables.payment_allocations.map((row) => ({ sale_id: String(row.sale_id), amount: Number(row.amount) })),
    today,
    overdueDays,
  })
  const shopName = (id: string) => shopLabel(tables.customers.find((row) => row.id === id)?.shop_name)
  const clearing = standings.filter((invoice) => invoice.customerId === selectedCustomer && invoice.status !== 'Paid')
  const visibleInvoices = standings.filter((invoice) => invoiceFilter === 'Overdue' ? invoice.overdue : invoiceFilter === 'All' ? true : invoice.status === invoiceFilter)
  return (
    <section className="page">
      <div className="page-head">
        <div><h1>Payments</h1><p className="lede">Customer cash is applied to the oldest open invoice first.</p></div>
        <div className="quick-actions">
          <div className="tabs">
            <button type="button" className={kind === 'customer' ? 'active' : ''} aria-pressed={kind === 'customer'} onClick={() => setKind('customer')}>Customer</button>
            <button type="button" className={kind === 'supplier' ? 'active' : ''} aria-pressed={kind === 'supplier'} onClick={() => setKind('supplier')}>Supplier</button>
          </div>
          {canManage && kind === 'customer' && <button type="button" className="btn" onClick={() => { setEditing(null); setKind('customer'); setAmountValue(''); setReason(''); setWarning(''); setOpen(true) }}>New payment</button>}
          {canManagePurchases && kind === 'supplier' && <button type="button" className="btn" onClick={() => { setEditing(null); setKind('supplier'); setAmountValue(''); setReason(''); setWarning(''); setOpen(true) }}>New supplier payment</button>}
        </div>
      </div>
      <Popup title={editing ? 'Edit payment' : 'New payment'} open={open} onClose={() => setOpen(false)}>
      <form className="form-grid" onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const existing = editing?.table === 'supplier_payments'
          ? tables.supplier_payments.find((row) => row.id === editing.id)
          : tables.customer_payments.find((row) => row.id === editing?.id)
        const gate = editReasonGate(String(existing?.created_at ?? lisbonToday()), lisbonToday(), reason)
        if (editing && !gate.canSave) { setWarning(gate.message); return }
        const currency = String(form.get('currency') || 'EUR')
        const amount = parseEuros(String(form.get('amount') ?? ''))
        if (amount == null) { setWarning('Enter the amount in euros, for example 10,00.'); return }
        const fx = Number(form.get('fx_rate') || 1)
        try {
        if (kind === 'supplier') {
          const paymentId = editing?.table === 'supplier_payments' ? editing.id : uuidv7()
          await saveLocal('supplier_payments', { ...(existing ?? {}), id: paymentId, supplier_id: selectedSupplier, paid_by: form.get('paid_by'), amount, currency, fx_rate: String(fx), amount_eur: currency === 'EUR' ? amount : fxToEurCents(amount, fx), method: String(form.get('method') || 'Bank Transfer'), deleted_at: null })
        } else {
          const paymentId = editing?.table === 'customer_payments' ? editing.id : uuidv7()
          const previous = tables.payment_allocations.filter((row) => row.customer_payment_id === paymentId)
          const fresh = invoiceStandings({
            sales: tables.sales.map((row) => ({ id: String(row.id), invoice_no: String(row.invoice_no ?? ''), customer_id: String(row.customer_id), date: row.date == null ? null : String(row.date) })),
            lines: tables.sale_lines.map((row) => ({ sale_id: String(row.sale_id), qty: Number(row.qty), unit_price: Number(row.unit_price), discount: Number(row.discount ?? 0) })),
            allocations: tables.payment_allocations.filter((row) => row.customer_payment_id !== paymentId).map((row) => ({ sale_id: String(row.sale_id), amount: Number(row.amount) })),
            today,
            overdueDays,
          })
          for (const row of previous) await saveLocal('payment_allocations', { ...row, deleted_at: new Date().toISOString() })
          await saveLocal('customer_payments', { ...(existing ?? {}), id: paymentId, customer_id: selectedCustomer, received_by: form.get('paid_by'), amount, method: String(form.get('method') || 'Cash'), deleted_at: null })
          const unpaid = fresh.filter((invoice) => invoice.customerId === selectedCustomer && invoice.status !== 'Paid')
          for (const row of allocationsForPayment(unpaid.map((invoice) => ({ id: invoice.id, date: invoice.date, remainingCents: invoice.totalCents - invoice.paidCents })), amount)) {
            await saveLocal('payment_allocations', { id: uuidv7(), customer_payment_id: paymentId, sale_id: row.saleId, amount: row.amountCents })
          }
        }
        } catch (caught) {
          setWarning(caught instanceof Error ? caught.message : 'Could not save this payment.')
          return
        }
        setEditing(null)
        setOpen(false)
        await onSaved()
      }}>
        <Field label="Payment type"><select name="kind" aria-label="Payment type" className="control" value={kind} onChange={(event) => setKind(event.target.value)}><option value="customer">Customer payment</option><option value="supplier">Supplier payment</option></select></Field>
        <Field label="Method"><select name="method" aria-label="Method" className="control" defaultValue={kind === 'supplier' ? 'Bank Transfer' : 'Cash'}>{methods.map((item) => <option key={item}>{item}</option>)}</select></Field>
        {kind === 'customer' && <Field label="Shop"><select name="customer_id" aria-label="Shop" className="control" value={selectedCustomer} onChange={(event) => chooseCustomer(event.target.value)}>{tables.customers.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.shop_name)}</option>)}</select></Field>}
        {kind === 'customer' && <p className="lede">Paying {shopName(selectedCustomer)}. This payment clears {clearing.length === 0 ? 'no open invoice' : clearing.map((invoice) => invoice.invoiceNo).join(', ')}.</p>}
        {kind === 'supplier' && <Field label="Supplier"><select name="supplier_id" aria-label="Supplier" className="control" value={selectedSupplier} onChange={(event) => chooseSupplier(event.target.value)}>{tables.suppliers.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></Field>}
        {kind === 'supplier' && <p className="lede">{supplierName} · We owe {centsToEuros(supplierBalance.owedCents)}</p>}
        <Field label="Recorded by"><select name="paid_by" aria-label="Recorded by" className="control">{tables.partners.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></Field>
        {kind === 'customer' && paymentCredit({
          customerId: selectedCustomer,
          payments: tables.customer_payments.map((row) => ({ id: String(row.id), customer_id: String(row.customer_id), amount: Number(row.amount), created_at: row.created_at == null ? null : String(row.created_at) })),
          allocations: tables.payment_allocations.map((row) => ({ customer_payment_id: String(row.customer_payment_id), amount: Number(row.amount) })),
        }).reduce((sum, row) => sum + row.leftoverCents, 0) > 0 && <p className="quiet">Shop credit {centsToEuros(paymentCredit({
          customerId: selectedCustomer,
          payments: tables.customer_payments.map((row) => ({ id: String(row.id), customer_id: String(row.customer_id), amount: Number(row.amount), created_at: row.created_at == null ? null : String(row.created_at) })),
          allocations: tables.payment_allocations.map((row) => ({ customer_payment_id: String(row.customer_payment_id), amount: Number(row.amount) })),
        }).reduce((sum, row) => sum + row.leftoverCents, 0))} is kept for the next invoice.</p>}
        <Field label="Amount (EUR)"><input name="amount" required placeholder="Amount" aria-label="Amount" className="control" value={amountValue} onChange={(event) => setAmountValue(event.target.value)} /></Field>
        <Field label="Currency"><input name="currency" placeholder="Currency" aria-label="Currency" defaultValue="EUR" className="control" /></Field>
        <Field label="FX rate"><input name="fx_rate" placeholder="FX rate" aria-label="FX rate" defaultValue="1" className="control" /></Field>
        {editing && editReasonGate(String((editing.table === 'supplier_payments' ? tables.supplier_payments : tables.customer_payments).find((row) => row.id === editing.id)?.created_at ?? ''), lisbonToday(), reason).needsReason && (
          <label className="control-line">Reason
            <input aria-label="Change reason" className="control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this older record is changing" />
          </label>
        )}
        {warning && <p className="warn">{warning}</p>}
        <button className="btn">{editing ? 'Save changes' : 'Save payment'}</button>
      </form>
      </Popup>
      {kind === 'customer' && <h2>Invoices</h2>}
      {kind === 'customer' && <label className="control-line">Invoice status
        <select aria-label="Invoice status" className="control" value={invoiceFilter} onChange={(event) => setInvoiceFilter(event.target.value)}>
          {['All', 'Unpaid', 'Part-paid', 'Paid', 'Overdue'].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>}
      {kind === 'customer' && <RecordTable
        caption="Invoices"
        headers={['Shop', 'Invoice', 'Status', 'Left']}
        statusColumn={-1}
        rows={visibleInvoices.map((invoice) => {
          const left = invoice.totalCents - invoice.paidCents
          return {
            key: invoice.id,
            cells: [shopName(invoice.customerId), invoice.invoiceNo, invoice.overdue ? `${invoice.status} · Overdue` : invoice.status, `${centsToEuros(left)} left`],
          }
        })}
      />}
      {kind === 'supplier' && <h2>Suppliers</h2>}
      {kind === 'supplier' && <ul className="record-list">
        {tables.suppliers.map((supplier) => {
          const money = supplierMoney({ supplierId: String(supplier.id), purchases: tables.purchases, lines: tables.purchase_lines, payments: tables.supplier_payments })
          return <li key={String(supplier.id)} data-owe={money.owedCents > 0 ? 'yes' : 'no'}>{String(supplier.name)} · We owe {centsToEuros(money.owedCents)}</li>
        })}
      </ul>}
      {kind === 'customer' && <h2>Customer payments</h2>}
      {kind === 'customer' && <ul className="record-list">
        {tables.customer_payments.map((row) => (
          <li key={String(row.id)}>
            <span>Payment · {shopName(String(row.customer_id))} · {centsToEuros(Number(row.amount))}</span>
            <RowActions canWrite={canManage} onPreview={() => setPreview({ table: 'customer_payments', id: String(row.id) })} onEdit={() => { setEditing({ table: 'customer_payments', id: String(row.id) }); setKind('customer'); chooseCustomer(String(row.customer_id)); setAmountValue(centsToInput(Number(row.amount))); setReason(''); setOpen(true) }} onArchive={() => setArchive({ table: 'customer_payments', id: String(row.id) })} />
          </li>
        ))}
      </ul>}
      {kind === 'supplier' && <h2>Supplier payments</h2>}
      {kind === 'supplier' && <ul className="record-list">
        {tables.supplier_payments.map((row) => (
          <li key={String(row.id)}>
            <span>Payment · {String(tables.suppliers.find((supplier) => supplier.id === row.supplier_id)?.name ?? 'Supplier')} · {centsToEuros(Number(row.amount_eur ?? row.amount))}</span>
            <RowActions canWrite={canManagePurchases} onPreview={() => setPreview({ table: 'supplier_payments', id: String(row.id) })} onEdit={() => { setEditing({ table: 'supplier_payments', id: String(row.id) }); setKind('supplier'); chooseSupplier(String(row.supplier_id)); setAmountValue(centsToInput(Number(row.amount))); setReason(''); setOpen(true) }} onArchive={() => setArchive({ table: 'supplier_payments', id: String(row.id) })} />
          </li>
        ))}
      </ul>}
      <Popup sheet title="Payment" open={preview != null} onClose={() => setPreview(null)}>
        {preview?.table === 'customer_payments' && tables.customer_payments.filter((row) => row.id === preview.id).map((row) => {
          const recorder = String(tables.partners.find((partner) => partner.id === row.received_by)?.name ?? 'Unknown')
          const invoices = tables.payment_allocations.filter((item) => item.customer_payment_id === row.id)
          return (
            <div key={String(row.id)}>
              <FactList items={[
                { label: 'Shop', value: shopName(String(row.customer_id)) },
                { label: 'Amount', value: centsToEuros(Number(row.amount)) },
                { label: 'Recorded by', value: recorder, wide: true },
              ]} />
              <ul className="record-list">
                {invoices.map((item) => {
                  const sale = tables.sales.find((entry) => entry.id === item.sale_id)
                  return <li key={String(item.id)}>{String(sale?.invoice_no ?? 'Invoice')} · {centsToEuros(Number(item.amount))}</li>
                })}
                {invoices.length === 0 && <li>No invoices</li>}
              </ul>
            </div>
          )
        })}
        {preview?.table === 'supplier_payments' && tables.supplier_payments.filter((row) => row.id === preview.id).map((row) => (
          <FactList key={String(row.id)} items={[
            { label: 'Supplier', value: String(tables.suppliers.find((supplier) => supplier.id === row.supplier_id)?.name ?? 'Supplier') },
            { label: 'Amount', value: centsToEuros(Number(row.amount_eur ?? row.amount)) },
            { label: 'Recorded by', value: String(tables.partners.find((partner) => partner.id === row.paid_by)?.name ?? 'Unknown') },
            { label: 'Currency', value: String(row.currency ?? 'EUR') },
          ]} />
        ))}
      </Popup>
      <ArchiveDialog
        open={archive != null}
        title="Archive payment"
        needsReason={editReasonGate(String((archive?.table === 'supplier_payments' ? tables.supplier_payments : tables.customer_payments).find((row) => row.id === archive?.id)?.created_at ?? ''), lisbonToday(), '').needsReason}
        onClose={() => setArchive(null)}
        onConfirm={async () => {
          if (!archive) return
          const stamp = new Date().toISOString()
          if (archive.table === 'customer_payments') {
            const row = tables.customer_payments.find((item) => item.id === archive.id)
            const allocations = tables.payment_allocations.filter((item) => item.customer_payment_id === archive.id)
            if (row) await saveLocal('customer_payments', { ...row, deleted_at: stamp })
            for (const item of allocations) await saveLocal('payment_allocations', { ...item, deleted_at: stamp })
            if (row) offerUndo('Payment archived', async () => {
              await saveLocal('customer_payments', { ...row, deleted_at: null })
              for (const item of allocations) await saveLocal('payment_allocations', { ...item, deleted_at: null })
              await onSaved()
            })
          } else {
            const row = tables.supplier_payments.find((item) => item.id === archive.id)
            if (row) {
              await saveLocal('supplier_payments', { ...row, deleted_at: stamp })
              offerUndo('Payment archived', async () => {
                await saveLocal('supplier_payments', { ...row, deleted_at: null })
                await onSaved()
              })
            }
          }
          setArchive(null)
          await onSaved()
        }}
      />
    </section>
  )
}

function ExpenseEntry({ tables, token, canManage = true, onSaved }: { tables: LocalTables; token: string; canManage?: boolean; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [previewId, setPreviewId] = useState('')
  const [archiveId, setArchiveId] = useState('')
  const [category, setCategory] = useState('')
  const [amountValue, setAmountValue] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [reason, setReason] = useState('')
  const [repeatMonthly, setRepeatMonthly] = useState(false)
  const [warning, setWarning] = useState('')
  const [receipt, setReceipt] = useState<string | null>(null)
  const [expenseParams, setExpenseParams] = useSearchParams()
  const expenseCategories = withChoice(settingList(tables.settings, 'expense_categories', ['Rent', 'Freight', 'Utilities', 'Other']), category)
  useEffect(() => {
    if (expenseParams.get('new') !== '1') return
    setEditingId('')
    setCategory('')
    setAmountValue('')
    setOpen(true)
    setExpenseParams({}, { replace: true })
  }, [expenseParams, setExpenseParams])
  const partnerName = (id: unknown) => String(tables.partners.find((row) => row.id === id)?.name ?? 'Partner')
  const preview = tables.expenses.find((row) => row.id === previewId)
  const archive = tables.expenses.find((row) => row.id === archiveId)
  return (
    <section className="page">
      <div className="page-head">
        <div><h1>Expenses</h1><p className="lede">Shop costs come off the profit. They are not stock.</p></div>
        {canManage && <button type="button" className="btn" onClick={() => { setEditingId(''); setCategory(''); setAmountValue(''); setPaidBy(''); setReason(''); setReceipt(null); setOpen(true) }}>New expense</button>}
      </div>
      {recurringDue(settingJson<RecurringCost[]>(tables.settings, 'recurring_expenses', []), lisbonToday().slice(0, 7)).map((row) => (
        <p key={row.id} className="panel">
          {row.category} {centsToEuros(row.amountCents)} is due this month.
          <button type="button" className="btn-ghost" onClick={async () => {
            await saveLocal('expenses', { id: uuidv7(), category: row.category, amount: row.amountCents, amount_eur: row.amountCents, currency: 'EUR', fx_rate: '1', paid_by: row.paidBy, deleted_at: null })
            const templates = settingJson<RecurringCost[]>(tables.settings, 'recurring_expenses', []).map((item) => item.id === row.id ? { ...item, confirmedMonth: lisbonToday().slice(0, 7) } : item)
            const existingSetting = tables.settings.find((item) => item.key === 'recurring_expenses')
            await saveLocal('settings', { id: existingSetting?.id ?? uuidv7(), key: 'recurring_expenses', value: JSON.stringify(templates), deleted_at: null })
            await onSaved()
          }}>Confirm</button>
        </p>
      ))}
      <RecordTable
        caption="Expenses"
        headers={['Expense', 'Paid by', 'Amount']}
        statusColumn={-1}
        rows={tables.expenses.map((row) => ({
          key: String(row.id),
          cells: [
            <span className="cell-main" key="name">
              <span className="product-name">
                {row.receipt_path ? <RecordImage path={String(row.receipt_path)} token={token} alt={String(row.category)} /> : null}
                <span>{String(row.category)}</span>
              </span>
              <RowActions canWrite={canManage} onPreview={() => setPreviewId(String(row.id))} onEdit={() => { setEditingId(String(row.id)); setCategory(String(row.category ?? '')); setAmountValue(centsToInput(Number(row.amount))); setPaidBy(String(row.paid_by ?? '')); setReason(''); setReceipt(row.receipt_path == null ? null : String(row.receipt_path)); setOpen(true) }} onArchive={() => setArchiveId(String(row.id))} />
            </span>,
            partnerName(row.paid_by),
            centsToEuros(Number(row.amount)),
          ],
        }))}
      />
      <ArchivedPanel table="expenses" refreshKey={tables.expenses.map((row) => String(row.id)).join(',')} label={(row) => String(row.category ?? 'Expense')} onRestore={async (row) => {
        await saveLocal('expenses', { ...row, deleted_at: null, purged_at: null })
        await onSaved()
      }} onChanged={onSaved} />
      <Popup title={editingId ? 'Edit expense' : 'New expense'} open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault()
          const existing = tables.expenses.find((row) => row.id === editingId)
          const gate = editReasonGate(String(existing?.created_at ?? lisbonToday()), lisbonToday(), reason)
          if (editingId && !gate.canSave) { setWarning(gate.message); return }
          const form = new FormData(event.currentTarget)
          const amount = parseEuros(String(form.get('amount') ?? ''))
          if (amount == null) { setWarning('Enter the amount in euros, for example 6,50.'); return }
          try {
          await saveLocal('expenses', { ...(existing ?? {}), id: editingId || uuidv7(), category: form.get('category'), amount, amount_eur: amount, currency: 'EUR', fx_rate: '1', paid_by: form.get('paid_by'), receipt_path: receipt, deleted_at: null })
          if (repeatMonthly) {
            const templates = settingJson<RecurringCost[]>(tables.settings, 'recurring_expenses', [])
            const id = editingId || String(form.get('category'))
            const next = [...templates.filter((row) => row.id !== id), { id, category: String(form.get('category')), amountCents: amount, paidBy: String(form.get('paid_by') ?? ''), confirmedMonth: lisbonToday().slice(0, 7) }]
            const existingSetting = tables.settings.find((row) => row.key === 'recurring_expenses')
            await saveLocal('settings', { id: existingSetting?.id ?? uuidv7(), key: 'recurring_expenses', value: JSON.stringify(next), deleted_at: null })
          }
          } catch (caught) {
            setWarning(caught instanceof Error ? caught.message : 'Could not save this expense.')
            return
          }
          setReceipt(null)
          setOpen(false)
          await onSaved()
        }}>
          <Field label="Category"><input name="category" aria-label="Category" required placeholder="Category" className="control" list="expense-categories" value={category} onChange={(event) => setCategory(event.target.value)} /></Field>
          <datalist id="expense-categories">{expenseCategories.map((item) => <option key={item} value={item} />)}</datalist>
          <Field label="Amount (EUR)"><input name="amount" required placeholder="Amount" className="control" value={amountValue} onChange={(event) => setAmountValue(event.target.value)} /></Field>
          <Field label="Paid by"><select name="paid_by" aria-label="Paid by" className="control" value={paidBy || String(tables.partners[0]?.id ?? '')} onChange={(event) => setPaidBy(event.target.value)}>{tables.partners.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></Field>
          {!editingId && <label className="check"><input type="checkbox" checked={repeatMonthly} onChange={(event) => setRepeatMonthly(event.target.checked)} /> Repeat monthly</label>}
          <label className="control-line">Receipt
            <input aria-label="Receipt" type="file" accept="image/*" className="control" onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) { setReceipt(null); return }
              const reader = new FileReader()
              reader.onload = () => setReceipt(typeof reader.result === 'string' ? reader.result : null)
              reader.readAsDataURL(file)
            }} />
          </label>
          {receipt && <RecordImage path={receipt} token={token} alt="Receipt" large />}
          {editingId && editReasonGate(String(tables.expenses.find((row) => row.id === editingId)?.created_at ?? ''), lisbonToday(), reason).needsReason && (
            <label className="control-line">Reason<input aria-label="Change reason" className="control" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          )}
          {warning && <p className="warn">{warning}</p>}
          <button className="btn">{editingId ? 'Save changes' : 'Save expense'}</button>
        </form>
      </Popup>
      <Popup sheet title="Expense" open={preview != null} onClose={() => setPreviewId('')}>
        {preview && (
          <div>
            {preview.receipt_path ? <RecordImage path={String(preview.receipt_path)} token={token} alt={String(preview.category)} large /> : null}
            <FactList items={[
              { label: 'Category', value: String(preview.category ?? '') },
              { label: 'Amount', value: centsToEuros(Number(preview.amount)) },
              { label: 'Paid by', value: partnerName(preview.paid_by) },
              { label: 'Date', value: String(preview.created_at ?? '').slice(0, 10) },
            ]} />
          </div>
        )}
      </Popup>
      <ArchiveDialog open={archive != null} title="Archive expense" needsReason={editReasonGate(String(archive?.created_at ?? ''), lisbonToday(), '').needsReason} onClose={() => setArchiveId('')} onConfirm={async () => {
        if (!archive) return
        await saveLocal('expenses', { ...archive, deleted_at: new Date().toISOString() })
        offerUndo('Expense archived', async () => {
          await saveLocal('expenses', { ...archive, deleted_at: null })
          await onSaved()
        })
        setArchiveId('')
        await onSaved()
      }} />
    </section>
  )
}

function TransferEntry({ tables, canManage = true, onSaved }: { tables: LocalTables; canManage?: boolean; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [previewId, setPreviewId] = useState('')
  const [archiveId, setArchiveId] = useState('')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amountValue, setAmountValue] = useState('')
  const [transferParams, setTransferParams] = useSearchParams()
  useEffect(() => {
    if (transferParams.get('new') !== '1') return
    setEditingId('')
    setFromId(transferParams.get('from') ?? '')
    setToId(transferParams.get('to') ?? '')
    const amount = Number(transferParams.get('amount') ?? '')
    setAmountValue(Number.isFinite(amount) && amount > 0 ? centsToInput(amount) : '')
    setReason('')
    setOpen(true)
    setTransferParams({}, { replace: true })
  }, [transferParams, setTransferParams])
  const [reason, setReason] = useState('')
  const [warning, setWarning] = useState('')
  const nameOf = (id: unknown) => String(tables.partners.find((row) => row.id === id)?.name ?? 'Partner')
  const preview = tables.partner_transfers.find((row) => row.id === previewId)
  const archive = tables.partner_transfers.find((row) => row.id === archiveId)
  return (
    <section className="page">
      <div className="page-head">
        <div><h1>Partner transfers</h1><p className="lede">Money moved between partners. This does not change the profit.</p></div>
        {canManage && <button type="button" className="btn" onClick={() => { setEditingId(''); setFromId(''); setToId(''); setAmountValue(''); setReason(''); setOpen(true) }}>New transfer</button>}
      </div>
      <ul className="record-list">
        {tables.partner_transfers.map((row) => (
          <li key={String(row.id)}>
            <span>{nameOf(row.from_partner)} → {nameOf(row.to_partner)} · {centsToEuros(Number(row.amount))}</span>
            <RowActions canWrite={canManage} onPreview={() => setPreviewId(String(row.id))} onEdit={() => { setEditingId(String(row.id)); setFromId(String(row.from_partner)); setToId(String(row.to_partner)); setAmountValue(centsToInput(Number(row.amount))); setReason(''); setOpen(true) }} onArchive={() => setArchiveId(String(row.id))} />
          </li>
        ))}
      </ul>
      <Popup title={editingId ? 'Edit transfer' : 'New transfer'} open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          if (form.get('from_partner') === form.get('to_partner')) { setWarning('Choose two different partners.'); return }
          const existing = tables.partner_transfers.find((row) => row.id === editingId)
          const gate = editReasonGate(String(existing?.created_at ?? lisbonToday()), lisbonToday(), reason)
          if (editingId && !gate.canSave) { setWarning(gate.message); return }
          const amount = parseEuros(String(form.get('amount') ?? ''))
          if (amount == null) { setWarning('Enter the amount in euros, for example 15,00.'); return }
          try {
          await saveLocal('partner_transfers', { ...(existing ?? {}), id: editingId || uuidv7(), from_partner: form.get('from_partner'), to_partner: form.get('to_partner'), amount, note: reason || existing?.note || null, deleted_at: null })
          } catch (caught) {
            setWarning(caught instanceof Error ? caught.message : 'Could not save this transfer.')
            return
          }
          setOpen(false)
          await onSaved()
        }}>
          <Field label="From"><select name="from_partner" aria-label="From" className="control" value={fromId || String(tables.partners[0]?.id ?? '')} onChange={(event) => setFromId(event.target.value)}>{tables.partners.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></Field>
          <Field label="To"><select name="to_partner" aria-label="To" className="control" value={toId || String(tables.partners[1]?.id ?? tables.partners[0]?.id ?? '')} onChange={(event) => setToId(event.target.value)}>{tables.partners.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></Field>
          <Field label="Amount (EUR)"><input name="amount" required placeholder="Amount" className="control" value={amountValue} onChange={(event) => setAmountValue(event.target.value)} /></Field>
          {editingId && editReasonGate(String(tables.partner_transfers.find((row) => row.id === editingId)?.created_at ?? ''), lisbonToday(), reason).needsReason && (
            <label className="control-line">Reason<input aria-label="Change reason" className="control" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          )}
          {warning && <p className="warn">{warning}</p>}
          <button className="btn">{editingId ? 'Save changes' : 'Save transfer'}</button>
        </form>
      </Popup>
      <Popup sheet title="Transfer" open={preview != null} onClose={() => setPreviewId('')}>
        {preview && (
          <FactList items={[
            { label: 'From', value: nameOf(preview.from_partner) },
            { label: 'To', value: nameOf(preview.to_partner) },
            { label: 'Amount', value: centsToEuros(Number(preview.amount)), wide: true },
          ]} />
        )}
      </Popup>
      <ArchiveDialog open={archive != null} title="Archive transfer" needsReason={editReasonGate(String(archive?.created_at ?? ''), lisbonToday(), '').needsReason} onClose={() => setArchiveId('')} onConfirm={async () => {
        if (!archive) return
        await saveLocal('partner_transfers', { ...archive, deleted_at: new Date().toISOString() })
        offerUndo('Transfer archived', async () => {
          await saveLocal('partner_transfers', { ...archive, deleted_at: null })
          await onSaved()
        })
        setArchiveId('')
        await onSaved()
      }} />
    </section>
  )
}

function Admin({ token }: { token: string }) {
  const [users, setUsers] = useState<Record<string, unknown>[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [temporary, setTemporary] = useState('')
  const [tab, setTab] = useState<'Users' | 'Roles' | 'Devices'>('Users')
  const [open, setOpen] = useState(false)
  const [roleUser, setRoleUser] = useState<Record<string, unknown> | null>(null)
  const [deactivateUser, setDeactivateUser] = useState<Record<string, unknown> | null>(null)
  const [purgeUser, setPurgeUser] = useState<Record<string, unknown> | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [userError, setUserError] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const navigate = useNavigate()
  useEffect(() => {
    setUsersLoading(true)
    api('/api/users', {}, token)
      .then((result) => setUsers((result.data as Record<string, unknown>[]) ?? []))
      .catch(() => navigate('/'))
      .finally(() => setUsersLoading(false))
  }, [token, navigate])
  if (usersLoading) return <PageSkeleton kind="table" />
  return (
    <section className="page">
      <div className="tabs">
        {(['Users', 'Roles', 'Devices'] as const).map((name) => (
          <button key={name} type="button" className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>
        ))}
      </div>
      {tab === 'Roles' && <RolesPanel token={token} />}
      {tab === 'Devices' && <DevicesPanel token={token} />}
      {tab === 'Users' && <>
      <div className="page-head"><div><h1>Users</h1><p className="lede">New logins start with a temporary password that must be changed.</p></div><button type="button" className="btn" onClick={() => setOpen(true)}>New login</button></div>
      <label className="control-line">Find login
        <input aria-label="Find login" placeholder="Search logins" className="control" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} />
      </label>
      <Popup title="New login" open={open} onClose={() => setOpen(false)}>
      <form className="form-grid" onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const result = await api('/api/users', { method: 'POST', body: JSON.stringify({ name: form.get('name'), email: form.get('email'), role: form.get('role') }) }, token)
        setTemporary(String(result.temporary_password ?? ''))
        if (result.user && typeof result.user === 'object') setUsers((current) => [...current, result.user as Record<string, unknown>])
        setOpen(false)
      }}>
        <label className="control-line">Name
          <input name="name" required placeholder="Name" aria-label="Name" className="control" />
        </label>
        <label className="control-line">Email
          <input name="email" type="email" required placeholder="Email" aria-label="Email" className="control" />
        </label>
        <label className="control-line">Role
          <select name="role" aria-label="Role" className="control"><option>Salesperson</option><option>Manager</option><option>Partner</option><option>Viewer</option></select>
        </label>
        <button className="btn">Create login</button>
      </form>
      </Popup>
      {temporary && <p className="banner">Temporary password: <button onClick={() => void navigator.clipboard.writeText(temporary)}>{temporary}</button></p>}
      {userError && <p className="warn">{userError}</p>}
      <ul className="record-list" aria-label="Active logins">{users.filter((user) => user.is_active !== false && `${user.name} ${user.email}`.toLowerCase().includes(userQuery.trim().toLowerCase())).map((user) => {
        const roles = Array.isArray(user.roles) ? user.roles.map(String) : []
        const activeSuperAdmins = users.filter((row) => row.is_active !== false && Array.isArray(row.roles) && row.roles.map(String).includes('Super Admin')).length
        const lastSuperAdmin = roles.includes('Super Admin') && activeSuperAdmins <= 1
        return (
          <li key={String(user.id)}>
            <span>{String(user.name)}</span>
            <span className="quiet">{String(user.email)}{roles.length ? ` · ${roles.join(', ')}` : ''}</span>
            <RowActions
              canWrite={false}
              extra={[
                { label: 'Change role', onSelect: () => { setUserError(''); setRoleUser(user) } },
                { label: 'Reset password', onSelect: () => {
                  setUserError('')
                  void api(`/api/users/${String(user.id)}/reset-password`, { method: 'POST' }, token).then((result) => setTemporary(String(result.temporary_password ?? ''))).catch((caught: unknown) => setUserError(caught instanceof ApiError ? caught.message : 'Could not reset the password.'))
                } },
                ...(!lastSuperAdmin ? [{ label: 'Deactivate', danger: true, onSelect: () => { setUserError(''); setDeactivateUser(user) } }] : []),
              ]}
            />
          </li>
        )
      })}</ul>
      <div>
        <button type="button" className="btn-ghost" aria-pressed={archiveOpen} onClick={() => setArchiveOpen((value) => !value)}>Archived</button>
        {archiveOpen && (
          <ul className="record-list" aria-label="Archived logins">
            {users.filter((user) => user.is_active === false && `${user.name} ${user.email}`.toLowerCase().includes(userQuery.trim().toLowerCase())).length === 0 && <li>Nothing archived</li>}
            {users.filter((user) => user.is_active === false && `${user.name} ${user.email}`.toLowerCase().includes(userQuery.trim().toLowerCase())).map((user) => {
              const roles = Array.isArray(user.roles) ? user.roles.map(String) : []
              return (
                <li key={String(user.id)}>
                  <span>{String(user.name)}</span>
                  <span className="quiet">{String(user.email)}{roles.length ? ` · ${roles.join(', ')}` : ''}</span>
                  <span className="quick-actions">
                    <button type="button" className="btn-ok" onClick={() => {
                      setUserError('')
                      void api(`/api/users/${String(user.id)}/reactivate`, { method: 'POST' }, token)
                        .then(() => setUsers((current) => current.map((row) => row.id === user.id ? { ...row, is_active: true } : row)))
                        .catch((caught: unknown) => setUserError(caught instanceof ApiError ? caught.message : 'Could not reactivate this login.'))
                    }}>Reactivate</button>
                    <button type="button" className="btn-danger" onClick={() => { setUserError(''); setPurgeUser(user) }}>Delete permanently</button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <Popup title="Change role" open={roleUser != null} onClose={() => setRoleUser(null)}>
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault()
          if (!roleUser) return
          const role = String(new FormData(event.currentTarget).get('role') ?? '')
          try {
            const result = await api(`/api/users/${String(roleUser.id)}`, { method: 'PATCH', body: JSON.stringify({ role }) }, token)
            const next = result.user
            if (next && typeof next === 'object') setUsers((current) => current.map((row) => row.id === roleUser.id ? next as Record<string, unknown> : row))
            setRoleUser(null)
          } catch (caught) {
            setUserError(caught instanceof ApiError ? caught.message : 'Could not change the role.')
          }
        }}>
          <label className="control-line">Role
            <select name="role" aria-label="Role" className="control" defaultValue={Array.isArray(roleUser?.roles) ? String(roleUser.roles[0] ?? 'Salesperson') : 'Salesperson'}>
              <option>Super Admin</option><option>Partner</option><option>Manager</option><option>Salesperson</option><option>Viewer</option>
            </select>
          </label>
          {userError && <p className="warn">{userError}</p>}
          <button className="btn">Save role</button>
        </form>
      </Popup>
      <Popup title="Deactivate login" open={deactivateUser != null} onClose={() => setDeactivateUser(null)}>
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault()
          if (!deactivateUser) return
          try {
            await api(`/api/users/${String(deactivateUser.id)}/deactivate`, { method: 'POST' }, token)
            setUsers((current) => current.map((row) => row.id === deactivateUser.id ? { ...row, is_active: false } : row))
            setArchiveOpen(true)
            setDeactivateUser(null)
          } catch (caught) {
            setUserError(caught instanceof ApiError ? caught.message : 'Could not deactivate this login.')
          }
        }}>
          <p className="lede">{String(deactivateUser?.name ?? 'This person')} moves to Archived and can no longer sign in. Their sales stay in their name. You can reactivate the login later.</p>
          {userError && <p className="warn">{userError}</p>}
          <button className="btn-danger">Deactivate</button>
        </form>
      </Popup>
      <Popup title="Delete permanently" open={purgeUser != null} onClose={() => setPurgeUser(null)}>
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault()
          if (!purgeUser) return
          try {
            await api(`/api/users/${String(purgeUser.id)}`, { method: 'DELETE' }, token)
            setUsers((current) => current.filter((row) => row.id !== purgeUser.id))
            setPurgeUser(null)
          } catch (caught) {
            setUserError(caught instanceof ApiError ? caught.message : 'Could not delete this login.')
          }
        }}>
          <p className="lede">{String(purgeUser?.name ?? 'This login')} cannot be restored. The email address can be used again. Sales already recorded stay in the books.</p>
          {userError && <p className="warn">{userError}</p>}
          <button className="btn-danger">Delete permanently</button>
        </form>
      </Popup>
      </>}
    </section>
  )
}
