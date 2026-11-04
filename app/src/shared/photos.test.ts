import { describe, expect, it } from 'vitest'
import { serverMediaToKeep, shouldKeepLocalMedia, withoutInlineMedia } from './photos'

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

  it('takes a photo saved on another device and leaves a preview that is still uploading', () => {
    expect(serverMediaToKeep('uploads/products/a.jpg', null)).toBe('uploads/products/a.jpg')
    expect(serverMediaToKeep('uploads/products/a.jpg', '')).toBe('uploads/products/a.jpg')
    expect(serverMediaToKeep('uploads/products/b.jpg', 'uploads/products/a.jpg')).toBe('uploads/products/b.jpg')
    expect(serverMediaToKeep('uploads/products/a.jpg', 'uploads/products/a.jpg')).toBeNull()
    expect(serverMediaToKeep('uploads/products/a.jpg', 'data:image/png;base64,aaaa')).toBeNull()
    expect(serverMediaToKeep(null, '')).toBeNull()
  })
})
