export const MENU = [
  { path: '/', label: 'Dashboard', permission: 'dashboard.view' },
  { path: '/products', label: 'Products', permission: 'products.view' },
  { path: '/customers', label: 'Customers', permission: 'customers.view' },
  { path: '/pipeline', label: 'Pipeline', permission: 'customers.view' },
  { path: '/follow-ups', label: 'Follow-ups', permission: 'customers.view' },
  { path: '/calendar', label: 'Calendar', permission: 'customers.view' },
  { path: '/suppliers', label: 'Suppliers', permission: 'suppliers.view' },
  { path: '/purchases', label: 'Purchases', permission: 'purchases.view' },
  { path: '/sales', label: 'Sales', permission: 'sales.create' },
  { path: '/payments', label: 'Payments', permission: 'payments.view' },
  { path: '/expenses', label: 'Expenses', permission: 'expenses.view' },
  { path: '/transfers', label: 'Transfers', permission: 'transfers.view' },
  { path: '/reports', label: 'Reports', permission: 'reports.view' },
  { path: '/activity', label: 'Activity', permission: 'activity.view' },
  { path: '/settings', label: 'Settings', permission: 'settings.manage' },
  { path: '/admin/users', label: 'Admin', permission: 'users.manage' },
] as const

const ROUTE_PERMISSIONS: Record<string, string> = {
  '/': 'dashboard.view',
  '/products': 'products.view',
  '/customers': 'customers.view',
  '/pipeline': 'customers.view',
  '/follow-ups': 'customers.view',
  '/calendar': 'customers.view',
  '/suppliers': 'suppliers.view',
  '/purchases': 'purchases.view',
  '/sales': 'sales.create',
  '/payments': 'payments.view',
  '/expenses': 'expenses.view',
  '/transfers': 'transfers.view',
  '/reports': 'reports.view',
  '/activity': 'activity.view',
  '/settings': 'settings.manage',
  '/admin/users': 'users.manage',
}

export function canAccess(path: string, permissions: string[], isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true
  const required = path.startsWith('/customers') ? 'customers.view' : ROUTE_PERMISSIONS[path]
  if (!required) return false
  if (required === 'customers.view' && permissions.includes('customers.manage')) return true
  if (required === 'suppliers.view' && permissions.includes('suppliers.manage')) return true
  if (required === 'purchases.view' && permissions.includes('purchases.manage')) return true
  if (required === 'payments.view' && permissions.includes('payments.manage')) return true
  if (required === 'expenses.view' && permissions.includes('expenses.manage')) return true
  if (required === 'transfers.view' && permissions.includes('transfers.manage')) return true
  if (required === 'sales.create' && (permissions.includes('sales.create') || permissions.includes('sales.manage'))) return true
  return permissions.includes(required)
}

export function visibleMenu(permissions: string[], isSuperAdmin = false) {
  return MENU.filter((item) => canAccess(item.path, permissions, isSuperAdmin))
}
