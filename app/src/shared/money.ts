export type Cents = number

export function eurosToCents(value: number): Cents {
  return Math.round(value * 100)
}

export function parseEuros(value: string): Cents | null {
  const trimmed = value.trim().replace(/€/g, '').replace(/\s/g, '')
  if (trimmed === '' || trimmed === '-') return null
  const lastComma = trimmed.lastIndexOf(',')
  const lastDot = trimmed.lastIndexOf('.')
  let normalized = trimmed
  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed.replace(/,/g, '')
  } else if (lastComma !== -1) {
    normalized = trimmed.replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, '')
  }
  const amount = Number(normalized)
  if (!Number.isFinite(amount)) return null
  return eurosToCents(amount)
}

export function centsToInput(cents: Cents): string {
  const absolute = Math.abs(Math.round(cents))
  const euros = Math.floor(absolute / 100)
  const rest = String(absolute % 100).padStart(2, '0')
  return `${cents < 0 ? '-' : ''}${euros},${rest}`
}

export function centsToEuros(cents: Cents): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(Math.round(cents))
  const euros = Math.floor(absolute / 100)
  const rest = String(absolute % 100).padStart(2, '0')
  const grouped = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}€ ${grouped},${rest}`
}

export function fxToEurCents(amountCents: Cents, fxRate: number): Cents {
  if (fxRate === 0) return 0
  return Math.round(amountCents / fxRate)
}

export function weightedAverageCost(
  oldQty: number,
  oldAvgCents: Cents,
  newQty: number,
  newCostCents: Cents,
): Cents {
  const totalQty = oldQty + newQty
  if (totalQty === 0) return 0
  return Math.round((oldQty * oldAvgCents + newQty * newCostCents) / totalQty)
}
