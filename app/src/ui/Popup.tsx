import { useEffect, type ReactNode } from 'react'

export function FactList({ items }: { items: { label: string; value: string; wide?: boolean }[] }) {
  return (
    <dl className="fact-list">
      {items.map((item, index) => {
        const blank = item.value.trim() === ''
        return (
          <div className={item.wide ? 'wide' : undefined} key={`${item.label}-${index}`}>
            <dt>{item.label}</dt>
            <dd className={blank ? 'empty' : undefined}>{blank ? '—' : item.value}</dd>
          </div>
        )
      })}
    </dl>
  )
}

export function Popup({ title, open, onClose, children, sheet = false }: { title: string; open: boolean; onClose: () => void; children: ReactNode; sheet?: boolean }) {
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
      <div className={`popup${sheet ? ' sheet' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="popup-head">
          <h2>{title}</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}
