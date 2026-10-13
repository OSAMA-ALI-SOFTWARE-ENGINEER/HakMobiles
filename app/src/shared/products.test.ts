import { describe, expect, it } from 'vitest'
import { filterProducts } from './products'

const products = [
  { code: 'C1', name: 'Case', category: 'Cases', barcode: '111' },
  { code: 'CH1', name: 'Charger', category: 'Cables', barcode: '222' },
]
const stock = [
  { code: 'C1', status: 'LOW' },
  { code: 'CH1', status: 'OK' },
]

describe('product list', () => {
  it('matches code, name and barcode', () => {
    expect(filterProducts(products, stock, 'char', '', '').map((row) => row.code)).toEqual(['CH1'])
    expect(filterProducts(products, stock, '111', '', '').map((row) => row.code)).toEqual(['C1'])
  })

  it('filters by category and stock status', () => {
    expect(filterProducts(products, stock, '', 'Cases', '').map((row) => row.code)).toEqual(['C1'])
    expect(filterProducts(products, stock, '', '', 'OK').map((row) => row.code)).toEqual(['CH1'])
    expect(filterProducts(products, stock, 'c', 'Cables', 'LOW')).toEqual([])
  })
})
