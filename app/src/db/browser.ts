import { SQLocal } from 'sqlocal'
import { v7 as uuidv7 } from 'uuid'
import { SCHEMA_SQL } from './schema'
import { saveStatements } from './repository'
import { purchasePayloadWithShipping } from '../sync/codec'

let opening: Promise<SQLocal> | null = null
let batch: Promise<void> = Promise.resolve()

export function whenBatchIdle(): Promise<void> {
  return batch
}

export async function runAsBatch(work: () => Promise<void>): Promise<void> {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const previous = batch
  batch = gate
  await previous
  try {
    await work()
  } finally {
    release()
    if (batch === gate) batch = Promise.resolve()
  }
}

function database(): Promise<SQLocal> {
  if (!opening) {
    opening = openDatabase().catch((error) => {
      opening = null
      throw error
    })
  }
  return opening
}

async function openDatabase(): Promise<SQLocal> {
  const next = new SQLocal('hak-tracker.sqlite3')
  const statements = SCHEMA_SQL.split(';').map((statement) => statement.trim()).filter(Boolean)
  for (const statement of statements) {
    try {
      await next.sql(statement)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/duplicate column name/i.test(message)) throw error
    }
  }
  await next.sql('UPDATE purchases SET extra_cost = 0 WHERE extra_cost IS NULL')
  const waiting = await next.sql<{ op_id: string; payload: string }>('SELECT op_id, payload FROM outbox WHERE table_name = ?', 'purchases')
  for (const row of waiting) {
    const payload = purchasePayloadWithShipping(row.payload)
    if (payload) await next.sql('UPDATE outbox SET payload = ? WHERE op_id = ?', payload, row.op_id)
  }
  return next
}

export async function browserQuery<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await database()
  return db.sql<T>(sql, ...params)
}

export async function saveLocal(table: string, row: Record<string, unknown>, opId?: string, notify = true): Promise<void> {
  const db = await database()
  const id = opId ?? uuidv7()
  const statements = saveStatements(table, row, id)
  await db.transaction(async (tx) => {
    for (const statement of statements) {
      await tx.sql(statement.sql, ...statement.params)
    }
  })
  if (notify) window.dispatchEvent(new Event('hak-saved'))
}

export async function loadLocal(table: string): Promise<Record<string, unknown>[]> {
  return browserQuery(`SELECT * FROM ${table} WHERE deleted_at IS NULL`)
}

export async function loadArchived(table: string): Promise<Record<string, unknown>[]> {
  if (!/^[a-z_]+$/.test(table)) return []
  const columns = await browserQuery<{ name: string }>(`PRAGMA table_info(${table})`)
  const where = columns.some((column) => column.name === 'purged_at')
    ? 'deleted_at IS NOT NULL AND purged_at IS NULL'
    : 'deleted_at IS NOT NULL'
  return browserQuery(`SELECT * FROM ${table} WHERE ${where}`)
}

export async function wipeLocal(): Promise<void> {
  const db = await opening
  opening = null
  if (db) await db.deleteDatabaseFile()
}
