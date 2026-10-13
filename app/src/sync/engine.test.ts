import { expect, it } from 'vitest'
import { applyPull, takeBatch } from './engine'

it('does not overwrite a record that is still in the outbox', () => {
  const rows = new Map<string, Record<string, unknown>>([['products:1', { name: 'Local' }]])
  const last = applyPull(
    rows,
    [
      { seq: 4, table: 'products', record_id: '1', data: { name: 'Server' } },
      { seq: 5, table: 'products', record_id: '2', data: { name: 'Other' } },
    ],
    new Set(['1']),
  )

  expect(rows.get('products:1')).toEqual({ name: 'Local' })
  expect(rows.get('products:2')).toEqual({ name: 'Other' })
  expect(last).toBe(5)
})

it('sends at most 200 outbox rows', () => {
  expect(takeBatch(Array.from({ length: 250 }, (_, index) => index), 200)).toHaveLength(200)
})
