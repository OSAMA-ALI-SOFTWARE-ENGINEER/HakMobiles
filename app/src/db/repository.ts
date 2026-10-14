import { v7 as uuidv7 } from 'uuid'
import { SCHEMA_SQL, type Sql } from './schema'

export function migrate(sql: Sql): void {
  sql.exec(SCHEMA_SQL)
}

export function saveStatements(table: string, row: Record<string, unknown>, opId: string): { sql: string; params: unknown[] }[] {
  const now = new Date().toISOString()
  const record: Record<string, unknown> = { ...row, updated_at: row.updated_at ?? now, created_at: row.created_at ?? now }
  const id = String(record.id)
  const columns = Object.keys(record)
  const placeholders = columns.map(() => '?').join(', ')
  const updates = columns.filter((column) => column !== 'id').map((column) => `${column} = excluded.${column}`).join(', ')

  return [
    {
      sql: 'INSERT INTO outbox (op_id, table_name, record_id, payload, created_at) VALUES (?, ?, ?, ?, ?)',
      params: [opId, table, id, JSON.stringify(record), now],
    },
    {
      sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`,
      params: columns.map((column) => {
        const value = record[column]
        if (typeof value === 'number' && !Number.isFinite(value)) return null
        return value ?? null
      }),
    },
  ]
}

export function saveRecord(sql: Sql, table: string, row: Record<string, unknown>, opId = uuidv7()): string {
  sql.transaction(() => {
    for (const statement of saveStatements(table, row, opId)) {
      sql.run(statement.sql, statement.params)
    }
  })

  return opId
}

export function readTable(sql: Sql, table: string): Record<string, unknown>[] {
  return sql.all(`SELECT * FROM ${table} WHERE deleted_at IS NULL`)
}

export function readOutbox(sql: Sql): { op_id: string; table_name: string; record_id: string; payload: string }[] {
  return sql.all('SELECT op_id, table_name, record_id, payload FROM outbox ORDER BY created_at')
}

export function acceptOps(sql: Sql, opIds: string[]): void {
  if (opIds.length === 0) return
  sql.run(`DELETE FROM outbox WHERE op_id IN (${opIds.map(() => '?').join(', ')})`, opIds)
}

export function setLastSeq(sql: Sql, seq: number): void {
  sql.run('UPDATE sync_state SET last_seq = ? WHERE id = 1', [seq])
}

export function lastSeq(sql: Sql): number {
  const rows = sql.all<{ last_seq: number }>('SELECT last_seq FROM sync_state WHERE id = 1')
  return rows[0]?.last_seq ?? 0
}

export function nextInvoiceNumber(sql: Sql, prefix: string): string {
  const rows = sql.all<{ invoice_counter: number }>('SELECT invoice_counter FROM sync_state WHERE id = 1')
  const next = (rows[0]?.invoice_counter ?? 0) + 1
  sql.run('UPDATE sync_state SET invoice_counter = ?, invoice_prefix = ? WHERE id = 1', [next, prefix])
  return `${prefix}-${String(next).padStart(4, '0')}`
}
