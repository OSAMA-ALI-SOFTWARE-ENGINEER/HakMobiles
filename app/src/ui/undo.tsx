import { useEffect, useState } from 'react'

type Pending = { id: number; label: string; undo: () => Promise<void> } | null

let pending: Pending = null
const listeners = new Set<(value: Pending) => void>()
let timer = 0

function publish(value: Pending) {
  pending = value
  listeners.forEach((listener) => listener(value))
}

export function offerUndo(label: string, undo: () => Promise<void>) {
  window.clearTimeout(timer)
  const id = Date.now()
  publish({ id, label, undo })
  timer = window.setTimeout(() => {
    if (pending?.id === id) publish(null)
  }, 8000)
}

export function UndoToast() {
  const [item, setItem] = useState<Pending>(pending)
  useEffect(() => {
    listeners.add(setItem)
    return () => { listeners.delete(setItem) }
  }, [])
  if (!item) return null
  return (
    <div className="undo-toast" role="status">
      <span>{item.label}</span>
      <button type="button" className="btn-ok" onClick={() => {
        const job = item.undo
        publish(null)
        void job()
      }}>Undo</button>
    </div>
  )
}
