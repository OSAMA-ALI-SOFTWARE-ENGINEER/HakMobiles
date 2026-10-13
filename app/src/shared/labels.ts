export function shopLabel(name: unknown): string {
  const value = String(name ?? '').trim()
  if (value === '' || value === 'undefined' || value === 'null') return 'Unknown shop'
  return value
}

export function sampleInvoiceNo(index: number): string {
  return `HAK-${String(index + 1).padStart(3, '0')}`
}
