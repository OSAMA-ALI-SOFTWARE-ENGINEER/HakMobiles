import { expect, it } from 'vitest'
import { canAccess } from './access'

it('sends a salesperson away from admin', () => {
  expect(canAccess('/admin/users', ['dashboard.view', 'products.view', 'sales.create', 'customers.manage'])).toBe(false)
  expect(canAccess('/', ['dashboard.view'])).toBe(true)
})
