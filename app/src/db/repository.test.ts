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
})
