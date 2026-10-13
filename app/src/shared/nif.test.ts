import { describe, expect, it } from 'vitest'
import { isValidPortugueseNif, whatsAppLink } from './nif'

describe('Portuguese NIF', () => {
  it('accepts a 9-digit number with the right check digit', () => {
    expect(isValidPortugueseNif('123456789')).toBe(true)
    expect(isValidPortugueseNif('123456788')).toBe(false)
    expect(isValidPortugueseNif('12345678')).toBe(false)
  })

  it('builds a WhatsApp link with the Portugal prefix', () => {
    expect(whatsAppLink('910 000 111')).toBe('https://wa.me/351910000111')
  })
})
