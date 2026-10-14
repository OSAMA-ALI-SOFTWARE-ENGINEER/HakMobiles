import { useState } from 'react'
import { v7 as uuidv7 } from 'uuid'
import { saveLocal } from '../db/browser'
import type { LocalTables } from '../data/ledger'
import { settingList, settingNumber } from '../shared/settings'
import { centsToEuros } from '../shared/money'
import { Popup } from '../ui/Popup'

const footerKey = 'invoice_footer'

const fallbackCategories = ['Cases', 'Chargers', 'Cables', 'Protection']
const fallbackColours = ['Black', 'White', 'Clear']
const fallbackMethods = ['Cash', 'Bank Transfer', 'MB Way', 'Card', 'Cheque']
const fallbackExpenses = ['Rent', 'Freight', 'Utilities', 'Other']

function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('')
  return (
    <section className="panel">
      <h2>{label}</h2>
      {items.length === 0 && <p className="quiet">Nothing in this list yet.</p>}
      <ul className="record-list">
        {items.map((item) => (
          <li key={item}>
            <span>{item}</span>
            <button type="button" className="btn-ghost" onClick={() => onChange(items.filter((entry) => entry !== item))}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="tool-row">
        <label className="control-line">Add {label.toLowerCase()}
          <input aria-label={`Add ${label}`} className="control" value={draft} onChange={(event) => setDraft(event.target.value)} />
        </label>
        <button type="button" className="btn" onClick={() => {
          const next = draft.trim()
          if (next === '' || items.includes(next)) return
          onChange([...items, next])
          setDraft('')
        }}>Add</button>
      </div>
    </section>
  )
}

export function SettingsScreen({ tables, onSaved, onLoadSample, onImport }: {
  tables: LocalTables
  onSaved: () => Promise<void>
  onLoadSample?: () => Promise<void>
  onImport?: (bytes: ArrayBuffer) => Promise<void>
}) {
  const current = tables.settings.find((row) => row.key === footerKey)
  const [footer, setFooter] = useState(String(current?.value ?? 'Internal invoice. Not a certified tax document.'))
  const [saved, setSaved] = useState(false)
  const [open, setOpen] = useState(false)
  const [overdue, setOverdue] = useState(String(settingNumber(tables.settings, 'overdue_days', 30)))
  const [confirmSample, setConfirmSample] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)

  async function saveSetting(key: string, value: unknown) {
    const existing = tables.settings.find((row) => row.key === key)
    await saveLocal('settings', { id: existing?.id ?? uuidv7(), key, value: typeof value === 'string' ? value : JSON.stringify(value), deleted_at: null })
    await onSaved()
  }

  return (
    <section className="page insight-page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="lede">Lists used on products, payments and expenses, plus the invoice footer.</p>
        </div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>Edit invoice footer</button>
      </div>
      <p className="panel">{footer}</p>
      {saved && <p className="lede">Saved. The next invoice uses this footer.</p>}
      <Popup title="Invoice footer" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault()
          await saveSetting(footerKey, footer)
          setSaved(true)
          setOpen(false)
        }}>
          <label className="control-line">Invoice footer
            <textarea aria-label="Invoice footer" className="control" value={footer} onChange={(event) => setFooter(event.target.value)} rows={3} />
          </label>
          <button className="btn">Save settings</button>
        </form>
      </Popup>
      <ListEditor label="Product categories" items={settingList(tables.settings, 'categories', fallbackCategories)} onChange={(next) => void saveSetting('categories', next)} />
      <ListEditor label="Colours" items={settingList(tables.settings, 'colours', fallbackColours)} onChange={(next) => void saveSetting('colours', next)} />
      <ListEditor label="Payment methods" items={settingList(tables.settings, 'payment_methods', fallbackMethods)} onChange={(next) => void saveSetting('payment_methods', next)} />
      <ListEditor label="Expense categories" items={settingList(tables.settings, 'expense_categories', fallbackExpenses)} onChange={(next) => void saveSetting('expense_categories', next)} />
      <form className="panel form-grid" onSubmit={(event) => { event.preventDefault(); void saveSetting('overdue_days', Number(overdue) || 30) }}>
        <h2>Overdue days</h2>
        <label className="control-line">Days after the invoice date
          <input aria-label="Overdue days" className="control" type="number" min={1} value={overdue} onChange={(event) => setOverdue(event.target.value)} />
        </label>
        <button className="btn">Save overdue days</button>
      </form>
      {onLoadSample && (
        <section className="panel data-tools">
          <h2>Replace business data</h2>
          <p className="quiet">These replace the current business. Each one asks you to confirm first.</p>
          <div className="tool-row">
            <button type="button" className="btn-ghost" onClick={() => setConfirmSample(true)}>Load sample data</button>
            {onImport && (
              <label className="btn-ghost file-btn">Import tracker workbook
                <input aria-label="Import tracker workbook" className="sr-only" type="file" accept=".xlsx,.xls" onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  event.currentTarget.value = ''
                  if (file) setImportFile(file)
                }} />
              </label>
            )}
            {onImport && (
              <label className="btn-ghost file-btn">Restore backup
                <input aria-label="Restore backup" className="sr-only" type="file" accept=".xlsx,.xls" onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  event.currentTarget.value = ''
                  if (file) setRestoreFile(file)
                }} />
              </label>
            )}
          </div>
        </section>
      )}
      <Popup title="Load sample data" open={confirmSample} onClose={() => setConfirmSample(false)}>
        <form className="form-grid" onSubmit={(event) => {
          event.preventDefault()
          setConfirmSample(false)
          if (onLoadSample) void onLoadSample()
        }}>
          <p className="lede">This replaces the current business with the sample ledger. Sales become {centsToEuros(60500)}.</p>
          <button className="btn-danger">Replace with sample</button>
        </form>
      </Popup>
      <Popup title="Import tracker workbook" open={importFile != null} onClose={() => setImportFile(null)}>
        <form className="form-grid" onSubmit={(event) => {
          event.preventDefault()
          const file = importFile
          setImportFile(null)
          if (!file || !onImport) return
          void file.arrayBuffer().then((bytes) => onImport(bytes)).catch((caught: unknown) => window.alert(caught instanceof Error ? caught.message : 'The tracker file could not be imported.'))
        }}>
          <p className="lede">This replaces the current business with the rows in {importFile?.name ?? 'the workbook'}.</p>
          <button className="btn-danger">Replace with workbook</button>
        </form>
      </Popup>
      <Popup title="Restore backup" open={restoreFile != null} onClose={() => setRestoreFile(null)}>
        <form className="form-grid" onSubmit={(event) => {
          event.preventDefault()
          const file = restoreFile
          setRestoreFile(null)
          if (!file || !onImport) return
          void file.arrayBuffer().then((bytes) => onImport(bytes)).catch((caught: unknown) => window.alert(caught instanceof Error ? caught.message : 'The backup could not be restored.'))
        }}>
          <p className="lede">This replaces the current business with {restoreFile?.name ?? 'the backup'}.</p>
          <button className="btn-danger">Replace with backup</button>
        </form>
      </Popup>
    </section>
  )
}
