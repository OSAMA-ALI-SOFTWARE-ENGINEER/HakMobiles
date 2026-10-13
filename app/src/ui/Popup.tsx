import { useEffect, type ReactNode } from 'react'

export function Popup({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="popup-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="popup" role="dialog" aria-modal="true" aria-label={title}>
        <div className="popup-head">
          <h2>{title}</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}
