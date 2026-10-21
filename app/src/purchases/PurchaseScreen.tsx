import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { v7 as uuidv7 } from 'uuid'
import { loadArchived, saveLocal } from '../db/browser'
import type { LocalTables } from '../data/ledger'
import { centsToEuros, centsToInput, parseEuros } from '../shared/money'
import { landedUnitCosts, onOrderQty, purchaseLedgerRows, purchaseStatus, supplierMoney } from '../shared/purchases'
import { editReasonGate } from '../shared/records'
import { lisbonToday } from '../shared/sales'
import { ArchiveDialog, RowActions } from '../ui/RecordActions'
import { ArchivedPanel } from '../ui/ArchivedPanel'
import { RecordTable } from '../ui/RecordTable'
import { offerUndo } from '../ui/undo'
import { FactList, Popup } from '../ui/Popup'

interface DraftLine {
  productId: string
  qty: string
  cost: string
  received: string
}

export function PurchaseScreen({ tables, canManage = true, onSaved }: { tables: LocalTables; canManage?: boolean; onSaved: () => Promise<void> }) {
  const [supplierId, setSupplierId] = useState(() => sessionStorage.getItem('hak.purchaseSupplier') ?? '')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')
  const [received, setReceived] = useState('')
  const [shipping, setShipping] = useState('')
  const [extras, setExtras] = useState<DraftLine[]>([])
  const [open, setOpen] = useState(false)
  const [purchaseParams, setPurchaseParams] = useSearchParams()
  useEffect(() => {
    if (purchaseParams.get('new') !== '1') return
    setEditingId('')
    setOpen(true)
    setPurchaseParams({}, { replace: true })
  }, [purchaseParams, setPurchaseParams])
  const [editingId, setEditingId] = useState('')
  const [previewId, setPreviewId] = useState('')
  const [orderDate, setOrderDate] = useState(lisbonToday())
  const [reason, setReason] = useState('')
  const [warning, setWarning] = useState('')
  const [archiveId, setArchiveId] = useState('')
  const selectedSupplier = tables.suppliers.some((row) => row.id === supplierId) ? supplierId : String(tables.suppliers[0]?.id ?? '')
  const selectedProduct = tables.products.some((row) => row.id === productId) ? productId : String(tables.products[0]?.id ?? '')
  const draft = [
    { productId: selectedProduct, qty, cost, received },
    ...extras,
  ].filter((line) => Number(line.qty) > 0)
  const landed = landedUnitCosts(
    draft.map((line) => ({ qty: Number(line.qty), unitCostCents: parseEuros(line.cost) ?? 0 })),
    parseEuros(shipping) ?? 0,
    'quantity',
  )
  const ordered = draft.reduce((sum, line) => sum + Number(line.qty), 0)
  const arrived = draft.reduce((sum, line) => sum + (line.received === '' ? Number(line.qty) : Number(line.received)), 0)
  const today = lisbonToday()
  const reasonGate = editReasonGate(editingId ? orderDate : today, today, reason)
  const chooseSupplier = (id: string) => {
    sessionStorage.setItem('hak.purchaseSupplier', id)
    setSupplierId(id)
  }
  const productName = (id: string) => {
    const product = tables.products.find((row) => row.id === id)
    return product ? `${product.code} ${product.name}` : 'Product'
  }

  function resetForm() {
    setEditingId('')
    setQty('')
    setCost('')
    setReceived('')
    setShipping('')
    setExtras([])
    setOrderDate(today)
    setReason('')
    setWarning('')
  }

  function loadOrder(purchase: Record<string, unknown>) {
    const lines = tables.purchase_lines.filter((line) => line.purchase_id === purchase.id)
    const [first, ...rest] = lines
    chooseSupplier(String(purchase.supplier_id))
    setOrderDate(String(purchase.date ?? today).slice(0, 10))
    setShipping(Number(purchase.extra_cost ?? 0) === 0 ? '' : centsToInput(Number(purchase.extra_cost)))
    setProductId(first ? String(first.product_id) : '')
    setQty(first ? String(first.qty) : '')
    setCost(first ? centsToInput(Number(first.unit_cost)) : '')
    setReceived(first && first.qty_received != null && first.qty_received !== '' ? String(first.qty_received) : '')
    setExtras(rest.map((line) => ({
      productId: String(line.product_id),
      qty: String(line.qty),
      cost: centsToInput(Number(line.unit_cost)),
      received: line.qty_received == null || line.qty_received === '' ? '' : String(line.qty_received),
    })))
    setEditingId(String(purchase.id))
    setReason('')
    setWarning('')
  }

  const preview = tables.purchases.find((row) => row.id === previewId)
  const previewLines = preview ? purchaseLedgerRows({ purchases: [preview], lines: tables.purchase_lines.filter((line) => line.purchase_id === preview.id) }) : []
  const archive = tables.purchases.find((row) => row.id === archiveId)

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Purchases</h1>
          <p className="lede">Shipping is spread across the pieces. Only the quantity received goes into stock.</p>
        </div>
        {canManage && <button type="button" className="btn" onClick={() => { resetForm(); setPreviewId(''); setOpen(true) }}>New purchase</button>}
      </div>
      <Popup title={editingId ? 'Edit purchase' : 'New purchase'} open={open} onClose={() => setOpen(false)}>
      <form className="form-grid" onSubmit={async (event) => {
        event.preventDefault()
        if (!reasonGate.canSave) {
          setWarning(reasonGate.message)
          return
        }
        const lines = [
          { productId: selectedProduct, qty: Number(qty), received: received === '' ? Number(qty) : Number(received), unitCostCents: parseEuros(cost) },
          ...extras.map((line) => ({ productId: line.productId, qty: Number(line.qty), received: line.received === '' ? Number(line.qty) : Number(line.received), unitCostCents: parseEuros(line.cost) })),
        ].filter((line) => line.qty > 0 && line.productId)
        if (lines.length === 0) return
        if (lines.some((line) => line.unitCostCents == null)) {
          setWarning('Enter the cost per piece in euros, for example 1,20.')
          return
        }
        const shippingCents = shipping.trim() === '' ? 0 : parseEuros(shipping)
        if (shippingCents == null) {
          setWarning('Enter shipping in euros, for example 20,00.')
          return
        }
        const purchaseId = editingId || uuidv7()
        const existing = tables.purchases.find((row) => row.id === purchaseId)
        if (existing) {
          for (const line of tables.purchase_lines.filter((line) => line.purchase_id === purchaseId)) {
            await saveLocal('purchase_lines', { ...line, deleted_at: new Date().toISOString() })
          }
        }
        await saveLocal('purchases', {
          ...(existing ?? {}),
          id: purchaseId,
          supplier_id: selectedSupplier,
          date: existing ? orderDate : today,
          extra_cost: shippingCents,
          deleted_at: null,
        })
        try {
          for (const line of lines) {
            await saveLocal('purchase_lines', {
              id: uuidv7(),
              purchase_id: purchaseId,
              product_id: line.productId,
              qty: line.qty,
              qty_received: line.received,
              unit_cost: line.unitCostCents ?? 0,
            })
          }
        } catch (error) {
          setWarning(error instanceof Error ? error.message : 'Could not save this purchase.')
          return
        }
        resetForm()
        setOpen(false)
        await onSaved()
      }}>
        <label className="control-line">Supplier<select name="supplier_id" aria-label="Supplier" className="control" value={selectedSupplier} onChange={(event) => chooseSupplier(event.target.value)}>{tables.suppliers.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></label>
        <div className="line-grid">
          <label className="control-line">Product<select name="product_id" aria-label="Purchase product" className="control" value={selectedProduct} onChange={(event) => setProductId(event.target.value)}>{tables.products.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></label>
          <label className="control-line">Quantity<input name="qty" type="number" aria-label="Quantity" placeholder="Quantity" required className="control" value={qty} onChange={(event) => setQty(event.target.value)} /></label>
          <label className="control-line">Cost per piece<input name="cost" aria-label="Cost per piece" placeholder="Cost per piece" required className="control" value={cost} onChange={(event) => setCost(event.target.value)} /></label>
          <label className="control-line">Received<input name="received" type="number" aria-label="Received" placeholder="Received" className="control" value={received} onChange={(event) => setReceived(event.target.value)} /></label>
        </div>
        {extras.map((line, index) => (
          <div className="line-grid" key={`${line.productId}-${index}`}>
            <label className="control-line">Product
              <select aria-label={`Purchase line ${index + 2} product`} className="control" value={line.productId} onChange={(event) => setExtras((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, productId: event.target.value } : item))}>{tables.products.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select>
            </label>
            <label className="control-line">Quantity
              <input aria-label={`Purchase line ${index + 2} quantity`} type="number" className="control" value={line.qty} onChange={(event) => setExtras((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, qty: event.target.value } : item))} />
            </label>
            <label className="control-line">Cost per piece
              <input aria-label={`Purchase line ${index + 2} cost`} className="control" value={line.cost} onChange={(event) => setExtras((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, cost: event.target.value } : item))} />
            </label>
            <button type="button" className="btn-ghost" onClick={() => setExtras((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove line</button>
          </div>
        ))}
        <button type="button" className="btn-ghost" onClick={() => setExtras((current) => [...current, { productId: selectedProduct, qty: '1', cost: '', received: '' }])}>Add line</button>
        <label className="control-line">Shipping (EUR)<input name="shipping" aria-label="Shipping" placeholder="Shipping" className="control" value={shipping} onChange={(event) => setShipping(event.target.value)} /></label>
        <p className="quiet">Euros. Spread across the lines by quantity.</p>
        {draft.length > 0 && <p className="lede">Landed cost {centsToEuros(landed[0] ?? 0)} per piece · {purchaseStatus(ordered, arrived)} · {onOrderQty(ordered, arrived)} on order</p>}
        {editingId && reasonGate.needsReason && (
          <label className="control-line">Reason
            <input aria-label="Change reason" className="control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this older record is changing" />
          </label>
        )}
        {warning && <p className="warn">{warning}</p>}
        <button className="btn">{editingId ? 'Save changes' : 'Save purchase'}</button>
      </form>
      </Popup>
      <Popup sheet title="Purchase" open={preview != null} onClose={() => setPreviewId('')}>
        {preview && (
          <div>
            <FactList items={[
              { label: 'Supplier', value: String(tables.suppliers.find((row) => row.id === preview.supplier_id)?.name ?? 'Supplier') },
              { label: 'Date', value: String(preview.date ?? '').slice(0, 10) },
              { label: 'Shipping', value: centsToEuros(Number(preview.extra_cost ?? 0)), wide: true },
            ]} />
            <ul className="record-list">
              {previewLines.map((line) => (
                <li key={line.productId}>{productName(line.productId)} · Ordered {line.qty} · Received {line.receivedQty ?? line.qty} · {centsToEuros(line.unitCostCents)} landed</li>
              ))}
            </ul>
            {canManage && <button type="button" className="btn" onClick={() => { loadOrder(preview); setPreviewId(''); setOpen(true) }}>Edit</button>}
          </div>
        )}
      </Popup>
      <ArchiveDialog
        open={archive != null}
        title="Archive purchase"
        needsReason={editReasonGate(String(archive?.date ?? ''), today, '').needsReason}
        onClose={() => setArchiveId('')}
        onConfirm={async () => {
          if (!archive) return
          const stamp = new Date().toISOString()
          const lines = tables.purchase_lines.filter((line) => line.purchase_id === archive.id)
          await saveLocal('purchases', { ...archive, deleted_at: stamp })
          for (const line of lines) await saveLocal('purchase_lines', { ...line, deleted_at: stamp })
          setArchiveId('')
          offerUndo('Purchase archived', async () => {
            await saveLocal('purchases', { ...archive, deleted_at: null })
            for (const line of lines) await saveLocal('purchase_lines', { ...line, deleted_at: null })
            await onSaved()
          })
          await onSaved()
        }}
      />
      <h2>Orders</h2>
      <RecordTable
        caption="Purchases"
        headers={['Supplier', 'Status', 'Received', 'On order', 'Money']}
        rows={tables.purchases.flatMap((purchase) => {
          const lines = purchaseLedgerRows({ purchases: [purchase], lines: tables.purchase_lines.filter((line) => line.purchase_id === purchase.id) })
          if (lines.length === 0) return []
          const orderedQty = lines.reduce((sum, line) => sum + line.qty, 0)
          const receivedQty = lines.reduce((sum, line) => sum + (line.receivedQty == null ? line.qty : line.receivedQty), 0)
          const total = lines.reduce((sum, line) => sum + line.qty * line.unitCostCents, 0)
          const supplier = String(tables.suppliers.find((row) => row.id === purchase.supplier_id)?.name ?? 'Supplier')
          const status = purchaseStatus(orderedQty, receivedQty)
          return [{
            key: String(purchase.id),
            cells: [
              <span className="cell-main" key="supplier">
                <span>{supplier}</span>
                <RowActions canWrite={canManage} onPreview={() => setPreviewId(String(purchase.id))} onEdit={() => { loadOrder(purchase); setOpen(true) }} onArchive={() => setArchiveId(String(purchase.id))} />
              </span>,
              status,
              `${receivedQty} received`,
              `${onOrderQty(orderedQty, receivedQty)} on order`,
              centsToEuros(total),
            ],
          }]
        })}
      />
      <ArchivedPanel table="purchases" refreshKey={tables.purchases.map((row) => String(row.id)).join(',')} label={(row) => String(tables.suppliers.find((supplier) => supplier.id === row.supplier_id)?.name ?? 'Purchase')} onRestore={async (row) => {
        await saveLocal('purchases', { ...row, deleted_at: null, purged_at: null })
        for (const line of await loadArchived('purchase_lines')) {
          if (line.purchase_id === row.id) await saveLocal('purchase_lines', { ...line, deleted_at: null })
        }
        await onSaved()
      }} onChanged={onSaved} />
      <h2>Supplier balances</h2>
      <ul className="record-list">
        {tables.suppliers.map((supplier) => {
          const money = supplierMoney({ supplierId: String(supplier.id), purchases: tables.purchases, lines: tables.purchase_lines, payments: tables.supplier_payments })
          return <li key={String(supplier.id)}>{String(supplier.name)} · Purchased {centsToEuros(money.purchasedCents)} · Paid {centsToEuros(money.paidCents)} · We owe {centsToEuros(money.owedCents)}</li>
        })}
      </ul>
    </section>
  )
}
