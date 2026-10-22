import { describe, expect, it } from 'vitest'
import { skeletonKindForPath } from './PageSkeleton'

describe('skeletonKindForPath', () => {
  it('picks a layout for every module', () => {
    expect(skeletonKindForPath('/')).toBe('dashboard')
    expect(skeletonKindForPath('/products')).toBe('table')
    expect(skeletonKindForPath('/customers')).toBe('table')
    expect(skeletonKindForPath('/customers/019')).toBe('detail')
    expect(skeletonKindForPath('/pipeline')).toBe('board')
    expect(skeletonKindForPath('/follow-ups')).toBe('list')
    expect(skeletonKindForPath('/calendar')).toBe('calendar')
    expect(skeletonKindForPath('/suppliers')).toBe('table')
    expect(skeletonKindForPath('/purchases')).toBe('table')
    expect(skeletonKindForPath('/sales')).toBe('table')
    expect(skeletonKindForPath('/payments')).toBe('table')
    expect(skeletonKindForPath('/expenses')).toBe('table')
    expect(skeletonKindForPath('/transfers')).toBe('table')
    expect(skeletonKindForPath('/reports')).toBe('reports')
    expect(skeletonKindForPath('/activity')).toBe('activity')
    expect(skeletonKindForPath('/settings')).toBe('settings')
    expect(skeletonKindForPath('/admin/users')).toBe('table')
  })
})
