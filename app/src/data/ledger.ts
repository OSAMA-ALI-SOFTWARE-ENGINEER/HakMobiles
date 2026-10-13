import { GOLDEN_IDS, goldenLedger, summarize, type LedgerInput, type Summary } from '../shared/calc'
import { sampleInvoiceNo } from '../shared/labels'
import { purchaseLedgerRows } from '../shared/purchases'

export interface LocalTables {
  products: Record<string, unknown>[]
  purchases: Record<string, unknown>[]
  purchase_lines: Record<string, unknown>[]
  sales: Record<string, unknown>[]
  sale_lines: Record<string, unknown>[]
  stock_adjustments: Record<string, unknown>[]
  customer_payments: Record<string, unknown>[]
  supplier_payments: Record<string, unknown>[]
  expenses: Record<string, unknown>[]
  partner_transfers: Record<string, unknown>[]
  partners: Record<string, unknown>[]
  customers: Record<string, unknown>[]
  suppliers: Record<string, unknown>[]
  customer_activities: Record<string, unknown>[]
  follow_ups: Record<string, unknown>[]
  payment_allocations: Record<string, unknown>[]
  settings: Record<string, unknown>[]
}

export function emptyTables(): LocalTables {
  return {
    products: [],
    purchases: [],
    purchase_lines: [],
    sales: [],
    sale_lines: [],
    stock_adjustments: [],
    customer_payments: [],
    supplier_payments: [],
    expenses: [],
    partner_transfers: [],
    partners: [],
    customers: [],
    suppliers: [],
    customer_activities: [],
    follow_ups: [],
    payment_allocations: [],
    settings: [],
  }
}

export function ledgerFromTables(tables: LocalTables): LedgerInput {
  const customerName = new Map(tables.customers.map((row) => [String(row.id), String(row.shop_name)]))
  const linesBySale = new Map<string, LedgerInput['sales'][number]['lines']>()
  for (const line of tables.sale_lines) {
    const saleId = String(line.sale_id)
    const lines = linesBySale.get(saleId) ?? []
    lines.push({
      productId: String(line.product_id),
      qty: Number(line.qty),
      unitPriceCents: Number(line.unit_price),
      discountCents: Number(line.discount ?? 0),
      unitCostAtSaleCents: line.unit_cost_at_sale == null || line.unit_cost_at_sale === '' ? null : Number(line.unit_cost_at_sale),
    })
    linesBySale.set(saleId, lines)
  }

  return {
    defaultAlert: 10,
    products: tables.products.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      alertLevel: row.alert_level == null ? null : Number(row.alert_level),
    })),
    purchases: purchaseLedgerRows({
      purchases: tables.purchases,
      lines: tables.purchase_lines.map((line) => ({
        purchase_id: String(line.purchase_id),
        product_id: String(line.product_id),
        qty: line.qty,
        qty_received: line.qty_received,
        unit_cost: line.unit_cost,
      })),
    }),
    adjustments: tables.stock_adjustments.map((row) => ({
      productId: String(row.product_id),
      qty: Number(row.qty),
    })),
    sales: tables.sales.map((sale) => ({
      id: String(sale.id),
      customerId: String(sale.customer_id),
      customerName: customerName.get(String(sale.customer_id)) ?? 'Customer',
      date: String(sale.date),
      lines: linesBySale.get(String(sale.id)) ?? [],
    })),
    customerPayments: tables.customer_payments.map((row) => ({
      customerId: String(row.customer_id),
      receivedBy: String(row.received_by),
      amountCents: Number(row.amount),
    })),
    supplierPayments: tables.supplier_payments.map((row) => ({
      supplierId: String(row.supplier_id),
      paidBy: String(row.paid_by),
      amountEurCents: Number(row.amount_eur),
    })),
    expenses: tables.expenses.map((row) => ({
      paidBy: String(row.paid_by),
      amountEurCents: Number(row.amount_eur),
    })),
    transfers: tables.partner_transfers.map((row) => ({
      fromPartnerId: String(row.from_partner),
      toPartnerId: String(row.to_partner),
      amountCents: Number(row.amount),
    })),
    partners: tables.partners.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      sharePct: Number(row.share_pct),
    })),
  }
}

export function summarizeTables(tables: LocalTables): Summary {
  return summarize(ledgerFromTables(tables))
}

export function goldenTables(): LocalTables {
  const golden = goldenLedger()
  return {
    products: golden.products.map((product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      alert_level: product.alertLevel,
      sell_price: product.id === GOLDEN_IDS.c1 ? 500 : 1000,
    })),
    customers: [
      { id: GOLDEN_IDS.shopA, shop_name: 'Shop A', status: 'active' },
      { id: GOLDEN_IDS.shopB, shop_name: 'Shop B', status: 'first_order' },
    ],
    suppliers: [
      { id: GOLDEN_IDS.shenzhen, name: 'Shenzhen Co' },
      { id: GOLDEN_IDS.lahore, name: 'Lahore Traders' },
    ],
    partners: golden.partners.map((partner) => ({
      id: partner.id,
      name: partner.name,
      share_pct: partner.sharePct,
    })),
    purchases: [
      { id: '01900000-0000-7000-8000-000000000061', supplier_id: GOLDEN_IDS.shenzhen, date: '2026-01-01' },
      { id: '01900000-0000-7000-8000-000000000062', supplier_id: GOLDEN_IDS.lahore, date: '2026-01-02' },
    ],
    purchase_lines: [
      { id: '01900000-0000-7000-8000-000000000071', purchase_id: '01900000-0000-7000-8000-000000000061', product_id: GOLDEN_IDS.c1, qty: 100, unit_cost: 100 },
      { id: '01900000-0000-7000-8000-000000000072', purchase_id: '01900000-0000-7000-8000-000000000062', product_id: GOLDEN_IDS.ch1, qty: 20, unit_cost: 400 },
    ],
    stock_adjustments: [{ id: '01900000-0000-7000-8000-000000000081', product_id: GOLDEN_IDS.ch1, qty: -1, reason: 'Count' }],
    sales: golden.sales.map((sale, index) => ({
      id: sale.id,
      customer_id: sale.customerId,
      date: sale.date,
      invoice_no: sampleInvoiceNo(index),
      sold_by: 'haseeb',
    })),
    sale_lines: golden.sales.flatMap((sale) =>
      sale.lines.map((line, index) => ({
        id: index === 0 && sale.id === GOLDEN_IDS.saleA
          ? '01900000-0000-7000-8000-0000000000a1'
          : '01900000-0000-7000-8000-0000000000a2',
        sale_id: sale.id,
        product_id: line.productId,
        qty: line.qty,
        unit_price: line.unitPriceCents,
        discount: line.discountCents,
        unit_cost_at_sale: line.productId === GOLDEN_IDS.c1 ? 100 : 400,
      })),
    ),
    customer_payments: golden.customerPayments.map((payment, index) => ({
      id: `01900000-0000-7000-8000-0000000000b${index}`,
      customer_id: payment.customerId,
      received_by: payment.receivedBy,
      amount: payment.amountCents,
    })),
    supplier_payments: [
      { id: '01900000-0000-7000-8000-000000000091', supplier_id: GOLDEN_IDS.shenzhen, paid_by: GOLDEN_IDS.umar, amount: 10800, currency: 'USD', fx_rate: '1.08', amount_eur: 10000 },
      { id: '01900000-0000-7000-8000-000000000092', supplier_id: GOLDEN_IDS.lahore, paid_by: GOLDEN_IDS.haseeb, amount: 8000, currency: 'EUR', fx_rate: '1', amount_eur: 8000 },
    ],
    expenses: [{ id: '01900000-0000-7000-8000-000000000093', category: 'Freight', amount: 2000, amount_eur: 2000, paid_by: GOLDEN_IDS.waseem, currency: 'EUR', fx_rate: '1' }],
    partner_transfers: [{ id: '01900000-0000-7000-8000-000000000094', from_partner: GOLDEN_IDS.haseeb, to_partner: GOLDEN_IDS.umar, amount: 5000 }],
    customer_activities: [],
    follow_ups: [],
    payment_allocations: [],
    settings: [],
  }
}
