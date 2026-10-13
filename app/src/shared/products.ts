export type ListedProduct = {
  code: string
  name: string
  category?: string | null
  barcode?: string | null
}

export function filterProducts<T extends ListedProduct>(
  products: T[],
  stock: { code: string; status: string }[],
  query: string,
  category: string,
  status: string,
): T[] {
  const byCode = new Map(stock.map((item) => [item.code, item.status]))
  const needle = query.trim().toLowerCase()
  return products.filter((product) => {
    const haystack = `${product.code} ${product.name} ${product.barcode ?? ''}`.toLowerCase()
    if (needle && !haystack.includes(needle)) return false
    if (category && (product.category ?? '') !== category) return false
    if (status && byCode.get(product.code) !== status) return false
    return true
  })
}
