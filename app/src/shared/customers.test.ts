import { describe, expect, it } from 'vitest'
import { duplicateGroups, duplicateWarning } from './customers'

const shops = [
  { id: 'a', shop_name: 'Loja Um', nif: '501', phone: '910' },
  { id: 'b', shop_name: 'Loja Dois', nif: '501', phone: '911' },
]

describe('customer duplicates', () => {
  it('warns while typing an existing NIF or phone', () => {
    expect(duplicateWarning(shops, { nif: '501' })).toBe('This NIF is already used by Loja Um.')
    expect(duplicateWarning(shops, { phone: '911' })).toBe('This phone is already used by Loja Dois.')
    expect(duplicateWarning(shops, { nif: '999' })).toBe('')
  })

  it('groups shops that share a NIF', () => {
    expect(duplicateGroups(shops)).toEqual([{ key: 'nif:501', customers: shops }])
  })
})
