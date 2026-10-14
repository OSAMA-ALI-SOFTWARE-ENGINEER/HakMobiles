export function settingList(settings: Record<string, unknown>[], key: string, fallback: string[]): string[] {
  const raw = settings.find((row) => row.key === key)?.value
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch {
      return fallback
    }
  }
  return fallback
}

export function settingNumber(settings: Record<string, unknown>[], key: string, fallback: number): number {
  const raw = settings.find((row) => row.key === key)?.value
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
