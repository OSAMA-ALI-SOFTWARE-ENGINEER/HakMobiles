import { describe, expect, it } from 'vitest'
import { archiveBlock, editReasonGate, purgedCopy } from './records'

describe('record edits', () => {
  it('asks for a reason only when the record is from before today', () => {
    expect(editReasonGate('2026-10-01', '2026-10-12', '').canSave).toBe(false)
    expect(editReasonGate('2026-10-01', '2026-10-12', 'Counted short').canSave).toBe(true)
    expect(editReasonGate('2026-10-12', '2026-10-12', '').needsReason).toBe(false)
    expect(editReasonGate('', '2026-10-12', '').needsReason).toBe(false)
  })

  it('hides a purged row and frees its unique name', () => {
    const row = purgedCopy('suppliers', { id: '01900000-0000-7000-8000-000000000099', name: 'Lahore', deleted_at: '2026-10-01T00:00:00Z' }, '2026-10-12T00:00:00Z')
    expect(row.deleted_at).toBe('2026-10-01T00:00:00Z')
    expect(row.purged_at).toBe('2026-10-12T00:00:00Z')
    expect(row.name).toBe('Lahore~01900000')
    expect(purgedCopy('customers', { id: 'abc', nif: '123456789', deleted_at: '2026-10-01' }, '2026-10-12').nif).toBeNull()
  })

  it('lets a super admin archive a shop or supplier that still has a balance', () => {
    expect(archiveBlock({ blocked: true, isSuperAdmin: false, message: 'This shop still has an open invoice.' })).toBe('This shop still has an open invoice.')
    expect(archiveBlock({ blocked: true, isSuperAdmin: true, message: 'This shop still has an open invoice.' })).toBe('')
    expect(archiveBlock({ blocked: false, isSuperAdmin: false, message: 'We still owe this supplier.' })).toBe('')
  })
})
