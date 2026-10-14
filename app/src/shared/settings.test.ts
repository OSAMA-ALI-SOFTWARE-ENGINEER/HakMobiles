import { describe, expect, it } from 'vitest'
import { settingList, settingNumber } from './settings'

describe('settings lists', () => {
  it('reads an array or a JSON string and falls back otherwise', () => {
    expect(settingList([{ key: 'categories', value: ['Cases'] }], 'categories', ['Other'])).toEqual(['Cases'])
    expect(settingList([{ key: 'categories', value: '["Cables"]' }], 'categories', ['Other'])).toEqual(['Cables'])
    expect(settingList([], 'categories', ['Other'])).toEqual(['Other'])
    expect(settingNumber([{ key: 'overdue_days', value: '14' }], 'overdue_days', 30)).toBe(14)
    expect(settingNumber([], 'overdue_days', 30)).toBe(30)
  })
})