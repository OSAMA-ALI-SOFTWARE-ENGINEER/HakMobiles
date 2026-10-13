const mediaColumns = ['photo_path', 'receipt_path']

export function withoutInlineMedia(payload: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...payload }
  for (const column of mediaColumns) {
    if (typeof copy[column] === 'string' && copy[column].startsWith('data:')) delete copy[column]
  }
  return copy
}

export function shouldKeepLocalMedia(incoming: unknown, local: unknown): boolean {
  const empty = incoming == null || incoming === ''
  return empty && typeof local === 'string' && local.startsWith('data:')
}
