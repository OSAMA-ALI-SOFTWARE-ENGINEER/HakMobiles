import type { Sql } from '../db/schema'

export async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function setPin(sql: Sql, pin: string): Promise<void> {
  const salt = crypto.randomUUID()
  const hash = await hashPin(pin, salt)
  sql.run('UPDATE sync_state SET pin_hash = ?, pin_salt = ?, pin_attempts = 0 WHERE id = 1', [hash, salt])
}

export async function unlockPin(sql: Sql, pin: string): Promise<'ok' | 'wrong' | 'locked'> {
  const rows = sql.all<{ pin_hash: string | null; pin_salt: string | null; pin_attempts: number }>(
    'SELECT pin_hash, pin_salt, pin_attempts FROM sync_state WHERE id = 1',
  )
  const state = rows[0]
  if (!state?.pin_hash || !state.pin_salt) return 'wrong'
  if (state.pin_attempts >= 5) return 'locked'

  const hash = await hashPin(pin, state.pin_salt)
  if (hash === state.pin_hash) {
    sql.run('UPDATE sync_state SET pin_attempts = 0 WHERE id = 1')
    return 'ok'
  }

  const attempts = state.pin_attempts + 1
  sql.run('UPDATE sync_state SET pin_attempts = ? WHERE id = 1', [attempts])
  return attempts >= 5 ? 'locked' : 'wrong'
}
