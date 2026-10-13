export interface PullChange {
  seq: number
  table: string
  record_id: string
  data: Record<string, unknown>
}

export function applyPull(
  rows: Map<string, Record<string, unknown>>,
  changes: PullChange[],
  pendingIds: Set<string>,
): number {
  let last = 0
  for (const change of changes) {
    last = change.seq
    if (pendingIds.has(change.record_id)) continue
    rows.set(`${change.table}:${change.record_id}`, change.data)
  }
  return last
}

export function takeBatch<T>(rows: T[], size = 200): T[] {
  return rows.slice(0, size)
}
