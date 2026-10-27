import { MONEY_DEFAULT_ZERO, MONEY_FIELDS } from '../db/schema'

function mysqlDateTime(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/)
  if (!match) return value
  return `${match[1]} ${match[2]}`
}

function isJsonText(value: string): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

/** settings.value is a MySQL JSON column. A sentence or an empty box is not JSON until it is quoted. */
export function settingValueForServer(value: unknown): unknown {
  if (value == null) return null
  if (typeof value === 'string') return value !== '' && isJsonText(value) ? value : JSON.stringify(value)
  return JSON.stringify(value)
}

/** A pulled JSON string comes back with quotes. Lists and objects stay as JSON text for the local readers. */
export function settingValueFromServer(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    const parsed = JSON.parse(value) as unknown
    if (typeof parsed === 'string') return parsed
  } catch {
    return value
  }
  return value
}

export function rowToServer(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...row }
  if (table === 'settings' && 'value' in copy) copy.value = settingValueForServer(copy.value)
  for (const field of MONEY_FIELDS[table] ?? []) {
    const value = copy[field]
    if (typeof value === 'number' && Number.isFinite(value)) {
      copy[field] = (value / 100).toFixed(2)
      continue
    }
    const missing = value == null || value === '' || (typeof value === 'number' && !Number.isFinite(value))
    if (missing && Object.prototype.hasOwnProperty.call(copy, field) && (MONEY_DEFAULT_ZERO[table] ?? []).includes(field)) {
      copy[field] = '0.00'
    }
  }
  if (table === 'partners' && typeof copy.share_pct === 'number') {
    copy.share_pct = (copy.share_pct as number).toFixed(2)
  }
  for (const field of Object.keys(copy)) copy[field] = mysqlDateTime(copy[field])
  return copy
}

/** A purchase waiting in the outbox with no shipping cost is stored as 0 cents, which the server accepts. */
export function purchasePayloadWithShipping(payload: string): string | null {
  let row: Record<string, unknown>
  try {
    row = JSON.parse(payload) as Record<string, unknown>
  } catch {
    return null
  }
  if (row == null || typeof row !== 'object' || Array.isArray(row)) return null
  const cost = row.extra_cost
  const missing = cost == null || cost === '' || (typeof cost === 'number' && !Number.isFinite(cost))
  if (!missing) return null
  return JSON.stringify({ ...row, extra_cost: 0 })
}

export function rowFromServer(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...row }
  if (table === 'settings' && 'value' in copy) copy.value = settingValueFromServer(copy.value)
  for (const field of MONEY_FIELDS[table] ?? []) {
    if (copy[field] != null && copy[field] !== '') {
      copy[field] = Math.round(Number(copy[field]) * 100)
    }
  }
  if (table === 'partners' && copy.share_pct != null) {
    copy.share_pct = Math.round(Number(copy.share_pct))
  }
  return copy
}
