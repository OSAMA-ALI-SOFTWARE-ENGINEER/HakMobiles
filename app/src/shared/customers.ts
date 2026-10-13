export type Shop = {
  id: string
  shop_name: string
  nif?: string | null
  phone?: string | null
}

export function duplicateWarning(customers: Shop[], draft: { nif?: string; phone?: string }): string {
  const nif = draft.nif?.trim()
  const phone = draft.phone?.trim()
  if (nif) {
    const match = customers.find((customer) => (customer.nif ?? '').trim() === nif)
    if (match) return `This NIF is already used by ${match.shop_name}.`
  }
  if (phone) {
    const match = customers.find((customer) => (customer.phone ?? '').trim() === phone)
    if (match) return `This phone is already used by ${match.shop_name}.`
  }
  return ''
}

export function duplicateGroups(customers: Shop[]): { key: string; customers: Shop[] }[] {
  const groups: { key: string; customers: Shop[] }[] = []
  for (const field of ['nif', 'phone'] as const) {
    const buckets = new Map<string, Shop[]>()
    for (const customer of customers) {
      const value = String(customer[field] ?? '').trim()
      if (!value) continue
      buckets.set(value, [...(buckets.get(value) ?? []), customer])
    }
    for (const [value, rows] of buckets) {
      if (rows.length > 1) groups.push({ key: `${field}:${value}`, customers: rows })
    }
  }
  return groups
}
