import { describe, expect, it } from 'vitest'
import { centsToEuros, centsToInput, parseEuros } from './money'

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
    expect(parseEuros('10,00')).toBe(1000)
  })

  it('fills an input with a comma decimal', () => {
    expect(centsToInput(1000)).toBe('10,00')
    expect(parseEuros(centsToInput(850))).toBe(850)
  })
})
