import { useEffect, useState } from 'react'
import { Popup } from './Popup'

export function RowActions({ canWrite, onPreview, onEdit, onArchive, extra = [] }: {
  canWrite: boolean
  onPreview?: () => void
  onEdit?: () => void
  onArchive?: () => void
  extra?: { label: string; onSelect: () => void; danger?: boolean }[]
}) {
  const [open, setOpen] = useState(false)
  const items = [
    ...(canWrite && onEdit ? [{ label: 'Edit', onSelect: onEdit, danger: false }] : []),
    ...extra.map((item) => ({ ...item, danger: item.danger ?? false })),
    ...(canWrite && onArchive ? [{ label: 'Archive', onSelect: onArchive, danger: true }] : []),
  ]
  return (
    <span className="quick-actions">
      {onPreview && <button type="button" className="btn-ghost" onClick={onPreview}>Preview</button>}
      {items.length > 0 && (
        <span className="row-menu">
          <button type="button" className="btn-ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>Actions</button>
          {open && (
            <span className="row-menu-list" role="menu">
              {items.map((item) => (
                <button type="button" role="menuitem" className={item.danger ? 'btn-danger' : undefined} key={item.label} onClick={() => { setOpen(false); item.onSelect() }}>{item.label}</button>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

export function ArchiveDialog({ open, title, needsReason, onClose, onConfirm }: { open: boolean; title: string; needsReason: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) {
      setReason('')
      setError('')
    }
  }, [open])
  return (
    <Popup title={title} open={open} onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault()
        if (needsReason && reason.trim() === '') {
          setError('A reason is required for a record from before today.')
          return
        }
        setError('')
        setReason('')
        onConfirm(reason.trim())
      }}>
        <p className="lede">This hides the record. Stock, balances and profit are calculated again from the remaining rows.</p>
        {needsReason && (
          <label className="control-line">Reason
            <input aria-label="Change reason" className="control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this older record is changing" />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn-danger">Archive record</button>
      </form>
    </Popup>
  )
}
