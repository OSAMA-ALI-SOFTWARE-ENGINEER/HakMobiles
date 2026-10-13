import { expect, it } from 'vitest'
import { createNodeSql } from '../db/nodeSql'
import { migrate } from '../db/repository'
import { setPin, unlockPin } from './pin'

it('locks the app after five wrong pins', async () => {
  const sql = createNodeSql()
  migrate(sql)
  await setPin(sql, '123456')

  for (let attempt = 0; attempt < 4; attempt += 1) {
    expect(await unlockPin(sql, '000000')).toBe('wrong')
  }
  expect(await unlockPin(sql, '000000')).toBe('locked')
  expect(await unlockPin(sql, '123456')).toBe('locked')
})

it('accepts the right pin', async () => {
  const sql = createNodeSql()
  migrate(sql)
  await setPin(sql, '123456')
  expect(await unlockPin(sql, '123456')).toBe('ok')
})
