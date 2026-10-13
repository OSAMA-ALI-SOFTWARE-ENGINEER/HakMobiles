import { useEffect, useState } from 'react'

export function RecordImage({ path, token, alt, large = false }: { path: string; token: string; alt: string; large?: boolean }) {
  const [src, setSrc] = useState(path.startsWith('data:') ? path : '')
  useEffect(() => {
    if (!path) { setSrc(''); return }
    if (path.startsWith('data:')) { setSrc(path); return }
    let url = ''
    let cancelled = false
    void fetch(`/api/files?path=${encodeURIComponent(path)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.blob() : null)
      .then((blob) => {
        if (!blob || cancelled) return
        url = URL.createObjectURL(blob)
        setSrc(url)
      })
      .catch(() => { if (!cancelled) setSrc('') })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [path, token])
  if (!src) return null
  return <img className={large ? 'record-photo large' : 'record-photo'} src={src} alt={alt} />
}
