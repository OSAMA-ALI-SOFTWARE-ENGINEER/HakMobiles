import { describe, expect, it } from 'vitest'
import { sampleInvoiceNo, shopLabel } from './labels'

describe('record labels', () => {
  it('uses a short invoice number and names a missing shop', () => {
    expect(sampleInvoiceNo(0)).toBe('HAK-001')
    expect(sampleInvoiceNo(1)).toBe('HAK-002')
    expect(shopLabel('Shop A')).toBe('Shop A')
    expect(shopLabel('')).toBe('Unknown shop')
    expect(shopLabel(null)).toBe('Unknown shop')
  })
})
