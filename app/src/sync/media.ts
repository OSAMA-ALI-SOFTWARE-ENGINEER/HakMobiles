import { apiUrl } from '../api'
import { browserQuery, loadLocal, saveLocal } from '../db/browser'

export async function uploadRecordFile(token: string, table: 'products' | 'expenses', recordId: string, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const body = new FormData()
  body.set('table', table)
  body.set('record_id', recordId)
  body.set('file', new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' }))
  const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${token}` })
  const response = await fetch(apiUrl('/api/files'), { method: 'POST', headers, body })
  const result = (await response.json().catch(() => ({}))) as { path?: string; message?: string }
  if (!response.ok || !result.path) throw new Error(result.message ?? 'The image could not be saved.')
  return result.path
}

export async function uploadPendingMedia(token: string): Promise<void> {
  const jobs: { table: 'products' | 'expenses'; column: 'photo_path' | 'receipt_path' }[] = [
    { table: 'products', column: 'photo_path' },
    { table: 'expenses', column: 'receipt_path' },
  ]
  for (const job of jobs) {
    const rows = await loadLocal(job.table)
    for (const row of rows) {
      const value = row[job.column]
      if (typeof value !== 'string' || !value.startsWith('data:')) continue
      try {
        const path = await uploadRecordFile(token, job.table, String(row.id), value)
        await saveLocal(job.table, { ...row, [job.column]: path, updated_at: new Date().toISOString() })
      } catch {
        // The row may not be on the server yet. The next sync tries again.
      }
    }
  }
}
