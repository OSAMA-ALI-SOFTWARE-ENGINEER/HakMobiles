import { expect, it } from 'vitest'
import { goldenTables, summarizeTables } from './ledger'

it('reads the golden sample back out of local tables', () => {
  const summary = summarizeTables(goldenTables())
  expect(summary.netProfitCents).toBe(43000)
  expect(summary.marginPercent).toBe(71.1)
  expect(summary.partnerBalances.map((partner) => partner.balanceCents)).toEqual([4000, -13000, 9000])
})
