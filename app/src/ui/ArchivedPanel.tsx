import { useEffect, useState } from 'react'
import { loadArchived, saveLocal } from '../db/browser'
import { purgedCopy } from '../shared/records'
import { Popup } from './Popup'

export function ArchivedPanel({ table, refreshKey, label, onRestore, onChanged }: {
  table: string
  refreshKey: string
  label: (row: Record<string, unknown>) => string
  onRestore: (row: Record<string, unknown>) => Promise<void>
  onChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [purgeId, setPurgeId] = useState('')
  const reload = () => loadArchived(table).then(setRows)
  useEffect(() => {
    if (!open) return
    void reload()
  }, [open, table, refreshKey])
  const pending = rows.find((row) => row.id === purgeId)
  return (
    <div>
      <button type="button" className="btn-ghost" aria-pressed={open} onClick={() => setOpen((value) => !value)}>Archived</button>
      {open && (
        <ul className="record-list">
          {rows.length === 0 && <li>Nothing archived</li>}
          {rows.map((row) => (
            <li key={String(row.id)}>
              <span>{label(row)}</span>
              <span className="quick-actions">
                <button type="button" className="btn-ok" onClick={() => void onRestore(row).then(reload)}>Restore</button>
                <button type="button" className="btn-danger" onClick={() => setPurgeId(String(row.id))}>Delete permanently</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Popup title="Delete permanently" open={pending != null} onClose={() => setPurgeId('')}>
        <form className="form-grid" onSubmit={(event) => {
          event.preventDefault()
          if (!pending) return
          const row = pending
          setPurgeId('')
          void saveLocal(table, purgedCopy(table, row, new Date().toISOString())).then(() => onChanged()).then(reload)
        }}>
          <p className="lede">This cannot be restored. The row stays hidden so it cannot come back as a live record.</p>
          <button className="btn-danger">Delete permanently</button>
        </form>
      </Popup>
    </div>
  )
}
