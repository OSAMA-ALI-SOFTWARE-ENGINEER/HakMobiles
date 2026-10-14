import { expect, test, type Page } from '@playwright/test'
import { chooseAction } from './actions'

async function openForm(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('dialog', { name })).toBeVisible()
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

async function chooseOption(page: Page, selector: string, label: string, storageKey?: string) {
  await page.locator(selector).evaluate((element, input) => {
    const select = element as HTMLSelectElement
    const option = [...select.options].find((item) => item.text === input.label)
    if (!option) throw new Error(`missing ${input.label}`)
    select.value = option.value
    if (input.storageKey) sessionStorage.setItem(input.storageKey, option.value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }, { label, storageKey })
}

test('a purchase can be previewed, edited, and archived', async ({ page }) => {
  const stamp = Date.now()
  const supplier = `CRUD Supplier ${stamp}`
  const code = `C${String(stamp).slice(-6)}`
  const name = `CRUD Item ${stamp}`
  await signIn(page, 'haseeb@hak.test', 'ChangeMe123!')
  await expect(page.locator('.status')).toContainText('Synced', { timeout: 20_000 })

  await page.getByRole('link', { name: 'Products' }).click()
  await openForm(page, 'New product')
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill(code)
  await page.getByPlaceholder('Name').fill(name)
  await page.getByPlaceholder('Selling price').fill('8')
  await page.getByRole('button', { name: 'Save product' }).click()
  await expect(page.getByRole('row').filter({ hasText: `${code} ${name}` })).toContainText('0 pcs')

  await page.getByRole('link', { name: 'Suppliers' }).click()
  await openForm(page, 'New supplier')
  await page.getByLabel('Name').fill(supplier)
  await page.getByRole('button', { name: 'Save' }).click()

  await page.getByRole('link', { name: 'Purchases' }).click()
  await openForm(page, 'New purchase')
  await chooseOption(page, 'select[name="supplier_id"]', supplier, 'hak.purchaseSupplier')
  await chooseOption(page, 'select[name="product_id"]', name)
  await page.locator('input[name="qty"]').fill('10')
  await page.locator('input[name="cost"]').fill('2')
  await page.getByLabel('Received').fill('10')
  await page.getByRole('button', { name: 'Save purchase' }).click()

  const order = page.getByRole('row').filter({ hasText: supplier }).filter({ hasText: '10 received' })
  await expect(order).toBeVisible()
  await order.getByRole('button', { name: 'Preview' }).click()
  const preview = page.getByRole('dialog', { name: 'Purchase' })
  await expect(preview).toContainText('Ordered 10')
  await expect(preview).toContainText('Received 10')
  await preview.getByRole('button', { name: 'Close' }).click()

  await chooseAction(order, 'Edit')
  await page.getByRole('dialog', { name: 'Edit purchase' }).locator('input[name="received"]').fill('4')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('link', { name: 'Products' }).click()
  await page.getByLabel('Find product').fill(code)
  await expect(page.getByRole('row').filter({ hasText: code })).toContainText('4 pcs')

  await page.getByRole('link', { name: 'Purchases' }).click()
  await chooseAction(page.getByRole('row').filter({ hasText: supplier }).filter({ hasText: '4 received' }), 'Archive')
  await page.getByRole('dialog', { name: 'Archive purchase' }).getByRole('button', { name: 'Archive record' }).click()
  await expect(page.getByRole('row').filter({ hasText: supplier }).filter({ hasText: '4 received' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Products' }).click()
  await page.getByLabel('Find product').fill(code)
  await expect(page.getByRole('row').filter({ hasText: code })).toContainText('0 pcs')
  await page.getByRole('link', { name: 'Suppliers' }).click()
  await expect(page.getByRole('row').filter({ hasText: supplier })).toContainText('We owe € 0,00')
})

test('a product price can be edited and a supplier with nothing owed can be archived', async ({ page }) => {
  const stamp = Date.now()
  const supplier = `CRUD Empty ${stamp}`
  const code = `E${String(stamp).slice(-6)}`
  const name = `CRUD Price ${stamp}`
  await signIn(page, 'haseeb@hak.test', 'ChangeMe123!')
  await expect(page.locator('.status')).toContainText('Synced', { timeout: 20_000 })

  await page.getByRole('link', { name: 'Products' }).click()
  await openForm(page, 'New product')
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill(code)
  await page.getByPlaceholder('Name').fill(name)
  await page.getByPlaceholder('Selling price').fill('8')
  await page.getByRole('button', { name: 'Save product' }).click()
  const product = page.getByRole('row').filter({ hasText: `${code} ${name}` })
  await chooseAction(product, 'Edit')
  await page.getByRole('dialog', { name: 'Edit product' }).getByPlaceholder('Selling price').fill('12')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await product.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('dialog', { name: 'Product' })).toContainText('Price € 12,00')
  await page.getByRole('dialog', { name: 'Product' }).getByRole('button', { name: 'Close' }).click()

  await page.getByRole('link', { name: 'Suppliers' }).click()
  await openForm(page, 'New supplier')
  await page.getByLabel('Name').fill(supplier)
  await page.getByRole('button', { name: 'Save' }).click()
  const row = page.getByRole('row').filter({ hasText: supplier })
  await chooseAction(row, 'Archive')
  await page.getByRole('dialog', { name: 'Archive supplier' }).getByRole('button', { name: 'Archive record' }).click()
  await expect(page.getByRole('row').filter({ hasText: supplier })).toHaveCount(0)
})

test('archiving a sale puts the stock back and does not reuse the invoice number', async ({ page }) => {
  const stamp = Date.now()
  const shop = `Loja CRUD ${stamp}`
  const code = `S${String(stamp).slice(-6)}`
  await signIn(page, 'haseeb@hak.test', 'ChangeMe123!')
  await expect(page.locator('.status')).toContainText('Synced', { timeout: 20_000 })

  await page.getByRole('link', { name: 'Customers' }).click()
  await openForm(page, 'New customer')
  await page.getByLabel('Shop name').fill(shop)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('link', { name: 'Products' }).click()
  await openForm(page, 'New product')
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill(code)
  await page.getByPlaceholder('Name').fill('CRUD sale item')
  await page.getByPlaceholder('Selling price').fill('10')
  await page.getByRole('button', { name: 'Save product' }).click()

  await page.getByRole('link', { name: 'Sales' }).click()
  await openForm(page, 'New sale')
  await chooseOption(page, 'select[name="customer_id"]', shop, 'hak.saleCustomer')
  await chooseOption(page, 'select[name="product_id"]', `${code} CRUD sale item`)
  await page.locator('input[name="qty"]').fill('2')
  await page.locator('input[name="price"]').fill('10')
  await page.getByRole('button', { name: 'Save sale' }).click()
  const sale = page.getByRole('row').filter({ hasText: shop }).filter({ hasText: '€ 20,00' })
  await expect(sale).toBeVisible()
  const invoiceNo = (await sale.locator('.cell-main > span').first().innerText()).trim()
  await sale.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('dialog', { name: 'Invoice' })).toContainText('CRUD sale item')
  await page.getByRole('dialog', { name: 'Invoice' }).getByRole('button', { name: 'Close' }).click()
  await chooseAction(sale, 'Archive')
  await page.getByRole('dialog', { name: 'Archive invoice' }).getByRole('button', { name: 'Archive record' }).click()
  await expect(page.getByRole('row').filter({ hasText: invoiceNo })).toHaveCount(0)

  await page.getByRole('link', { name: 'Products' }).click()
  await page.getByLabel('Find product').fill(code)
  await expect(page.getByRole('row').filter({ hasText: code })).toContainText('0 pcs')

  await page.getByRole('link', { name: 'Sales' }).click()
  await openForm(page, 'New sale')
  await chooseOption(page, 'select[name="customer_id"]', shop, 'hak.saleCustomer')
  await chooseOption(page, 'select[name="product_id"]', `${code} CRUD sale item`)
  await page.locator('input[name="qty"]').fill('1')
  await page.locator('input[name="price"]').fill('10')
  await page.getByRole('button', { name: 'Save sale' }).click()
  const next = page.getByRole('row').filter({ hasText: shop }).filter({ hasText: '€ 10,00' })
  await expect(next).toBeVisible()
  const nextNo = (await next.locator('.cell-main > span').first().innerText()).trim()
  expect(nextNo).not.toBe(invoiceNo)
})

test('archiving a customer payment makes the invoice unpaid again', async ({ page }) => {
  const stamp = Date.now()
  const shop = `Loja Pago ${stamp}`
  const code = `Y${String(stamp).slice(-6)}`
  await signIn(page, 'haseeb@hak.test', 'ChangeMe123!')
  await expect(page.locator('.status')).toContainText('Synced', { timeout: 20_000 })

  await page.getByRole('link', { name: 'Customers' }).click()
  await openForm(page, 'New customer')
  await page.getByLabel('Shop name').fill(shop)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('link', { name: 'Products' }).click()
  await openForm(page, 'New product')
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill(code)
  await page.getByPlaceholder('Name').fill('CRUD pay item')
  await page.getByPlaceholder('Selling price').fill('15')
  await page.getByRole('button', { name: 'Save product' }).click()
  await page.getByRole('link', { name: 'Sales' }).click()
  await openForm(page, 'New sale')
  await chooseOption(page, 'select[name="customer_id"]', shop, 'hak.saleCustomer')
  await chooseOption(page, 'select[name="product_id"]', `${code} CRUD pay item`)
  await page.locator('input[name="qty"]').fill('1')
  await page.locator('input[name="price"]').fill('15')
  await page.getByRole('button', { name: 'Save sale' }).click()

  await page.getByRole('link', { name: 'Payments' }).click()
  await openForm(page, 'New payment')
  await chooseOption(page, 'select[name="customer_id"]', shop, 'hak.payCustomer')
  await page.locator('select[name="paid_by"]').selectOption({ label: 'Haseeb' })
  await page.locator('input[name="amount"]').fill('15')
  await page.getByRole('button', { name: 'Save payment' }).click()
  await expect(page.getByRole('row').filter({ hasText: shop }).filter({ has: page.getByRole('cell', { name: 'Paid', exact: true }) })).toBeVisible()

  const payment = page.getByRole('listitem').filter({ hasText: `Payment · ${shop}` }).filter({ hasText: '€ 15,00' })
  await chooseAction(payment, 'Archive')
  await page.getByRole('dialog', { name: 'Archive payment' }).getByRole('button', { name: 'Archive record' }).click()
  await expect(payment).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: shop }).filter({ hasText: '€ 15,00 left' })).toBeVisible()
})

test('a transfer to the same partner is refused and an expense can be archived', async ({ page }) => {
  const stamp = Date.now()
  await signIn(page, 'haseeb@hak.test', 'ChangeMe123!')
  await expect(page.locator('.status')).toContainText('Synced', { timeout: 20_000 })

  await page.getByRole('link', { name: 'Transfers' }).click()
  await openForm(page, 'New transfer')
  await page.getByLabel('From').selectOption({ label: 'Haseeb' })
  await page.getByLabel('To').selectOption({ label: 'Haseeb' })
  await page.getByLabel('Amount').fill('5')
  await page.getByRole('button', { name: 'Save transfer' }).click()
  await expect(page.getByText('Choose two different partners.')).toBeVisible()
  await page.getByRole('dialog', { name: 'New transfer' }).getByRole('button', { name: 'Close' }).click()

  await page.getByRole('link', { name: 'Expenses' }).click()
  await openForm(page, 'New expense')
  await page.getByLabel('Category').fill(`CRUD rent ${stamp}`)
  await page.getByLabel('Amount').fill('6')
  await page.getByLabel('Paid by').selectOption({ label: 'Haseeb' })
  await page.getByRole('button', { name: 'Save expense' }).click()
  const expense = page.getByRole('row').filter({ hasText: `CRUD rent ${stamp}` }).filter({ hasText: '€ 6,00' })
  await expect(expense).toBeVisible()
  await chooseAction(expense, 'Archive')
  await page.getByRole('dialog', { name: 'Archive expense' }).getByRole('button', { name: 'Archive record' }).click()
  await expect(expense).toHaveCount(0)
})

test('a login can change role and a deactivated user cannot sign in', async ({ page }) => {
  const stamp = Date.now()
  const email = `clerk.${stamp}@hak.test`
  await signIn(page, 'haseeb@hak.test', 'ChangeMe123!')
  await expect(page.locator('.status')).toContainText('Synced', { timeout: 20_000 })
  await page.getByRole('link', { name: 'Admin' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Super Admin' }).getByRole('button', { name: 'Deactivate' })).toHaveCount(0)

  await openForm(page, 'New login')
  await page.getByLabel('Name').fill(`Clerk ${stamp}`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Role').selectOption('Salesperson')
  await page.getByRole('button', { name: 'Create login' }).click()
  const password = (await page.locator('.banner button').innerText()).trim()
  expect(password.length).toBeGreaterThan(6)

  const user = page.getByRole('listitem').filter({ hasText: email })
  await chooseAction(user, 'Change role')
  await page.getByRole('dialog', { name: 'Change role' }).getByLabel('Role').selectOption('Manager')
  await page.getByRole('button', { name: 'Save role' }).click()
  await expect(user).toContainText('Manager')

  await chooseAction(user, 'Deactivate')
  await page.getByRole('dialog', { name: 'Deactivate login' }).getByRole('button', { name: 'Deactivate' }).click()
  const archived = page.getByRole('list', { name: 'Archived logins' })
  await expect(archived.getByRole('listitem').filter({ hasText: email })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Active logins' }).getByRole('listitem').filter({ hasText: email })).toHaveCount(0)

  await page.getByRole('button', { name: 'Account, Haseeb' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await signIn(page, email, password)
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
  await expect(page.locator('.status')).toHaveCount(0)

  await signIn(page, 'haseeb@hak.test', 'ChangeMe123!')
  await expect(page.locator('.status')).toContainText('Synced', { timeout: 20_000 })
  await page.getByRole('link', { name: 'Admin' }).click()
  await page.getByRole('button', { name: 'Archived' }).click()
  const archivedAgain = page.getByRole('list', { name: 'Archived logins' })
  const archivedUser = archivedAgain.getByRole('listitem').filter({ hasText: email })
  await archivedUser.getByRole('button', { name: 'Reactivate' }).click()
  await expect(page.getByRole('list', { name: 'Active logins' }).getByRole('listitem').filter({ hasText: email })).toBeVisible()
  await expect(archivedAgain.getByRole('listitem').filter({ hasText: email })).toHaveCount(0)

  const restored = page.getByRole('list', { name: 'Active logins' }).getByRole('listitem').filter({ hasText: email })
  await chooseAction(restored, 'Deactivate')
  await page.getByRole('dialog', { name: 'Deactivate login' }).getByRole('button', { name: 'Deactivate' }).click()
  await archivedAgain.getByRole('listitem').filter({ hasText: email }).getByRole('button', { name: 'Delete permanently' }).click()
  await page.getByRole('dialog', { name: 'Delete permanently' }).getByRole('button', { name: 'Delete permanently' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: email })).toHaveCount(0)
})
