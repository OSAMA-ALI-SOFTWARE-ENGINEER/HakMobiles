import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { isSuperAdmin, useSession } from '../lib/session'

const COPY = {
  customers: { title: 'Customers', path: '/api/customers', label: 'shop_name', permission: 'customers.manage', placeholder: 'Shop name' },
  suppliers: { title: 'Suppliers', path: '/api/suppliers', label: 'name', permission: 'suppliers.manage', placeholder: 'Supplier name' },
  purchases: { title: 'Purchases', path: '/api/purchases', label: 'invoice_no', permission: 'purchases.manage', placeholder: '' },
  payments: { title: 'Customer payments', path: '/api/customer-payments', label: 'amount', permission: 'payments.manage', placeholder: '' },
  expenses: { title: 'Expenses', path: '/api/expenses', label: 'category', permission: 'expenses.manage', placeholder: 'Category' },
  transfers: { title: 'Partner transfers', path: '/api/partner-transfers', label: 'amount', permission: 'transfers.manage', placeholder: '' },
  reports: { title: 'Reports', path: '/api/reports', label: 'status', permission: 'reports.view', placeholder: '' },
} as const

export function RecordsPage({ kind }: { kind: keyof typeof COPY }) {
  const config = COPY[kind]
  const { session } = useSession()
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const canCreate = !!session && config.placeholder !== '' && (isSuperAdmin(session) || session.permissions.includes(config.permission))

  useEffect(() => {
    if (!session || kind === 'reports') return
    api<{ data: Record<string, unknown>[] }>(config.path, {}, session.token)
      .then((body) => setRows(body.data ?? []))
      .catch((caught: Error) => setError(caught.message))
  }, [session, kind, config.path])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    setError('')
    const payload = kind === 'customers'
      ? { shop_name: value }
      : kind === 'suppliers'
        ? { name: value }
        : { category: value, amount: 20, amount_eur: 20, currency: 'EUR', fx_rate: 1 }
    try {
      await api(config.path, { method: 'POST', body: JSON.stringify(payload) }, session.token)
      setValue('')
      const body = await api<{ data: Record<string, unknown>[] }>(config.path, {}, session.token)
      setRows(body.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save')
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold">{config.title}</h1>
      {kind === 'reports' && <p className="mt-3 text-sm text-stone-600">Profit by month, product, customer, and category uses the same totals as the dashboard.</p>}
      {canCreate && (
        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <input className="rounded-lg border border-stone-300 px-3 py-2" placeholder={config.placeholder} value={value} onChange={(event) => setValue(event.target.value)} required />
          <button className="rounded-lg bg-emerald-700 px-4 py-2 text-white" type="submit">Save</button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      <ul className="mt-6 grid gap-2">
        {rows.map((row) => (
          <li key={String(row.id)} className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
            {String(row[config.label] ?? row.shop_name ?? row.name ?? row.invoice_no ?? row.amount ?? 'Record')}
          </li>
        ))}
      </ul>
    </section>
  )
}
