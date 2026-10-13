import { expect, it } from 'vitest'
import { rowFromServer, rowToServer } from './codec'

it('converts cents to decimal strings for the server', () => {
  expect(rowToServer('products', { sell_price: 500 }).sell_price).toBe('5.00')
  expect(rowToServer('products', { created_at: '2026-10-12T12:41:14.558Z' }).created_at).toBe('2026-10-12 12:41:14')
  expect(rowFromServer('products', { sell_price: '5.00' }).sell_price).toBe(500)
})
