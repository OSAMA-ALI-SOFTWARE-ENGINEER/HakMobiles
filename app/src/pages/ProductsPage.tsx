import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { isSuperAdmin, useSession } from '../lib/session'

type Product = {
  id: string
  code: string
  name: string
  category?: string
  sell_price: string
  unit_cost?: string
}

export function ProductsPage() {
  const { session } = useSession()
  const [rows, setRows] = useState<Product[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('5.00')
  const [error, setError] = useState('')
  const canEdit = !!session && (isSuperAdmin(session) || session.permissions.includes('products.manage'))
  const showCost = !!session && (isSuperAdmin(session) || session.permissions.includes('products.view_cost'))

  async function refresh() {
    if (!session) return
    const body = await api<{ data: Product[] }>('/api/products', {}, session.token)
    setRows(body.data)
  }

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message))
  }, [session])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    setError('')
    try {
      await api('/api/products', {
        method: 'POST',
        body: JSON.stringify({ code, name, sell_price: price, category: 'Cases' }),
      }, session.token)
      setCode('')
      setName('')
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save')
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold">Products</h1>
      {canEdit && (
        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap gap-2">
          <input className="rounded-lg border border-stone-300 px-3 py-2" placeholder="Code" value={code} onChange={(event) => setCode(event.target.value)} required />
          <input className="rounded-lg border border-stone-300 px-3 py-2" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} required />
          <input className="w-28 rounded-lg border border-stone-300 px-3 py-2" placeholder="Price" value={price} onChange={(event) => setPrice(event.target.value)} required />
          <button className="rounded-lg bg-emerald-700 px-4 py-2 text-white" type="submit">Add product</button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      <table className="mt-6 w-full overflow-hidden rounded-2xl bg-white text-left text-sm shadow-sm">
        <thead className="bg-stone-100">
          <tr>
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Selling price</th>
            {showCost && <th className="px-4 py-3">Cost</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-stone-100">
              <td className="px-4 py-3">{row.code}</td>
              <td className="px-4 py-3">{row.name}</td>
              <td className="px-4 py-3">€{Number(row.sell_price).toFixed(2)}</td>
              {showCost && <td className="px-4 py-3">{row.unit_cost ?? '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
