import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { isSuperAdmin, useSession } from '../lib/session'
import { summarize, type LedgerInput } from '../shared/calc'
import { centsToEuros, eurosToCents } from '../shared/money'

type Row = Record<string, unknown>

function money(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value ?? 0)
  return eurosToCents(Number.isFinite(number) ? number : 0)
}

export function DashboardPage() {
  const { session } = useSession()
  const [summary, setSummary] = useState<ReturnType<typeof summarize> | null>(null)
  const [error, setError] = useState('')
  const showProfit = !!session && (isSuperAdmin(session) || session.permissions.includes('dashboard.view_profit'))

  useEffect(() => {
    if (!session) return
    const token = session.token
    async function load(path: string): Promise<Row[]> {
      try {
        const body = await api<{ data: Row[] }>(path, {}, token)
        return body.data ?? []
      } catch {
        return []
      }
    }

    Promise.all([
      load('/api/products'),
      load('/api/purchases'),
      load('/api/sales'),
      load('/api/customer-payments'),
      load('/api/supplier-payments'),
      load('/api/expenses'),
      load('/api/partner-transfers'),
      load('/api/partners'),
      load('/api/customers'),
    ]).then(([products, purchases, sales, customerPayments, supplierPayments, expenses, transfers, partners, customers]) => {
      const names = new Map(customers.map((customer) => [String(customer.id), String(customer.shop_name)]))
      const input: LedgerInput = {
        defaultAlert: 10,
        products: products.map((product) => ({
          id: String(product.id),
          code: String(product.code),
          name: String(product.name),
          alertLevel: product.alert_level == null ? null : Number(product.alert_level),
        })),
        purchases: purchases.flatMap((purchase) => {
          const lines = Array.isArray(purchase.lines) ? purchase.lines as Row[] : []
          return lines.map((line) => ({
            supplierId: String(purchase.supplier_id),
            productId: String(line.product_id),
            qty: Number(line.qty),
            unitCostCents: money(line.unit_cost),
          }))
        }),
        adjustments: [],
        sales: sales.map((sale) => ({
          id: String(sale.id),
          customerId: String(sale.customer_id),
          customerName: names.get(String(sale.customer_id)) ?? 'Customer',
          date: String(sale.date).slice(0, 10),
          lines: (Array.isArray(sale.lines) ? sale.lines as Row[] : []).map((line) => ({
            productId: String(line.product_id),
            qty: Number(line.qty),
            unitPriceCents: money(line.unit_price),
            discountCents: money(line.discount),
          })),
        })),
        customerPayments: customerPayments.map((payment) => ({
          customerId: String(payment.customer_id),
          receivedBy: String(payment.received_by ?? ''),
          amountCents: money(payment.amount),
        })),
        supplierPayments: supplierPayments.map((payment) => ({
          supplierId: String(payment.supplier_id),
          paidBy: String(payment.paid_by ?? ''),
          amountEurCents: money(payment.amount_eur),
        })),
        expenses: expenses.map((expense) => ({
          paidBy: String(expense.paid_by ?? ''),
          amountEurCents: money(expense.amount_eur),
        })),
        transfers: transfers.map((transfer) => ({
          fromPartnerId: String(transfer.from_partner),
          toPartnerId: String(transfer.to_partner),
          amountCents: money(transfer.amount),
        })),
        partners: partners.map((partner) => ({
          id: String(partner.id),
          name: String(partner.name),
          sharePct: Number(partner.share_pct),
        })),
      }
      setSummary(summarize(input))
    }).catch((caught: Error) => setError(caught.message))
  }, [session])

  const cards = summary
    ? [
        ['Sales', centsToEuros(summary.revenueCents)],
        ['Customers owe', centsToEuros(summary.customersOweCents)],
        ['We owe suppliers', centsToEuros(summary.suppliersOweCents)],
        ['Stock value', centsToEuros(summary.stockValueCents)],
        ...(showProfit
          ? [
              ['Net profit', centsToEuros(summary.netProfitCents)],
              ['Margin', `${summary.marginPercent}%`],
            ]
          : []),
      ]
    : []

  return (
    <section>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-stone-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </div>
      {showProfit && summary && (
        <article className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-medium">Who owes whom</h2>
          <p className="mt-2 text-sm" data-testid="who-owes">{summary.whoOwesWhom}</p>
          <ul className="mt-3 text-sm text-stone-600">
            {summary.partnerBalances.map((partner) => (
              <li key={partner.id}>{partner.name}: {centsToEuros(partner.balanceCents)} · share {centsToEuros(partner.shareCents)}</li>
            ))}
          </ul>
        </article>
      )}
      {summary && (
        <ul className="mt-4 grid gap-2">
          {summary.stock.map((item) => (
            <li key={item.code} className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
              {item.code}: {item.qty} pcs <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5">{item.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
