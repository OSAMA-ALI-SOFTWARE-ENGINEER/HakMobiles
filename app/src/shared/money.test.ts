import { describe, expect, it } from 'vitest'
import { centsToEuros, parseEuros } from './money'

describe('centsToEuros', () => {
  it('uses the Portuguese euro format', () => {
    expect(centsToEuros(60500)).toBe('€ 605,00')
    expect(centsToEuros(123456)).toBe('€ 1.234,56')
    expect(centsToEuros(-13000)).toBe('-€ 130,00')
    expect(centsToEuros(0)).toBe('€ 0,00')
  })
})

describe('parseEuros', () => {
  it('reads a comma or a dot as cents', () => {
    expect(parseEuros('1,20')).toBe(120)
    expect(parseEuros('1.20')).toBe(120)
    expect(parseEuros('€ 1.234,56')).toBe(123456)
    expect(parseEuros('')).toBeNull()
    expect(parseEuros('abc')).toBeNull()
  })
})
