import { expect, test, type Page } from '@playwright/test'
import { chooseAction } from './actions'

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('Email').fill('haseeb@hak.test')
  await page.getByRole('textbox', { name: 'Password' }).fill('ChangeMe123!')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function loadSample(page: Page) {
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Load sample data' }).click()
  const saved = page.waitForResponse((response) => response.url().includes('/api/sync/sample') && response.ok())
  await page.getByRole('dialog', { name: 'Load sample data' }).getByRole('button', { name: 'Replace with sample' }).click()
  await saved
  await expect(page.locator('.status')).toContainText('Syncing', { timeout: 20_000 })
  await expect(page.locator('.status')).toContainText('Synced', { timeout: 60_000 })
  await page.getByRole('link', { name: 'Dashboard' }).click()
}

test('sample invoices use a short number and a real shop name', async ({ page }) => {
  await signIn(page)
  await loadSample(page)
  await page.getByRole('link', { name: 'Sales' }).click()
  const sale = page.getByRole('row').filter({ hasText: 'HAK-001' })
  await expect(sale).toContainText('Shop A')
  await expect(sale).not.toContainText('01900000')
  await page.getByRole('link', { name: 'Payments' }).click()
  const invoice = page.getByRole('row').filter({ hasText: 'HAK-001' })
  await expect(invoice).toHaveCount(1)
  await expect(invoice).toContainText('Shop A')
  await expect(invoice).not.toContainText('01900000')
})

test('a product row keeps status and money in their own cells', async ({ page }) => {
  await signIn(page)
  await loadSample(page)
  await page.getByRole('link', { name: 'Products' }).click()
  const product = page.getByRole('row').filter({ hasText: 'C1 Case' })
  const status = product.getByRole('cell').nth(1)
  await expect(status).toHaveAttribute('data-status', 'LOW')
  await expect(status).toHaveText('LOW')
  const cells = product.getByRole('cell')
  await expect(cells.nth((await cells.count()) - 1)).toContainText('€ 1,00')
  await expect(product.getByRole('button', { name: 'Preview' })).toBeVisible()
  await expect(product.getByRole('button', { name: 'Edit' })).toHaveCount(0)
  await product.getByRole('button', { name: 'Actions' }).click()
  await expect(product.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
  await expect(product.getByRole('menuitem', { name: 'Archive' })).toBeVisible()
})

test('payments show each invoice once and the overdue filter hides a paid one', async ({ page }) => {
  await signIn(page)
  await loadSample(page)
  await page.getByRole('link', { name: 'Payments' }).click()
  await expect(page.getByRole('heading', { name: 'Overdue' })).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: 'HAK-002' })).toHaveCount(1)
  await page.getByLabel('Invoice status').selectOption('Overdue')
  await expect(page.getByRole('row').filter({ hasText: 'HAK-002' })).toBeVisible()
  await page.getByLabel('Invoice status').selectOption('Paid')
  await expect(page.getByRole('row').filter({ hasText: 'HAK-002' })).toHaveCount(0)
})

test('the phone dashboard keeps the whole euro amount on screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  await loadSample(page)
  const profit = page.getByRole('article').filter({ hasText: 'Net profit' }).getByText('€ 430,00')
  await expect(profit).toBeVisible()
  const box = await profit.boundingBox()
  expect(box).toBeTruthy()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
})

test('header search finds a product without hiding the menu', async ({ page }) => {
  await signIn(page)
  await loadSample(page)
  await page.getByLabel('Find a record').fill('C1')
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await page.getByRole('option', { name: 'C1 Case' }).click()
  await expect(page.getByRole('dialog', { name: 'Product' })).toContainText('C1 Case')
})

test('an archived supplier can be undone', async ({ page }) => {
  const supplier = `Undo Supplier ${Date.now()}`
  await signIn(page)
  await page.getByRole('link', { name: 'Suppliers' }).click()
  await page.getByRole('button', { name: 'New supplier', exact: true }).click()
  await page.getByLabel('Name').fill(supplier)
  await page.getByRole('button', { name: 'Save' }).click()
  const row = page.getByRole('row').filter({ hasText: supplier })
  await chooseAction(row, 'Archive')
  await page.getByRole('dialog', { name: 'Archive supplier' }).getByRole('button', { name: 'Archive record' }).click()
  await expect(row).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('row').filter({ hasText: supplier })).toBeVisible()
  await page.getByRole('link', { name: 'Purchases' }).click()
  await page.getByRole('button', { name: 'New purchase', exact: true }).click()
  await expect(page.locator('select[name="supplier_id"] option', { hasText: supplier })).toHaveCount(1)
})

test('an archived supplier can be deleted permanently', async ({ page }) => {
  const supplier = `Purge Supplier ${Date.now()}`
  await signIn(page)
  await page.getByRole('link', { name: 'Suppliers' }).click()
  await page.getByRole('button', { name: 'New supplier', exact: true }).click()
  await page.getByLabel('Name').fill(supplier)
  await page.getByRole('button', { name: 'Save' }).click()
  const row = page.getByRole('row').filter({ hasText: supplier })
  await row.getByRole('button', { name: 'Actions', exact: true }).click()
  await expect(row.getByRole('menuitem', { name: 'Archive' })).toHaveClass(/btn-danger/)
  await row.getByRole('menuitem', { name: 'Archive' }).click()
  await page.getByRole('dialog', { name: 'Archive supplier' }).getByRole('button', { name: 'Archive record' }).click()
  await expect(page.getByRole('row').filter({ hasText: supplier })).toHaveCount(0)
  await page.getByRole('button', { name: 'Archived' }).click()
  const archived = page.getByRole('listitem').filter({ hasText: supplier })
  await expect(archived.getByRole('button', { name: 'Restore' })).toHaveClass(/btn-ok/)
  await expect(archived.getByRole('button', { name: 'Delete permanently' })).toHaveClass(/btn-danger/)
  await archived.getByRole('button', { name: 'Delete permanently' }).click()
  await page.getByRole('dialog', { name: 'Delete permanently' }).getByRole('button', { name: 'Delete permanently' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: supplier })).toHaveCount(0)
  await page.getByRole('link', { name: 'Purchases' }).click()
  await page.getByRole('button', { name: 'New purchase', exact: true }).click()
  await expect(page.locator('select[name="supplier_id"] option', { hasText: supplier })).toHaveCount(0)
})

test('sample and import controls say what they replace', async ({ page }) => {
  await signIn(page)
  await loadSample(page)
  const sales = page.getByRole('article').filter({ hasText: 'Sales' }).locator('.money')
  await expect(sales).toHaveText('€ 605,00')
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByLabel('Import tracker workbook')).toHaveAttribute('type', 'file')
  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(sales).toHaveText('€ 605,00')
})

test('a login can be found and the last super admin cannot be deactivated', async ({ page }) => {
  await signIn(page)
  await page.getByRole('link', { name: 'Admin' }).click()
  await page.getByLabel('Find login').fill('haseeb@hak.test')
  const rows = page.getByRole('listitem').filter({ hasText: 'haseeb@hak.test' })
  await expect(rows).toHaveCount(1)
  await rows.getByRole('button', { name: 'Actions' }).click()
  await expect(rows.getByRole('menuitem', { name: 'Deactivate' })).toHaveCount(0)
  await expect(rows.getByText('Inactive')).toHaveCount(0)
})

test('the dashboard chart and backup match the sample', async ({ page }) => {
  await signIn(page)
  await loadSample(page)
  await expect(page.getByRole('article').filter({ hasText: 'Sales' }).locator('.money')).toHaveText('€ 605,00')
  await expect(page.getByRole('article').filter({ hasText: 'Net profit' }).locator('.money')).toHaveText('€ 430,00')
  await expect(page.getByRole('article').filter({ hasText: 'Margin' }).locator('.money')).toHaveText('71.1%')
  await expect(page.getByRole('article').filter({ hasText: 'Customers owe' }).locator('.money')).toHaveText('€ 305,00')
  await expect(page.getByRole('article').filter({ hasText: 'We owe suppliers' }).locator('.money')).toHaveText('€ 0,00')
  await expect(page.getByRole('article').filter({ hasText: 'Stock value' }).locator('.money')).toHaveText('€ 21,00')
  await expect(page.getByRole('article').filter({ hasText: 'Total investment' }).locator('.money')).toHaveText('€ 180,00')
  await expect(page.getByRole('article').filter({ hasText: 'Expenses' }).locator('.money')).toHaveText('€ 20,00')
  await expect(page.getByRole('article').filter({ hasText: 'Cash in' }).locator('.money')).toHaveText('€ 300,00')
  await expect(page.getByRole('article').filter({ hasText: 'Net cash' }).locator('.money')).toHaveText('€ 100,00')
  await expect(page.getByRole('article').filter({ hasText: 'Expenses' }).locator('.money')).toHaveText('€ 20,00')
  await expect(page.getByRole('article').filter({ hasText: 'Cash in' }).locator('.money')).toHaveText('€ 300,00')
  await expect(page.getByRole('article').filter({ hasText: 'Net cash' }).locator('.money')).toHaveText('€ 100,00')
  await expect(page.getByRole('row').filter({ hasText: 'Dr. Waseem' })).toContainText('20%')
  await expect(page.getByRole('heading', { name: 'Sales by month' })).toBeVisible()
  await expect(page.locator('.recharts-bar').first()).toBeVisible()
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date()).slice(0, 7)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download monthly backup' }).click(),
  ])
  expect(download.suggestedFilename()).toBe(`hak-backup-${month}.xlsx`)
  await expect(page.getByRole('article').filter({ hasText: 'Sales' }).locator('.money')).toHaveText('€ 605,00')
})

test('the calendar shows this year and a follow-up due today', async ({ page }) => {
  const shop = `Calendar Shop ${Date.now()}`
  const title = `Call ${shop}`
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
  await signIn(page)
  await page.getByRole('link', { name: 'Customers' }).click()
  await page.getByRole('button', { name: 'New customer', exact: true }).click()
  await page.getByLabel('Shop name').fill(shop)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('link', { name: `Open ${shop}` }).click()
  await page.getByRole('button', { name: 'Follow-ups' }).click()
  await page.getByRole('button', { name: 'New follow-up', exact: true }).click()
  await page.getByLabel('Follow-up title').fill(title)
  await page.getByLabel('Due date').fill(today)
  await page.getByRole('button', { name: 'Add follow-up' }).click()
  await page.getByRole('link', { name: 'Calendar' }).click()
  const monthHeading = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Lisbon', month: 'long', year: 'numeric' }).format(new Date())
  await expect(page.getByRole('heading', { name: monthHeading })).toBeVisible()
  await expect(page.locator(`[data-date="${today}"]`)).toContainText(title)
  await page.getByRole('button', { name: 'Day' }).click()
  await expect(page.getByRole('region', { name: 'Day' })).toContainText(title)
  await expect(page.getByRole('region', { name: 'Day' })).toContainText('Sales')
})

test('a salesperson does not see the monthly backup', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Email').fill('seller@hak.test')
  await page.getByRole('textbox', { name: 'Password' }).fill('password1234')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download monthly backup' })).toHaveCount(0)
  await expect(page.getByLabel('Restore backup')).toHaveCount(0)
})

test('pipeline columns show a count and an empty column explains the drag', async ({ page }) => {
  await signIn(page)
  await loadSample(page)
  await page.getByRole('link', { name: 'Pipeline' }).click()
  await expect(page.getByRole('heading', { name: 'First order 1' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lead 0' })).toBeVisible()
  const lead = page.locator('.column', { has: page.getByRole('heading', { name: 'Lead 0' }) })
  await expect(lead.getByText('Drag a shop here')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Shop B' })).toBeVisible()
})

test('a product photo is previewed and does not break sync', async ({ page }) => {
  const stamp = Date.now()
  const code = `P${String(stamp).slice(-6)}`
  const name = `Photo ${stamp}`
  await signIn(page)
  await page.getByRole('link', { name: 'Products' }).click()
  await page.getByRole('button', { name: 'New product', exact: true }).click()
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill(code)
  await page.getByPlaceholder('Name').fill(name)
  await page.getByPlaceholder('Selling price').fill('8')
  await page.getByLabel('Photo').setInputFiles({
    name: 'case.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
  })
  await expect(page.getByRole('img', { name: 'Chosen photo' })).toBeVisible()
  await page.getByRole('button', { name: 'Save product' }).click()
  const row = page.getByRole('row').filter({ hasText: `${code} ${name}` })
  await expect(row.getByRole('img', { name: `${code} ${name}` })).toBeVisible()
  await row.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('dialog', { name: 'Product' }).getByRole('img', { name: `${code} ${name}` })).toBeVisible()
  await expect(page.locator('.status')).not.toContainText('photo_path', { timeout: 40_000 })
})
