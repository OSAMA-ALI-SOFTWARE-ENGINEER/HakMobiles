import { describe, expect, it } from 'vitest'
import { createNodeSql } from './nodeSql'
import { migrate, readOutbox, readTable, saveRecord } from './repository'

describe('repository', () => {
  it('writes a product and an outbox row together', () => {
    const sql = createNodeSql()
    migrate(sql)
    saveRecord(sql, 'products', { id: 'p1', code: 'C1', name: 'Case', sell_price: 500 }, 'op-1')

    expect(readTable(sql, 'products')).toHaveLength(1)
    expect(readOutbox(sql)).toHaveLength(1)
  })

  it('writes neither row when the save fails', () => {
    const sql = createNodeSql()
    migrate(sql)

    expect(() => saveRecord(sql, 'products', { id: 'p1', code: null, name: null, sell_price: 500 }, 'op-1')).toThrow()
    expect(readTable(sql, 'products')).toHaveLength(0)
    expect(readOutbox(sql)).toHaveLength(0)
  })

  it('stores a purchase line cost and refuses a blank one', () => {
    const sql = createNodeSql()
    migrate(sql)
    saveRecord(sql, 'purchase_lines', {
      id: 'line-1',
      purchase_id: 'buy-1',
      product_id: 'p1',
      qty: 4,
      qty_received: 4,
      unit_cost: 120,
    }, 'op-line')

    expect(readTable(sql, 'purchase_lines')[0]?.unit_cost).toBe(120)
    expect(() => saveRecord(sql, 'purchase_lines', {
      id: 'line-2',
      purchase_id: 'buy-1',
      product_id: 'p1',
      qty: 4,
      qty_received: 4,
      unit_cost: Number.NaN,
    }, 'op-blank')).toThrow(/NOT NULL/)
  })
})
