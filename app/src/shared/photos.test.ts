import { describe, expect, it } from 'vitest'
import { shouldKeepLocalMedia, withoutInlineMedia } from './photos'

describe('photo sync', () => {
  it('leaves a data url out of the server payload', () => {
    const payload = withoutInlineMedia({ id: 'p1', code: 'C1', photo_path: 'data:image/png;base64,aaaa', receipt_path: 'uploads/expenses/a.jpg' })
    expect(payload.photo_path).toBeUndefined()
    expect(payload.receipt_path).toBe('uploads/expenses/a.jpg')
    expect(payload.code).toBe('C1')
  })

  it('keeps a local preview when the server has no path yet', () => {
    expect(shouldKeepLocalMedia(null, 'data:image/png;base64,aaaa')).toBe(true)
    expect(shouldKeepLocalMedia('', 'data:image/png;base64,aaaa')).toBe(true)
    expect(shouldKeepLocalMedia('uploads/products/a.jpg', 'data:image/png;base64,aaaa')).toBe(false)
    expect(shouldKeepLocalMedia(null, 'uploads/products/a.jpg')).toBe(false)
  })
})
