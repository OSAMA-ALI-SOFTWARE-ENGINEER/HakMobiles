import { useState } from 'react'
import { v7 as uuidv7 } from 'uuid'
import { saveLocal } from '../db/browser'
import type { LocalTables } from '../data/ledger'
import { BRAND_PRESETS, brandPreset, documentBrand } from '../shared/brand'
import { settingJson, settingList, settingNumber, settingText } from '../shared/settings'
import { centsToEuros } from '../shared/money'
import { Popup } from '../ui/Popup'

const footerKey = 'invoice_footer'

const fallbackCategories = ['Cases', 'Chargers', 'Cables', 'Protection']
const fallbackColours = ['Black', 'White', 'Clear']
const fallbackMethods = ['Cash', 'Bank Transfer', 'MB Way', 'Card', 'Cheque']
const fallbackExpenses = ['Rent', 'Freight', 'Utilities', 'Other']

function fitLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The logo could not be read.'))
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const limit = 160
        const scale = Math.min(1, limit / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        if (!context) { reject(new Error('The logo could not be prepared.')); return }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      }
      image.onerror = () => reject(new Error('Choose a PNG or JPG logo.'))
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function ListEditor({ label, hint, items, onChange }: { label: string; hint: string; items: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  return (
    <section className="panel settings-card">
      <h3>{label}</h3>
      <p className="quiet">{hint}</p>
      {items.length === 0 && <p className="quiet">Nothing here yet. Add the first name below.</p>}
      <ul className="choice-list">
        {items.map((item) => (
          <li key={item}>
            <span>{item}</span>
            <button type="button" className="btn-ghost" aria-label={`Remove ${item}`} onClick={() => onChange(items.filter((entry) => entry !== item))}>Remove</button>
          </li>
        ))}
      </ul>
      <form className="choice-add" onSubmit={(event) => {
        event.preventDefault()
        const next = draft.trim()
        if (next === '') return
        if (items.includes(next)) { setError('That name is already in the list.'); return }
        onChange([...items, next])
        setDraft('')
        setError('')
      }}>
        <label className="control-line">
          <span className="sr-only">Add {label.toLowerCase()}</span>
          <input aria-label={`Add ${label}`} className="control" placeholder="Type a name" value={draft} onChange={(event) => { setDraft(event.target.value); setError('') }} />
        </label>
        <button className="btn">Add</button>
      </form>
      {error && <p className="error">{error}</p>}
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
  const [footer, setFooter] = useState(settingText(current?.value) || 'Internal invoice. Not a certified tax document.')
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)
  const [overdue, setOverdue] = useState(String(settingNumber(tables.settings, 'overdue_days', 30)))
  const [inactive, setInactive] = useState(String(settingNumber(tables.settings, 'inactive_days', 60)))
  const [lockMonth, setLockMonth] = useState('')
  const [companyName, setCompanyName] = useState(settingText(tables.settings.find((row) => row.key === 'company_name')?.value) || 'HAK Wholesales')
  const [companyNif, setCompanyNif] = useState(settingText(tables.settings.find((row) => row.key === 'company_nif')?.value))
  const [companyAddress, setCompanyAddress] = useState(settingText(tables.settings.find((row) => row.key === 'company_address')?.value))
  const [look] = useState(() => documentBrand(tables.settings))
  const [companyPhone, setCompanyPhone] = useState(look.phone)
  const [companyEmail, setCompanyEmail] = useState(look.email)
  const [logo, setLogo] = useState(look.logo)
  const [preset, setPreset] = useState(look.preset)
  const [kicker, setKicker] = useState(look.kicker)
  const [statementFooter, setStatementFooter] = useState(look.statementFooter)
  const [designError, setDesignError] = useState('')
  const locks = settingJson<string[]>(tables.settings, 'period_locks', [])
  const [confirmSample, setConfirmSample] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const monthReady = /^\d{4}-\d{2}$/.test(lockMonth)

  async function saveSetting(key: string, value: unknown) {
    const existing = tables.settings.find((row) => row.key === key)
    await saveLocal('settings', { id: existing?.id ?? uuidv7(), key, value: typeof value === 'string' ? value : JSON.stringify(value), deleted_at: null })
    await onSaved()
    setNote('Saved.')
  }

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="page insight-page settings-page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="lede">Company details, the choices on your forms, and the rules that run the books.</p>
          {note && <p className="settings-note" role="status">{note}</p>}
        </div>
      </div>
      <nav className="settings-jump" aria-label="On this page">
        <button type="button" onClick={() => jump('settings-business')}>Business</button>
        <button type="button" onClick={() => jump('settings-lists')}>Lists</button>
        <button type="button" onClick={() => jump('settings-rules')}>Rules</button>
        {onLoadSample && <button type="button" onClick={() => jump('settings-data')}>Replace data</button>}
      </nav>

      <section className="panel settings-card" id="settings-business">
        <div className="settings-card-head">
          <h2>Business</h2>
          <p className="quiet">The name, logo, and wording used on the menu, invoices, and statements.</p>
        </div>
        <div className="settings-split">
          <form className="settings-fields" onSubmit={(event) => {
            event.preventDefault()
            void (async () => {
              await saveSetting('company_name', companyName)
              await saveSetting('company_nif', companyNif)
              await saveSetting('company_address', companyAddress)
              await saveSetting('company_phone', companyPhone)
              await saveSetting('company_email', companyEmail)
            })()
          }}>
            <h3>Company</h3>
            <label className="control-line">Business name<input aria-label="Business name" className="control" value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></label>
            <label className="control-line">Company NIF<input aria-label="Company NIF" className="control" value={companyNif} onChange={(event) => setCompanyNif(event.target.value)} /></label>
            <label className="control-line">Address<input aria-label="Company address" className="control" value={companyAddress} onChange={(event) => setCompanyAddress(event.target.value)} /></label>
            <div className="settings-pair">
              <label className="control-line">Phone<input aria-label="Company phone" className="control" value={companyPhone} onChange={(event) => setCompanyPhone(event.target.value)} /></label>
              <label className="control-line">Email<input aria-label="Company email" className="control" type="email" value={companyEmail} onChange={(event) => setCompanyEmail(event.target.value)} /></label>
            </div>
            <button className="btn">Save company profile</button>
          </form>
          <form className="settings-fields" onSubmit={(event) => {
            event.preventDefault()
            void saveSetting('document_design', { logo, color: preset, kicker, statementFooter })
            setDesignError('')
          }}>
            <h3>Documents</h3>
            <div className="doc-preview" style={{ background: brandPreset(preset).color }}>
              {logo ? <img src={logo} alt="" /> : <span className="doc-mark">H</span>}
              <div>
                <p>{companyName || 'HAK Wholesales'}</p>
                <p>{kicker || 'Internal invoice'}</p>
              </div>
            </div>
            <div className="logo-row">
              <label className="btn-ghost file-btn">Upload logo
                <input aria-label="Company logo" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.currentTarget.value = ''
                  if (!file) return
                  void fitLogo(file).then((next) => { setLogo(next); setDesignError('') }).catch((caught: unknown) => setDesignError(caught instanceof Error ? caught.message : 'The logo could not be prepared.'))
                }} />
              </label>
              {logo && <button type="button" className="btn-ghost" onClick={() => setLogo('')}>Remove logo</button>}
              <p className="quiet">{logo ? 'Shown on the menu and on documents.' : 'PNG or JPG. A letter is used until you upload one.'}</p>
            </div>
            <fieldset className="colour-picks">
              <legend>Brand colour</legend>
              {BRAND_PRESETS.map((item) => (
                <label key={item.id}>
                  <input type="radio" name="brand-colour" value={item.id} checked={preset === item.id} onChange={() => setPreset(item.id)} />
                  <i style={{ background: item.color }} aria-hidden="true" />
                  {item.label}
                </label>
              ))}
            </fieldset>
            <label className="control-line">Invoice heading
              <input aria-label="Invoice heading" className="control" value={kicker} onChange={(event) => setKicker(event.target.value)} />
            </label>
            <label className="control-line">Statement footer
              <textarea aria-label="Statement footer" className="control" rows={2} value={statementFooter} onChange={(event) => setStatementFooter(event.target.value)} />
            </label>
            {designError && <p className="error">{designError}</p>}
            <button className="btn">Save document design</button>
          </form>
        </div>
        <div className="footer-bar">
          <div>
            <h3>Invoice footer</h3>
            <p className="footer-quote">{footer}</p>
          </div>
          <button type="button" className="btn" onClick={() => setOpen(true)}>Edit invoice footer</button>
        </div>
      </section>

      <Popup title="Invoice footer" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={(event) => {
          event.preventDefault()
          void saveSetting(footerKey, footer).then(() => { setNote('Saved. The next invoice uses this footer.'); setOpen(false) })
        }}>
          <label className="control-line">Invoice footer
            <textarea aria-label="Invoice footer" className="control" value={footer} onChange={(event) => setFooter(event.target.value)} rows={3} />
          </label>
          <button className="btn">Save settings</button>
        </form>
      </Popup>

      <div className="settings-grid" id="settings-lists">
        <div className="settings-section-head">
          <h2>Lists</h2>
          <p className="quiet">These names become the choices on products, payments, and expenses.</p>
        </div>
        <ListEditor label="Product categories" hint="The category on a new product." items={settingList(tables.settings, 'categories', fallbackCategories)} onChange={(next) => void saveSetting('categories', next)} />
        <ListEditor label="Colours" hint="Optional colour on a product." items={settingList(tables.settings, 'colours', fallbackColours)} onChange={(next) => void saveSetting('colours', next)} />
        <ListEditor label="Payment methods" hint="How a shop or a supplier payment is recorded." items={settingList(tables.settings, 'payment_methods', fallbackMethods)} onChange={(next) => void saveSetting('payment_methods', next)} />
        <ListEditor label="Expense categories" hint="How spending is grouped." items={settingList(tables.settings, 'expense_categories', fallbackExpenses)} onChange={(next) => void saveSetting('expense_categories', next)} />
      </div>

      <section className="panel settings-card" id="settings-rules">
        <div className="settings-card-head">
          <h2>Rules</h2>
          <p className="quiet">When an invoice counts as overdue, when a shop goes quiet, and which months stay closed.</p>
        </div>
        <form className="settings-fields" onSubmit={(event) => {
          event.preventDefault()
          void (async () => {
            await saveSetting('overdue_days', Number(overdue) || 30)
            await saveSetting('inactive_days', Number(inactive) || 60)
          })()
        }}>
          <div className="settings-pair">
            <label className="control-line">Overdue days
              <input aria-label="Overdue days" className="control" type="number" min={1} value={overdue} onChange={(event) => setOverdue(event.target.value)} />
              <span className="field-hint">Days after the invoice date. Older open invoices show as overdue.</span>
            </label>
            <label className="control-line">Inactive days
              <input aria-label="Inactive days" className="control" type="number" min={1} value={inactive} onChange={(event) => setInactive(event.target.value)} />
              <span className="field-hint">Days without an order. An active shop is marked inactive after this.</span>
            </label>
          </div>
          <button className="btn">Save rules</button>
        </form>
        <form className="settings-fields lock-block" onSubmit={(event) => {
          event.preventDefault()
          if (!monthReady) return
          const next = locks.includes(lockMonth) ? locks.filter((month) => month !== lockMonth) : [...locks, lockMonth]
          void saveSetting('period_locks', next)
          setLockMonth('')
        }}>
          <h3>Period lock</h3>
          <p className="quiet">A locked month cannot be changed on a sale or a purchase until you unlock it.</p>
          {locks.length === 0
            ? <p className="quiet">No month is locked. Every month can still be edited.</p>
            : (
              <ul className="choice-list">
                {locks.map((month) => (
                  <li key={month}>
                    <span>{month}</span>
                    <button type="button" className="btn-ghost" aria-label={`Unlock ${month}`} onClick={() => void saveSetting('period_locks', locks.filter((entry) => entry !== month))}>Unlock</button>
                  </li>
                ))}
              </ul>
            )}
          <div className="choice-add">
            <label className="control-line">Month
              <input aria-label="Lock month" className="control" type="month" value={lockMonth} onChange={(event) => setLockMonth(event.target.value)} />
            </label>
            <button className="btn" disabled={!monthReady}>{locks.includes(lockMonth) ? 'Unlock month' : 'Lock month'}</button>
          </div>
        </form>
      </section>

      {onLoadSample && (
        <section className="panel settings-card settings-caution" id="settings-data">
          <div className="settings-card-head">
            <h2>Replace business data</h2>
            <p className="quiet">These replace the current business. Each one asks you to confirm first.</p>
          </div>
          <ul className="caution-list">
            <li>
              <div>
                <strong>Sample ledger</strong>
                <p className="quiet">Sales become {centsToEuros(60500)}. Your current rows are replaced.</p>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setConfirmSample(true)}>Load sample data</button>
            </li>
            {onImport && (
              <li>
                <div>
                  <strong>Tracker workbook</strong>
                  <p className="quiet">Replace the books with an Excel tracker export.</p>
                </div>
                <label className="btn-ghost file-btn">Import tracker workbook
                  <input aria-label="Import tracker workbook" className="sr-only" type="file" accept=".xlsx,.xls" onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    event.currentTarget.value = ''
                    if (file) setImportFile(file)
                  }} />
                </label>
              </li>
            )}
            {onImport && (
              <li>
                <div>
                  <strong>Backup file</strong>
                  <p className="quiet">Put a previous backup back in place of the current business.</p>
                </div>
                <label className="btn-ghost file-btn">Restore backup
                  <input aria-label="Restore backup" className="sr-only" type="file" accept=".xlsx,.xls" onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    event.currentTarget.value = ''
                    if (file) setRestoreFile(file)
                  }} />
                </label>
              </li>
            )}
          </ul>
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
