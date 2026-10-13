import * as XLSX from 'xlsx'
import { emptyTables, type LocalTables } from '../data/ledger'
import { eurosToCents } from './money'

function fixedId(table: string, key: string): string {
  const bytes = new Uint8Array(16)
  let state = 0x811c9dc5
  const text = `${table}\n${key}`
  for (let index = 0; index < 16; index += 1) {
    for (let char = 0; char < text.length; char += 1) {
      state ^= text.charCodeAt(char) + index
      state = Math.imul(state, 16777619)
    }
    bytes[index] = state & 0xff
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function sheetRows(book: XLSX.WorkBook, name: string): Record<string, string>[] {
  const sheet = book.Sheets[name]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })
    .filter((row) => Object.values(row).some((value) => String(value).trim() !== ''))
}

function must(map: Map<string, string>, key: string, label: string): string {
  const id = map.get(key)
  if (!id) throw new Error(`Unknown ${label}: ${key}`)
  return id
}

export function tablesFromWorkbook(bytes: ArrayBuffer | Uint8Array): LocalTables {
  const book = XLSX.read(bytes, { type: 'array' })
  const tables = emptyTables()
  const products = new Map<string, string>()
  const customers = new Map<string, string>()
  const suppliers = new Map<string, string>()
  const partners = new Map<string, string>()

  for (const row of sheetRows(book, 'Products')) {
    const code = String(row.code).trim()
    const id = fixedId('products', code)
    products.set(code, id)
    tables.products.push({
      id,
      code,
      name: String(row.name).trim(),
      sell_price: eurosToCents(Number(row.sell_price)),
      alert_level: row.alert_level === '' ? null : Number(row.alert_level),
    })
  }
  for (const row of sheetRows(book, 'Customers')) {
    const shop = String(row.shop_name).trim()
    const id = fixedId('customers', shop)
    customers.set(shop, id)
    tables.customers.push({ id, shop_name: shop })
  }
  for (const row of sheetRows(book, 'Suppliers')) {
    const name = String(row.name).trim()
    const id = fixedId('suppliers', name)
    suppliers.set(name, id)
    tables.suppliers.push({ id, name })
  }
  for (const row of sheetRows(book, 'Partners')) {
    const name = String(row.name).trim()
    const id = fixedId('partners', name)
    partners.set(name, id)
    tables.partners.push({ id, name, share_pct: Number(row.share_pct) })
  }

  const costByProduct = new Map<string, number>()
  for (const row of sheetRows(book, 'Purchases')) {
    const supplier = String(row.supplier).trim()
    const product = String(row.product).trim()
    const date = String(row.date).trim()
    const productId = must(products, product, 'product')
    const purchaseId = fixedId('purchases', `${supplier}|${product}|${date}`)
    const unitCost = eurosToCents(Number(row.unit_cost))
    costByProduct.set(productId, unitCost)
    tables.purchases.push({ id: purchaseId, supplier_id: must(suppliers, supplier, 'supplier'), date })
    tables.purchase_lines.push({
      id: fixedId('purchase_lines', `${purchaseId}|${product}`),
      purchase_id: purchaseId,
      product_id: productId,
      qty: Number(row.qty),
      unit_cost: unitCost,
    })
  }
  sheetRows(book, 'Sales').forEach((row, index) => {
    const customer = String(row.customer).trim()
    const product = String(row.product).trim()
    const date = String(row.date).trim()
    const productId = must(products, product, 'product')
    const saleId = fixedId('sales', `${customer}|${date}|${index}`)
    tables.sales.push({
      id: saleId,
      customer_id: must(customers, customer, 'customer'),
      date,
      invoice_no: `IMP-${index + 1}`,
      sold_by: null,
    })
    tables.sale_lines.push({
      id: fixedId('sale_lines', `${saleId}|${product}`),
      sale_id: saleId,
      product_id: productId,
      qty: Number(row.qty),
      unit_price: eurosToCents(Number(row.unit_price)),
      discount: eurosToCents(Number(row.discount || 0)),
      unit_cost_at_sale: costByProduct.get(productId) ?? 0,
    })
  })
  for (const row of sheetRows(book, 'CustomerPayments')) {
    const customer = String(row.customer).trim()
    const partner = String(row.partner).trim()
    const amount = eurosToCents(Number(row.amount))
    tables.customer_payments.push({
      id: fixedId('customer_payments', `${customer}|${partner}|${amount}`),
      customer_id: must(customers, customer, 'customer'),
      received_by: must(partners, partner, 'partner'),
      amount,
    })
  }
  for (const row of sheetRows(book, 'SupplierPayments')) {
    const supplier = String(row.supplier).trim()
    const partner = String(row.partner).trim()
    const amount = eurosToCents(Number(row.amount))
    tables.supplier_payments.push({
      id: fixedId('supplier_payments', `${supplier}|${partner}|${amount}`),
      supplier_id: must(suppliers, supplier, 'supplier'),
      paid_by: must(partners, partner, 'partner'),
      amount,
      amount_eur: amount,
      currency: 'EUR',
      fx_rate: '1',
    })
  }
  for (const row of sheetRows(book, 'Expenses')) {
    const category = String(row.category).trim()
    const partner = String(row.partner).trim()
    const amount = eurosToCents(Number(row.amount))
    tables.expenses.push({
      id: fixedId('expenses', `${category}|${partner}|${amount}`),
      category,
      amount,
      amount_eur: amount,
      currency: 'EUR',
      fx_rate: '1',
      paid_by: must(partners, partner, 'partner'),
    })
  }
  for (const row of sheetRows(book, 'Transfers')) {
    const from = String(row.from).trim()
    const to = String(row.to).trim()
    const amount = eurosToCents(Number(row.amount))
    tables.partner_transfers.push({
      id: fixedId('partner_transfers', `${from}|${to}|${amount}`),
      from_partner: must(partners, from, 'partner'),
      to_partner: must(partners, to, 'partner'),
      amount,
    })
  }
  for (const row of sheetRows(book, 'Adjustments')) {
    const product = String(row.product).trim()
    const qty = Number(row.qty)
    tables.stock_adjustments.push({
      id: fixedId('stock_adjustments', `${product}|${qty}`),
      product_id: must(products, product, 'product'),
      qty,
      reason: String(row.reason || 'Count'),
    })
  }
  return tables
}

function euros(cents: unknown): number {
  return Number(cents ?? 0) / 100
}

export function tablesToWorkbook(tables: LocalTables): Uint8Array {
  const book = XLSX.utils.book_new()
  const add = (name: string, rows: (string | number)[][]) => {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name)
  }
  const shop = new Map(tables.customers.map((row) => [String(row.id), String(row.shop_name ?? '')]))
  const supplier = new Map(tables.suppliers.map((row) => [String(row.id), String(row.name ?? '')]))
  const partner = new Map(tables.partners.map((row) => [String(row.id), String(row.name ?? '')]))
  const product = new Map(tables.products.map((row) => [String(row.id), String(row.code ?? '')]))
  add('Products', [['code', 'name', 'sell_price', 'alert_level'], ...tables.products.map((row) => [String(row.code ?? ''), String(row.name ?? ''), euros(row.sell_price), row.alert_level == null ? '' : Number(row.alert_level)])])
  add('Customers', [['shop_name'], ...tables.customers.map((row) => [String(row.shop_name ?? '')])])
  add('Suppliers', [['name'], ...tables.suppliers.map((row) => [String(row.name ?? '')])])
  add('Partners', [['name', 'share_pct'], ...tables.partners.map((row) => [String(row.name ?? ''), Number(row.share_pct ?? 0)])])
  add('Purchases', [['supplier', 'product', 'date', 'qty', 'unit_cost'], ...tables.purchase_lines.map((line) => {
    const header = tables.purchases.find((row) => row.id === line.purchase_id)
    return [supplier.get(String(header?.supplier_id)) ?? '', product.get(String(line.product_id)) ?? '', String(header?.date ?? ''), Number(line.qty), euros(line.unit_cost)]
  })])
  add('Sales', [['customer', 'product', 'date', 'qty', 'unit_price', 'discount'], ...tables.sale_lines.map((line) => {
    const header = tables.sales.find((row) => row.id === line.sale_id)
    return [shop.get(String(header?.customer_id)) ?? '', product.get(String(line.product_id)) ?? '', String(header?.date ?? ''), Number(line.qty), euros(line.unit_price), euros(line.discount)]
  })])
  add('CustomerPayments', [['customer', 'partner', 'amount'], ...tables.customer_payments.map((row) => [shop.get(String(row.customer_id)) ?? '', partner.get(String(row.received_by)) ?? '', euros(row.amount)])])
  add('SupplierPayments', [['supplier', 'partner', 'amount'], ...tables.supplier_payments.map((row) => [supplier.get(String(row.supplier_id)) ?? '', partner.get(String(row.paid_by)) ?? '', euros(row.amount_eur ?? row.amount)])])
  add('Expenses', [['category', 'partner', 'amount'], ...tables.expenses.map((row) => [String(row.category ?? ''), partner.get(String(row.paid_by)) ?? '', euros(row.amount_eur ?? row.amount)])])
  add('Transfers', [['from', 'to', 'amount'], ...tables.partner_transfers.map((row) => [partner.get(String(row.from_partner)) ?? '', partner.get(String(row.to_partner)) ?? '', euros(row.amount)])])
  add('Adjustments', [['product', 'qty', 'reason'], ...tables.stock_adjustments.map((row) => [product.get(String(row.product_id)) ?? '', Number(row.qty), String(row.reason ?? 'Count')])])
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

export function goldenTrackerWorkbook(): Uint8Array {
  const book = XLSX.utils.book_new()
  const add = (name: string, rows: (string | number)[][]) => {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name)
  }
  add('Products', [['code', 'name', 'sell_price', 'alert_level'], ['C1', 'Case', 5, 10], ['CH1', 'Charger', 10, 3]])
  add('Customers', [['shop_name'], ['Shop A'], ['Shop B']])
  add('Suppliers', [['name'], ['Shenzhen Co'], ['Lahore Traders']])
  add('Partners', [['name', 'share_pct'], ['Dr. Waseem', 20], ['Haseeb', 40], ['Umar', 40]])
  add('Purchases', [['supplier', 'product', 'date', 'qty', 'unit_cost'], ['Shenzhen Co', 'C1', '2026-01-01', 100, 1], ['Lahore Traders', 'CH1', '2026-01-02', 20, 4]])
  add('Sales', [['customer', 'product', 'date', 'qty', 'unit_price', 'discount'], ['Shop A', 'C1', '2026-01-10', 95, 5, 5], ['Shop B', 'CH1', '2026-01-11', 15, 9, 0]])
  add('CustomerPayments', [['customer', 'partner', 'amount'], ['Shop A', 'Haseeb', 300]])
  add('SupplierPayments', [['supplier', 'partner', 'amount'], ['Shenzhen Co', 'Umar', 100], ['Lahore Traders', 'Haseeb', 80]])
  add('Expenses', [['category', 'partner', 'amount'], ['Freight', 'Dr. Waseem', 20]])
  add('Transfers', [['from', 'to', 'amount'], ['Haseeb', 'Umar', 50]])
  add('Adjustments', [['product', 'qty', 'reason'], ['CH1', -1, 'Count']])
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}
