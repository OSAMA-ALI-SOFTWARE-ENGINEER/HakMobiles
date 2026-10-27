import { describe, expect, it } from 'vitest'
import { documentBrand } from './brand'

describe('document brand', () => {
  it('uses the HAK name and indigo invoice until an admin changes them', () => {
    const brand = documentBrand([])
    expect(brand.name).toBe('HAK Wholesales')
    expect(brand.color).toBe('#465fff')
    expect(brand.preset).toBe('indigo')
    expect(brand.kicker).toBe('Internal invoice')
    expect(brand.logo).toBe('')
  })

  it('reads the logo, colour, and company lines saved in settings', () => {
    const brand = documentBrand([
      { key: 'company_name', value: 'HAK Porto' },
      { key: 'company_nif', value: '123456789' },
      { key: 'invoice_footer', value: 'Thank you.' },
      { key: 'document_design', value: JSON.stringify({ logo: 'data:image/png;base64,abc', color: 'teal', kicker: 'Invoice', statementFooter: 'Statement' }) },
    ])
    expect(brand.name).toBe('HAK Porto')
    expect(brand.nif).toBe('123456789')
    expect(brand.footer).toBe('Thank you.')
    expect(brand.color).toBe('#0F766E')
    expect(brand.logo).toBe('data:image/png;base64,abc')
    expect(brand.kicker).toBe('Invoice')
    expect(brand.statementFooter).toBe('Statement')
  })

  it('reads a company name that came back from the JSON column', () => {
    const brand = documentBrand([{ key: 'company_name', value: '"HAK Porto"' }])
    expect(brand.name).toBe('HAK Porto')
  })

  it('ignores a colour or logo that is not one of the allowed choices', () => {
    const brand = documentBrand([
      { key: 'document_design', value: JSON.stringify({ logo: 'https://example.test/logo.png', color: 'rainbow' }) },
    ])
    expect(brand.logo).toBe('')
    expect(brand.preset).toBe('indigo')
  })
})