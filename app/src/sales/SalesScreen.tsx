import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { v7 as uuidv7 } from 'uuid'
import { browserQuery, loadArchived, saveLocal } from '../db/browser'
import type { LocalTables } from '../data/ledger'
import { lineRevenue } from '../shared/calc'
import { shopFigures, stageAfterOrders } from '../shared/crm'
import { shopLabel } from '../shared/labels'
import { centsToEuros, centsToInput, parseEuros } from '../shared/money'
import { documentBrand } from '../shared/brand'
import { settingJson } from '../shared/settings'
import { isMonthLocked, priceForShop, type SpecialPrice } from '../shared/work'
import { allocationsFromCredit, invoiceStandings, paymentCredit } from '../shared/payments'
import {
  averageCostByProduct,
  creditWarningText,
  isRepeatSale,
  lisbonToday,
  nextInvoiceNumber,
  onHandByProduct,
  saleEditGate,
  saleTotalCents,
  stockWarningText,
  type DraftLine,
} from '../shared/sales'
import { downloadInvoicePdf, type InvoicePdfModel } from './invoicePdf'
import { ArchiveDialog, RowActions } from '../ui/RecordActions'
import { ArchivedPanel } from '../ui/ArchivedPanel'
import { RecordTable } from '../ui/RecordTable'
import { offerUndo } from '../ui/undo'
import { Popup } from '../ui/Popup'

export function SalesScreen({ tables, prefix, userId, userName, isSuperAdmin, canManageSales, canEditOwn, onSaved }: {
  tables: LocalTables
  prefix: string
  userId: string
  userName: string
  isSuperAdmin: boolean
  canManageSales: boolean
  canEditOwn: boolean
  onSaved: () => Promise<void>
}) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [warning, setWarning] = useState('')
  const [customerId, setCustomerId] = useState(() => sessionStorage.getItem('hak.saleCustomer') ?? '')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [discount, setDiscount] = useState('')
  const [paidNow, setPaidNow] = useState(false)
  const [paidAmount, setPaidAmount] = useState('')
  const [date, setDate] = useState(lisbonToday())
  const [extras, setExtras] = useState<(DraftLine & { priceText: string })[]>([])
  const [editingId, setEditingId] = useState('')
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)
  const [saleParams, setSaleParams] = useSearchParams()
  useEffect(() => {
    const customer = saleParams.get('customer')
    const invoice = saleParams.get('invoice')
    const openNew = saleParams.get('new') === '1'
    if (!customer && !invoice && !openNew) return
    if (customer) {
      sessionStorage.setItem('hak.saleCustomer', customer)
      setCustomerId(customer)
    }
    if (invoice) {
      const sale = tables.sales.find((row) => row.id === invoice || row.invoice_no === invoice)
      if (sale) setPreviewId(String(sale.id))
    }
    if (openNew) setOpen(true)
    setSaleParams({}, { replace: true })
  }, [saleParams, setSaleParams, tables.sales])
  const [previewId, setPreviewId] = useState('')
  const [archiveId, setArchiveId] = useState('')
  const selectedCustomer = tables.customers.some((row) => row.id === customerId) ? customerId : String(tables.customers[0]?.id ?? '')
  const selectedProduct = tables.products.some((row) => row.id === productId) ? productId : String(tables.products[0]?.id ?? '')
  const today = lisbonToday()
  const averages = averageCostByProduct(tables.purchase_lines.map((line) => ({
    productId: String(line.product_id),
    qty: Number(line.qty),
    unitCostCents: Number(line.unit_cost),
  })))
  const onHand = onHandByProduct({
    purchases: tables.purchase_lines.map((line) => ({
      productId: String(line.product_id),
      qty: line.qty_received == null || line.qty_received === '' ? Number(line.qty) : Number(line.qty_received),
    })),
    sales: tables.sale_lines.map((line) => ({ productId: String(line.product_id), qty: Number(line.qty) })),
    adjustments: tables.stock_adjustments.map((row) => ({ productId: String(row.product_id), qty: Number(row.qty) })),
  })
  const editingLines = tables.sale_lines.filter((line) => line.sale_id === editingId)
  for (const line of editingLines) {
    const id = String(line.product_id)
    onHand.set(id, (onHand.get(id) ?? 0) + Number(line.qty))
  }
  const draft: DraftLine[] = [
    {
      productId: selectedProduct,
      qty: Number(qty || 0),
      unitPriceCents: parseEuros(price) ?? 0,
      discountCents: parseEuros(discount) ?? 0,
    },
    ...extras.map((line) => ({
      productId: line.productId,
      qty: line.qty,
      unitPriceCents: parseEuros(line.priceText) ?? 0,
      discountCents: line.discountCents,
    })),
  ]
  const total = saleTotalCents(draft.filter((line) => line.qty > 0))
  const productName = (id: string) => {
    const product = tables.products.find((row) => row.id === id)
    return product ? String(product.name) : 'Product'
  }
  const stockText = stockWarningText(draft.map((line) => ({
    productId: line.productId,
    name: productName(line.productId),
    qty: line.qty,
    onHand: onHand.get(line.productId) ?? 0,
  })))
  const customer = tables.customers.find((row) => row.id === selectedCustomer)
  const figures = shopFigures({
    customerId: selectedCustomer,
    sales: tables.sales.map((row) => ({ id: String(row.id), customer_id: String(row.customer_id), date: row.date == null ? null : String(row.date) })),
    lines: tables.sale_lines.map((row) => ({ sale_id: String(row.sale_id), qty: Number(row.qty), unit_price: Number(row.unit_price), discount: Number(row.discount ?? 0) })),
    payments: tables.customer_payments.map((row) => ({ customer_id: String(row.customer_id), amount: Number(row.amount) })),
  })
  const previousTotal = editingLines.reduce((sum, line) => sum + lineRevenue(Number(line.qty), Number(line.unit_price), Number(line.discount ?? 0)), 0)
  const limit = customer?.credit_limit == null || customer.credit_limit === '' ? null : Number(customer.credit_limit)
  const creditText = creditWarningText(figures.owedCents - previousTotal, total, limit)
  const liveWarning = [stockText, creditText].filter(Boolean).join(' ')

  const chooseCustomer = (id: string) => {
    sessionStorage.setItem('hak.saleCustomer', id)
    setCustomerId(id)
  }
  const chooseProduct = (id: string) => {
    setProductId(id)
    const product = tables.products.find((row) => row.id === id)
    if (product) setPrice(centsToInput(priceForShop(Number(product.sell_price), settingJson<SpecialPrice[]>(tables.settings, 'special_prices', []), selectedCustomer, id)))
  }
  const shopName = (id: string) => shopLabel(tables.customers.find((row) => row.id === id)?.shop_name)

  function invoiceModel(saleId: string): InvoicePdfModel | null {
    const sale = tables.sales.find((row) => row.id === saleId)
    if (!sale) return null
    const lines = tables.sale_lines.filter((line) => line.sale_id === saleId).map((line) => {
      const qty = Number(line.qty)
      const unitPriceCents = Number(line.unit_price)
      const discountCents = Number(line.discount ?? 0)
      return {
        name: productName(String(line.product_id)),
        qty,
        unitPriceCents,
        discountCents,
        totalCents: lineRevenue(qty, unitPriceCents, discountCents),
      }
    })
    return {
      invoiceNo: String(sale.invoice_no),
      date: String(sale.date ?? ''),
      shop: shopName(String(sale.customer_id)),
      lines,
      totalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
      footer: String(tables.settings.find((row) => row.key === 'invoice_footer')?.value ?? ''),
      brand: documentBrand(tables.settings),
    }
  }

  function beginEdit(sale: Record<string, unknown>) {
    const gate = saleEditGate({
      isSuperAdmin,
      canManageSales,
      canEditOwn,
      sellerId: sale.sold_by == null ? null : String(sale.sold_by),
      currentUserId: userId,
      saleDate: String(sale.date ?? ''),
      today,
      reason: String(sale.note ?? ''),
    })
    if (!gate.canOpen) {
      setWarning(gate.message)
      return
    }
    const lines = tables.sale_lines.filter((line) => line.sale_id === sale.id)
    const [first, ...rest] = lines
    if (!first) return
    chooseCustomer(String(sale.customer_id))
    setProductId(String(first.product_id))
    setQty(String(first.qty))
    setPrice(centsToInput(Number(first.unit_price)))
    setDiscount(Number(first.discount ?? 0) === 0 ? '' : centsToInput(Number(first.discount)))
    setDate(String(sale.date ?? today).slice(0, 10))
    setExtras(rest.map((line) => ({
      productId: String(line.product_id),
      qty: Number(line.qty),
      unitPriceCents: Number(line.unit_price),
      priceText: centsToInput(Number(line.unit_price)),
      discountCents: Number(line.discount ?? 0),
    })))
    setReason(String(sale.note ?? ''))
    setEditingId(String(sale.id))
    setWarning('')
    setOpen(true)
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Sales</h1>
          <p className="lede">Sold by {userName}. Invoice numbers continue from this device. A stock or credit warning does not block the sale.</p>
        </div>
        <button type="button" className="btn" onClick={() => { setEditingId(''); setReason(''); setWarning(''); setExtras([]); setQty(''); setOpen(true) }}>New sale</button>
      </div>
      {!open && warning && <p className="warn">{warning}</p>}
      <Popup title={editingId ? 'Edit sale' : 'New sale'} open={open} onClose={() => setOpen(false)}>
      <form className="form-grid" onSubmit={async (event) => {
        event.preventDefault()
        if (isMonthLocked(date, settingJson<string[]>(tables.settings, 'period_locks', []))) {
          setWarning('This month is locked. Unlock it in Settings before saving.')
          return
        }
        if (lock.current) return
        lock.current = true
        setBusy(true)
        try {
          const form = new FormData(event.currentTarget)
          const lines = draft.filter((line) => line.qty > 0 && line.productId)
          if (lines.length === 0) {
            setWarning('Add at least one line.')
            return
          }
          if (parseEuros(price) == null || (discount.trim() !== '' && parseEuros(discount) == null) || extras.some((line) => line.qty > 0 && parseEuros(line.priceText) == null)) {
            setWarning('Enter prices in euros, for example 5,50.')
            return
          }
          const existingSale = tables.sales.find((row) => row.id === editingId)
          if (existingSale) {
            const gate = saleEditGate({
              isSuperAdmin,
              canManageSales,
              canEditOwn,
              sellerId: existingSale.sold_by == null ? null : String(existingSale.sold_by),
              currentUserId: userId,
              saleDate: String(existingSale.date ?? date),
              today,
              reason,
            })
            if (!gate.canSave) {
              setWarning(gate.message)
              return
            }
          }
          const repeat = isRepeatSale({
            customerId: selectedCustomer,
            lines,
            now: Date.now(),
            ignoreSaleId: editingId || undefined,
            existing: tables.sales.map((sale) => ({
              id: String(sale.id),
              customerId: String(sale.customer_id),
              createdAt: String(sale.created_at ?? 0),
              lines: tables.sale_lines.filter((line) => line.sale_id === sale.id).map((line) => ({
                productId: String(line.product_id),
                qty: Number(line.qty),
                unitPriceCents: Number(line.unit_price),
                discountCents: Number(line.discount ?? 0),
              })),
            })),
          })
          if (repeat && form.get('confirm') !== 'yes') {
            setWarning('Save anyway? Tick confirm and save again.')
            return
          }
          const keptCosts = new Map(editingLines.map((line) => [String(line.product_id), line.unit_cost_at_sale == null ? null : Number(line.unit_cost_at_sale)]))
          let saleId = editingId
          if (existingSale) {
            await saveLocal('sales', { ...existingSale, customer_id: selectedCustomer, date, note: reason.trim() || null, invoice_no: existingSale.invoice_no, sold_by: existingSale.sold_by })
            for (const line of editingLines) await saveLocal('sale_lines', { ...line, deleted_at: new Date().toISOString() })
          } else {
            const counts = await browserQuery<{ invoice_counter: number }>('SELECT invoice_counter FROM sync_state WHERE id = 1')
            const next = nextInvoiceNumber(prefix, counts[0]?.invoice_counter ?? 0, tables.sales.map((sale) => String(sale.invoice_no ?? '')))
            await browserQuery('UPDATE sync_state SET invoice_counter = ? WHERE id = 1', [next])
            saleId = uuidv7()
            await saveLocal('sales', {
              id: saleId,
              invoice_no: `${prefix}-${String(next).padStart(4, '0')}`,
              customer_id: selectedCustomer,
              date,
              sold_by: userId || null,
              note: null,
            })
          }
          for (const line of lines) {
            const frozen = keptCosts.get(line.productId)
            await saveLocal('sale_lines', {
              id: uuidv7(),
              sale_id: saleId,
              product_id: line.productId,
              qty: line.qty,
              unit_price: line.unitPriceCents,
              discount: line.discountCents,
              unit_cost_at_sale: frozen == null ? (averages.get(line.productId) ?? 0) : frozen,
            })
          }
          if (!existingSale) {
            const credit = paymentCredit({
              customerId: selectedCustomer,
              payments: tables.customer_payments.map((row) => ({ id: String(row.id), customer_id: String(row.customer_id), amount: Number(row.amount), created_at: row.created_at == null ? null : String(row.created_at) })),
              allocations: tables.payment_allocations.map((row) => ({ customer_payment_id: String(row.customer_payment_id), amount: Number(row.amount) })),
            })
            const creditRows = allocationsFromCredit(credit, saleId, total)
            for (const row of creditRows) {
              await saveLocal('payment_allocations', { id: uuidv7(), customer_payment_id: row.customerPaymentId, sale_id: row.saleId, amount: row.amountCents })
            }
            if (paidNow) {
              const paid = parseEuros(paidAmount)
              if (paid != null && paid > 0) {
                const paymentId = uuidv7()
                const partner = tables.partners.find((row) => row.user_id === userId)
                const room = Math.max(0, total - creditRows.reduce((sum, row) => sum + row.amountCents, 0))
                await saveLocal('customer_payments', { id: paymentId, customer_id: selectedCustomer, received_by: partner?.id ?? userId, amount: paid, method: 'Cash', deleted_at: null })
                if (room > 0) await saveLocal('payment_allocations', { id: uuidv7(), customer_payment_id: paymentId, sale_id: saleId, amount: Math.min(paid, room) })
              }
            }
            if (customer) {
              const orders = tables.sales.filter((row) => row.customer_id === selectedCustomer).length + 1
              const nextStage = stageAfterOrders(orders, String(customer.status ?? 'lead'))
              if (nextStage !== String(customer.status ?? 'lead')) await saveLocal('customers', { ...customer, status: nextStage })
            }
          }
          setWarning('')
          setQty('')
          setDiscount('')
          setPaidNow(false)
          setPaidAmount('')
          setExtras([])
          setEditingId('')
          setReason('')
          setDate(lisbonToday())
          setOpen(false)
          await onSaved()
        } catch (caught) {
          setWarning(caught instanceof Error ? caught.message : 'Could not save this sale.')
        } finally {
          lock.current = false
          setBusy(false)
        }
      }}>
        <label className="control-line">Shop<select name="customer_id" aria-label="Shop" className="control" value={selectedCustomer} onChange={(event) => chooseCustomer(event.target.value)}>{tables.customers.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.shop_name)}</option>)}</select></label>
        <label className="control-line">Barcode<input aria-label="Scan barcode" placeholder="Scan barcode" className="control" onChange={(event) => {
          const match = tables.products.find((row) => String(row.barcode ?? '') !== '' && String(row.barcode) === event.target.value.trim())
          if (match) chooseProduct(String(match.id))
        }} /></label>
        <div className="line-grid">
          <label className="control-line">Product<select name="product_id" aria-label="Product" className="control" value={selectedProduct} onChange={(event) => chooseProduct(event.target.value)}>{tables.products.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.code)} {String(row.name)}</option>)}</select></label>
          <label className="control-line">Quantity<input name="qty" type="number" aria-label="Quantity" placeholder="Quantity" required className="control" value={qty} onChange={(event) => setQty(event.target.value)} /></label>
          <label className="control-line">Unit price<input name="price" aria-label="Unit price" placeholder="Unit price" required className="control" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
          <label className="control-line">Discount<input name="discount" aria-label="Discount" placeholder="Discount" className="control" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
        </div>
        {extras.map((line, index) => (
          <div className="line-grid" key={`${line.productId}-${index}`}>
            <label className="control-line">Product
              <select aria-label={`Line ${index + 2} product`} className="control" value={line.productId} onChange={(event) => {
                const id = event.target.value
                const product = tables.products.find((row) => row.id === id)
                setExtras((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, productId: id, unitPriceCents: product ? Number(product.sell_price) : item.unitPriceCents, priceText: product ? centsToInput(Number(product.sell_price)) : item.priceText } : item))
              }}>{tables.products.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.code)} {String(row.name)}</option>)}</select>
            </label>
            <label className="control-line">Quantity
              <input aria-label={`Line ${index + 2} quantity`} type="number" className="control" value={line.qty} onChange={(event) => setExtras((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, qty: Number(event.target.value) } : item))} />
            </label>
            <label className="control-line">Unit price
              <input aria-label={`Line ${index + 2} price`} className="control" value={line.priceText} onChange={(event) => setExtras((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, priceText: event.target.value } : item))} />
            </label>
            <button type="button" className="btn-ghost" onClick={() => setExtras((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove line</button>
          </div>
        ))}
        <button type="button" className="btn-ghost" onClick={() => {
          const product = tables.products.find((row) => row.id === selectedProduct)
          setExtras((current) => [...current, { productId: selectedProduct, qty: 1, unitPriceCents: Number(product?.sell_price ?? 0), priceText: centsToInput(Number(product?.sell_price ?? 0)), discountCents: 0 }])
        }}>Add line</button>
        <label className="control-line">Sale date<input name="date" type="date" aria-label="Sale date" className="control" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <p className="lede">Invoice total {centsToEuros(total)}</p>
        {!editingId && <label className="check"><input type="checkbox" checked={paidNow} onChange={(event) => setPaidNow(event.target.checked)} /> Paid now</label>}
        {paidNow && !editingId && <label className="control-line">Received now<input aria-label="Received now" className="control" value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} placeholder="Amount" /></label>}
        {liveWarning && <p className="warn" role="status">{liveWarning}</p>}
        {editingId && saleEditGate({
          isSuperAdmin,
          canManageSales,
          canEditOwn,
          sellerId: tables.sales.find((row) => row.id === editingId)?.sold_by == null ? null : String(tables.sales.find((row) => row.id === editingId)?.sold_by),
          currentUserId: userId,
          saleDate: String(tables.sales.find((row) => row.id === editingId)?.date ?? date),
          today,
          reason,
        }).needsReason && <label className="control-line">Edit reason<input aria-label="Edit reason" className="control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for editing an older sale" /></label>}
        {(liveWarning || warning) && <label className="check"><input type="checkbox" name="confirm" value="yes" /> Save anyway</label>}
        {warning && <p className="warn">{warning}</p>}
        <button className="btn" disabled={busy}>{editingId ? 'Save changes' : 'Save sale'}</button>
      </form>
      </Popup>
      <Popup title="Invoice" open={previewId !== '' && invoiceModel(previewId) != null} onClose={() => setPreviewId('')}>
        {(() => {
          const model = invoiceModel(previewId)
          const sale = tables.sales.find((row) => row.id === previewId)
          if (!model || !sale) return null
          const customer = tables.customers.find((row) => row.id === sale.customer_id)
          const sellerId = sale.sold_by == null ? '' : String(sale.sold_by)
          const seller = tables.partners.find((row) => row.user_id === sellerId || row.id === sellerId)
          const sellerName = seller ? String(seller.name) : sellerId === userId ? userName : ''
          const standing = invoiceStandings({
            sales: [{ id: String(sale.id), invoice_no: model.invoiceNo, customer_id: String(sale.customer_id), date: model.date }],
            lines: tables.sale_lines.filter((line) => line.sale_id === sale.id).map((line) => ({ sale_id: String(line.sale_id), qty: Number(line.qty), unit_price: Number(line.unit_price), discount: Number(line.discount ?? 0) })),
            allocations: tables.payment_allocations.filter((row) => row.sale_id === sale.id).map((row) => ({ sale_id: String(row.sale_id), amount: Number(row.amount) })),
            today,
          })[0]
          const shopLines = [customer?.phone, customer?.city, customer?.nif ? `NIF ${customer.nif}` : '', customer?.address].map((part) => String(part ?? '').trim()).filter(Boolean)
          const brand = model.brand ?? documentBrand([])
          return (
            <>
              <article className="invoice-sheet">
                <header className="invoice-head" style={{ background: brand.color }}>
                  <div className="invoice-lockup">
                    {brand.logo ? <img className="invoice-logo" src={brand.logo} alt="" /> : <span className="mark" aria-hidden="true"><i style={{ background: brand.color }} /><i style={{ background: brand.color }} /></span>}
                    <div>
                      <p className="invoice-brand">{brand.name}</p>
                      <p className="invoice-kicker">{brand.kicker}</p>
                    </div>
                  </div>
                  <div className="invoice-meta">
                    <p className="invoice-no">{model.invoiceNo}</p>
                    <p>{model.date.slice(0, 10)}</p>
                    {standing && <p className="invoice-status" data-status={standing.status}>{standing.status}</p>}
                  </div>
                </header>
                <div className="invoice-body">
                <div className="invoice-parties">
                  <div>
                    <p className="invoice-label">Bill to</p>
                    <p className="invoice-party">{model.shop}</p>
                    {shopLines.map((line) => <p key={line}>{line}</p>)}
                  </div>
                  <div>
                    <p className="invoice-label">Sold by</p>
                    <p className="invoice-party">{sellerName || '—'}</p>
                  </div>
                </div>
                <table className="invoice-lines">
                  <thead>
                    <tr><th>Product</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {model.lines.map((line, index) => (
                      <tr key={`${line.name}-${index}`}>
                        <td>{line.name}{line.discountCents > 0 ? ` · discount ${centsToEuros(line.discountCents)}` : ''}</td>
                        <td>{line.qty}</td>
                        <td>{centsToEuros(line.unitPriceCents)}</td>
                        <td>{centsToEuros(line.totalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <dl className="invoice-totals">
                  <div><dt>Total</dt><dd>{centsToEuros(model.totalCents)}</dd></div>
                  <div><dt>Paid</dt><dd>{centsToEuros(standing?.paidCents ?? 0)}</dd></div>
                  <div className="due"><dt>Left</dt><dd>{centsToEuros(Math.max(0, model.totalCents - (standing?.paidCents ?? 0)))}</dd></div>
                </dl>
                </div>
                <footer className="invoice-foot" style={{ background: brand.color }}>
                  {brand.logo ? <img className="invoice-logo small" src={brand.logo} alt="" /> : <span className="mark" aria-hidden="true"><i style={{ background: brand.color }} /><i style={{ background: brand.color }} /></span>}
                  <p>{model.footer || brand.footer}</p>
                </footer>
              </article>
              <div className="invoice-actions">
                <button type="button" className="btn" onClick={() => window.print()}>Print</button>
              </div>
            </>
          )
        })()}
      </Popup>
      <ArchiveDialog
        open={archiveId !== ''}
        title="Archive invoice"
        needsReason={saleEditGate({
          isSuperAdmin,
          canManageSales,
          canEditOwn,
          sellerId: tables.sales.find((row) => row.id === archiveId)?.sold_by == null ? null : String(tables.sales.find((row) => row.id === archiveId)?.sold_by),
          currentUserId: userId,
          saleDate: String(tables.sales.find((row) => row.id === archiveId)?.date ?? ''),
          today,
          reason: '',
        }).needsReason}
        onClose={() => setArchiveId('')}
        onConfirm={async () => {
          const sale = tables.sales.find((row) => row.id === archiveId)
          if (!sale) return
          const stamp = new Date().toISOString()
          const lines = tables.sale_lines.filter((line) => line.sale_id === sale.id)
          const allocations = tables.payment_allocations.filter((row) => row.sale_id === sale.id)
          await saveLocal('sales', { ...sale, deleted_at: stamp })
          for (const line of lines) await saveLocal('sale_lines', { ...line, deleted_at: stamp })
          for (const row of allocations) await saveLocal('payment_allocations', { ...row, deleted_at: stamp })
          setArchiveId('')
          offerUndo('Invoice archived', async () => {
            await saveLocal('sales', { ...sale, deleted_at: null })
            for (const line of lines) await saveLocal('sale_lines', { ...line, deleted_at: null })
            for (const row of allocations) await saveLocal('payment_allocations', { ...row, deleted_at: null })
            await onSaved()
          })
          await onSaved()
        }}
      />
      <h2>Invoices</h2>
      <RecordTable
        caption="Invoices"
        headers={['Invoice', 'Shop', 'Lines', 'Total']}
        statusColumn={-1}
        rows={tables.sales.flatMap((sale) => {
          const model = invoiceModel(String(sale.id))
          if (!model) return []
          const gate = saleEditGate({
            isSuperAdmin,
            canManageSales,
            canEditOwn,
            sellerId: sale.sold_by == null ? null : String(sale.sold_by),
            currentUserId: userId,
            saleDate: String(sale.date ?? ''),
            today,
            reason: '',
          })
          return [{
            key: String(sale.id),
            cells: [
              <span className="cell-main" key="invoice">
                <span>{model.invoiceNo}</span>
                <RowActions
                  canWrite={gate.canOpen}
                  onPreview={() => setPreviewId(String(sale.id))}
                  onEdit={() => beginEdit(sale)}
                  onArchive={() => setArchiveId(String(sale.id))}
                  extra={[{ label: 'Invoice PDF', onSelect: () => { void downloadInvoicePdf(model).catch((caught: unknown) => setWarning(caught instanceof Error ? caught.message : 'Could not open the invoice PDF')) } }]}
                />
              </span>,
              model.shop,
              `${model.lines.length} lines`,
              centsToEuros(model.totalCents),
            ],
          }]
        })}
      />
      <ArchivedPanel table="sales" refreshKey={tables.sales.map((row) => String(row.id)).join(',')} label={(row) => String(row.invoice_no ?? 'Invoice')} onRestore={async (row) => {
        await saveLocal('sales', { ...row, deleted_at: null, purged_at: null })
        for (const line of await loadArchived('sale_lines')) {
          if (line.sale_id === row.id) await saveLocal('sale_lines', { ...line, deleted_at: null })
        }
        for (const item of await loadArchived('payment_allocations')) {
          if (item.sale_id === row.id) await saveLocal('payment_allocations', { ...item, deleted_at: null })
        }
        await onSaved()
      }} onChanged={onSaved} />
    </section>
  )
}
