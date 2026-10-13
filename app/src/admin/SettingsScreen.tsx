import { useState } from 'react'
import { v7 as uuidv7 } from 'uuid'
import { saveLocal } from '../db/browser'
import type { LocalTables } from '../data/ledger'
import { Popup } from '../ui/Popup'

const footerKey = 'invoice_footer'

export function SettingsScreen({ tables, onSaved }: { tables: LocalTables; onSaved: () => Promise<void> }) {
  const current = tables.settings.find((row) => row.key === footerKey)
  const [footer, setFooter] = useState(String(current?.value ?? 'Internal invoice. Not a certified tax document.'))
  const [saved, setSaved] = useState(false)
  const [open, setOpen] = useState(false)

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="lede">The invoice footer is stored with the business data and appears on the next invoice PDF.</p>
        </div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>Edit invoice footer</button>
      </div>
      <p className="panel">{footer}</p>
      {saved && <p className="lede">Saved. The next invoice uses this footer.</p>}
      <Popup title="Invoice footer" open={open} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault()
          await saveLocal('settings', { id: current?.id ?? uuidv7(), key: footerKey, value: footer })
          setSaved(true)
          setOpen(false)
          await onSaved()
        }}>
          <label className="control-line">Invoice footer
            <textarea aria-label="Invoice footer" className="control" value={footer} onChange={(event) => setFooter(event.target.value)} rows={3} />
          </label>
          <button className="btn">Save settings</button>
        </form>
      </Popup>
    </section>
  )
}
