import { expect, it } from 'vitest'
import { clampSidebarWidth, sidebarCollapsed, storedSidebarWidth } from './sidebar'

it('keeps the menu between an icon rail and a wide panel', () => {
  expect(clampSidebarWidth(10)).toBe(76)
  expect(clampSidebarWidth(900)).toBe(420)
  expect(clampSidebarWidth(Number.NaN)).toBe(290)
  expect(storedSidebarWidth(null)).toBe(290)
  expect(storedSidebarWidth('240')).toBe(240)
})

it('treats a narrow menu as collapsed', () => {
  expect(sidebarCollapsed(76)).toBe(true)
  expect(sidebarCollapsed(290)).toBe(false)
})
