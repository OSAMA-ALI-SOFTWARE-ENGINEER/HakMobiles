import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'

type Customer = { id: string; shop_name: string }
type Product = { id: string; code: string; name: string; sell_price: string }
type Sale = { id: string; invoice_no: string; date: string }

export function SalesPage() {
  const { session } = useSession()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [customerId, setCustomerId] = useState('')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('1')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function refresh() {
    if (!session) return
    const [customerBody, productBody, saleBody] = await Promise.all([
      api<{ data: Customer[] }>('/api/customers', {}, session.token),
      api<{ data: Product[] }>('/api/products', {}, session.token),
      api<{ data: Sale[] }>('/api/sales', {}, session.token),
    ])
    setCustomers(customerBody.data)
    setProducts(productBody.data)
    setSales(saleBody.data)
    setCustomerId((current) => current || customerBody.data[0]?.id || '')
    setProductId((current) => current || productBody.data[0]?.id || '')
  }

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message))
  }, [session])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    const product = products.find((item) => item.id === productId)
    if (!product) return
    setError('')
    setMessage('')
    try {
      const invoice = `WEB-${Date.now().toString().slice(-6)}`
      await api('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          invoice_no: invoice,
          customer_id: customerId,
          date: new Date().toISOString().slice(0, 10),
          sold_by: session.user.id,
          lines: [{ product_id: product.id, qty: Number(qty), unit_price: product.sell_price, discount: 0 }],
        }),
      }, session.token)
      setMessage(`Saved ${invoice}`)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the sale')
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold">Sales</h1>
      <form onSubmit={onSubmit} className="mt-4 flex flex-wrap gap-2">
        <select className="rounded-lg border border-stone-300 px-3 py-2" value={customerId} onChange={(event) => setCustomerId(event.target.value)} aria-label="Customer">
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.shop_name}</option>)}
        </select>
        <select className="rounded-lg border border-stone-300 px-3 py-2" value={productId} onChange={(event) => setProductId(event.target.value)} aria-label="Product">
          {products.map((product) => <option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}
        </select>
        <input className="w-24 rounded-lg border border-stone-300 px-3 py-2" aria-label="Quantity" value={qty} onChange={(event) => setQty(event.target.value)} />
        <button className="rounded-lg bg-emerald-700 px-4 py-2 text-white" type="submit">Save sale</button>
      </form>
      {message && <p className="mt-3 text-sm text-emerald-800">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      <ul className="mt-6 grid gap-2">
        {sales.map((sale) => (
          <li key={sale.id} className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm">{sale.invoice_no} · {String(sale.date).slice(0, 10)}</li>
        ))}
      </ul>
    </section>
  )
}
