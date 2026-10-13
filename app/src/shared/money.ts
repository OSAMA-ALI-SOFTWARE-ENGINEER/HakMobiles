export type Cents = number

export function eurosToCents(value: number): Cents {
  return Math.round(value * 100)
}

export function centsToEuros(cents: Cents): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  return `${sign}€${(absolute / 100).toFixed(2)}`
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
