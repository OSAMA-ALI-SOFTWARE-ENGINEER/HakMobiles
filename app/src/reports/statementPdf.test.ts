import { createElement } from 'react'
import { inflateSync } from 'node:zlib'
import { pdf } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import { goldenTables } from '../data/ledger'
import { GOLDEN_IDS } from '../shared/calc'
import { customerStatement } from '../shared/reports'
import { StatementDocument } from './statementPdf'

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
      for (let index = 0; index < hex[1].length; index += 2) text += String.fromCharCode(parseInt(hex[1].slice(index, index + 2), 16))
      return text
    }).join(''),
  ).join('\n')
}

describe('statement pdf', () => {
  it('lists the shop invoices and the open balance', async () => {
    const statement = customerStatement(goldenTables(), GOLDEN_IDS.shopA, '2026-10-09')
    const blob = await pdf(createElement(StatementDocument, { statement })).toBlob()
    const text = pdfText(Buffer.from(await blob.arrayBuffer()))
    expect(text).toContain('Shop A')
    expect(text).toContain('470.00')
    expect(text).toContain('300.00')
    expect(text).toContain('170.00')
  })
})
