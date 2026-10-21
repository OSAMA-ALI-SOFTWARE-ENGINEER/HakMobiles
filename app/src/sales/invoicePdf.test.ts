import { createElement } from 'react'
import { inflateSync } from 'node:zlib'
import { pdf } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import { InvoiceDocument, type InvoicePdfModel } from './invoicePdf'

function pdfText(bytes: Buffer): string {
  const raw = bytes.toString('latin1')
  const parts: string[] = []
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const slice = Buffer.from(match[1], 'latin1')
    try {
      parts.push(inflateSync(slice).toString('latin1'))
    } catch {
      parts.push(match[1])
    }
  }
  const inflated = parts.join('\n')
  return [...inflated.matchAll(/\[([\s\S]*?)\]\s*TJ/g)].map((run) =>
    [...run[1].matchAll(/<([0-9A-Fa-f]+)>/g)].map((hex) => {
      let text = ''
      for (let index = 0; index < hex[1].length; index += 2) {
        const code = parseInt(hex[1].slice(index, index + 2), 16)
        text += code === 0x80 ? '€' : String.fromCharCode(code)
      }
      return text
    }).join(''),
  ).join('\n')
}

const invoice: InvoicePdfModel = {
  invoiceNo: 'HAS1-0099',
  date: '2026-10-08',
  shop: 'Loja Linhas',
  lines: [
    { name: 'Line item', qty: 2, unitPriceCents: 4000, discountCents: 0, totalCents: 8000 },
    { name: 'Line item', qty: 1, unitPriceCents: 500, discountCents: 0, totalCents: 500 },
  ],
  totalCents: 8500,
}

describe('invoice pdf', () => {
  it('opens offline with the invoice number, lines and total', async () => {
    const blob = await pdf(createElement(InvoiceDocument, { invoice })).toBlob()
    const bytes = Buffer.from(await blob.arrayBuffer())
    const text = pdfText(bytes)
    expect(text).toContain('HAS1-0099')
    expect(text).toContain('Loja Linhas')
    expect(text).toContain('Line item')
    expect(text).toContain('€ 85,00')
  })
})
