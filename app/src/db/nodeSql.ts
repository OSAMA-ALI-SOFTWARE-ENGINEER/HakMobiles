import Database from 'better-sqlite3'
import type { Sql } from './schema'

export function createNodeSql(): Sql {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')

  return {
    exec(sql: string) {
      db.exec(sql)
    },
    run(sql: string, params: unknown[] = []) {
      db.prepare(sql).run(...params)
    },
    all<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...params) as T[]
    },
    transaction<T>(fn: () => T) {
      return db.transaction(fn)()
    },
  }
}
