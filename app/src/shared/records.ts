export function editReasonGate(date: string, today: string, reason: string): { needsReason: boolean; canSave: boolean; message: string } {
  const stamp = date.slice(0, 10)
  const needsReason = stamp !== '' && stamp < today
  if (needsReason && reason.trim() === '') {
    return { needsReason, canSave: false, message: 'A reason is required for a record from before today.' }
  }
  return { needsReason, canSave: true, message: '' }
}

export function purgedCopy(table: string, row: Record<string, unknown>, purgedAt: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...row, deleted_at: row.deleted_at ?? purgedAt, purged_at: purgedAt }
  const suffix = `~${String(row.id).slice(0, 8)}`
  const release = (field: string) => {
    const value = copy[field]
    if (typeof value === 'string' && value !== '' && !value.endsWith(suffix)) copy[field] = `${value}${suffix}`
  }
  if (table === 'products') release('code')
  if (table === 'suppliers') release('name')
  if (table === 'sales') release('invoice_no')
  if (table === 'customers' && copy.nif) copy.nif = null
  return copy
}

export function archiveBlock(input: { blocked: boolean; isSuperAdmin: boolean; message: string }): string {
  if (input.blocked && !input.isSuperAdmin) return input.message
  return ''
}
