import { api } from '../api'
import { loadLocal, runAsBatch, saveLocal } from '../db/browser'
import { rowToServer } from '../sync/codec'
import { goldenTables, type LocalTables } from './ledger'

const tables = Object.keys(goldenTables()) as (keyof LocalTables)[]

function archivedCopy(table: string, row: Record<string, unknown>, archivedAt: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...row, deleted_at: archivedAt }
  const suffix = `~${String(row.id).slice(0, 8)}`
  if (table === 'products' && copy.code) copy.code = `${copy.code}${suffix}`
  if (table === 'suppliers' && copy.name) copy.name = `${copy.name}${suffix}`
  if (table === 'sales' && copy.invoice_no) copy.invoice_no = `${copy.invoice_no}${suffix}`
  if (table === 'customers' && copy.nif) copy.nif = null
  return copy
}

export async function replaceBusinessData(token: string, sample: LocalTables): Promise<void> {
  const archivedAt = new Date().toISOString()
  const payload: Record<string, Record<string, unknown>[]> = {}
  for (const table of tables) payload[table] = sample[table].map((row) => rowToServer(table, { ...row, deleted_at: null }))
  await api('/api/sync/sample', { method: 'POST', body: JSON.stringify({ tables: payload }) }, token)
  await runAsBatch(async () => {
    for (const table of tables) {
      const keep = new Set(sample[table].map((row) => String(row.id)))
      const current = await loadLocal(table)
      for (const row of current) {
        if (!keep.has(String(row.id))) await saveLocal(table, archivedCopy(table, row, archivedAt), undefined, false)
      }
      for (const row of sample[table]) await saveLocal(table, { ...row, deleted_at: null }, undefined, false)
    }
    window.dispatchEvent(new Event('hak-saved'))
  })
}

export async function loadGoldenSample(token: string): Promise<void> {
  await replaceBusinessData(token, goldenTables())
}
