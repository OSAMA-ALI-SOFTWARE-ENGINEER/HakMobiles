import { expect, test, type Page } from '@playwright/test'
import { parseEuros } from '../src/shared/money'
import { chooseAction } from './actions'

async function openForm(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('dialog', { name })).toBeVisible()
}

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('Email').fill('haseeb@hak.test')
  await page.getByRole('textbox', { name: 'Password' }).fill('ChangeMe123!')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.locator('.status')).toContainText('Synced', { timeout: 40_000 })
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

function readCents(text: string): number {
  const match = text.match(/-?\s*€\s*[\d.]+,\d{2}/)
  const cents = match ? parseEuros(match[0]) : null
  if (cents == null) throw new Error(`No amount in ${text}`)
  return cents
}

async function netCents(page: Page) {
  return readCents(await page.locator('article').filter({ hasText: 'Net profit' }).locator('strong').innerText())
}

async function partnerCents(page: Page, name: string) {
  const sentence = page.locator('.partner-panel .quiet')
  await expect(sentence).toBeVisible()
  const text = await sentence.innerText()
  if (text.includes('Partners are settled')) return 0
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const owes = text.match(new RegExp(`${escaped} owes (€\\s*[\\d.]+,\\d{2})`))
  if (owes) return -readCents(owes[1])
  const owed = text.match(new RegExp(`(€\\s*[\\d.]+,\\d{2}) to ${escaped}(?= and |\\.|$)`))
  if (owed) return readCents(owed[1])
  return 0
}

test('a stock adjustment can be previewed, edited, and archived', async ({ page }) => {
  const stamp = Date.now()
  const code = `A${String(stamp).slice(-6)}`
  const name = `CRUD adjust ${stamp}`
  await signIn(page)
  await page.getByRole('link', { name: 'Products' }).click()
  await openForm(page, 'New product')
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill(code)
  await page.getByPlaceholder('Name').fill(name)
  await page.getByPlaceholder('Selling price').fill('4')
  await page.getByRole('button', { name: 'Save product' }).click()

  await page.getByRole('button', { name: 'Adjust stock', exact: true }).click()
  await chooseOption(page, 'select[name="product_id"]', `${code} ${name}`)
  await page.getByLabel('Quantity change').fill('-1')
  await page.getByLabel('Reason').fill('Count short')
  await page.getByRole('button', { name: 'Save adjustment' }).click()
  await page.getByLabel('Find product').fill(code)
  await expect(page.getByRole('row').filter({ hasText: `${code} ${name}` })).toContainText('-1 pcs')

  const row = page.getByRole('listitem').filter({ hasText: code }).filter({ hasText: 'Count short' })
  await row.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('dialog', { name: 'Adjustment' })).toContainText(`${code} ${name} · -1 · Count short`)
  await page.getByRole('dialog', { name: 'Adjustment' }).getByRole('button', { name: 'Close' }).click()

  await chooseAction(row, 'Edit')
  await page.getByRole('dialog', { name: 'Edit adjustment' }).getByLabel('Quantity change').fill('-3')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('row').filter({ hasText: `${code} ${name}` })).toContainText('-3 pcs')
  await expect(page.getByRole('listitem').filter({ hasText: 'Count short' })).toContainText('-3')

  await chooseAction(page.getByRole('listitem').filter({ hasText: 'Count short' }), 'Archive')
  await page.getByRole('dialog', { name: 'Archive adjustment' }).getByRole('button', { name: 'Archive record' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Count short' })).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: `${code} ${name}` })).toContainText('0 pcs')
})

test('editing a price fills the next sale, lands in activity, and archive removes the product', async ({ page }) => {
  const stamp = Date.now()
  const code = `R${String(stamp).slice(-6)}`
  const name = `CRUD priced ${stamp}`
  await signIn(page)
  await page.getByRole('link', { name: 'Products' }).click()
  await openForm(page, 'New product')
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill(code)
  await page.getByPlaceholder('Name').fill(name)
  await page.getByPlaceholder('Selling price').fill('9')
  await page.getByRole('button', { name: 'Save product' }).click()
  const product = page.getByRole('row').filter({ hasText: `${code} ${name}` })
  await chooseAction(product, 'Edit')
  const pushed = page.waitForResponse((response) => response.url().includes('/api/sync/push') && response.ok(), { timeout: 20_000 })
  await page.getByRole('dialog', { name: 'Edit product' }).getByPlaceholder('Selling price').fill('14')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await pushed

  await page.getByRole('link', { name: 'Sales' }).click()
  await openForm(page, 'New sale')
  await chooseOption(page, 'select[name="product_id"]', `${code} ${name}`)
  await expect(page.locator('input[name="price"]')).toHaveValue('14,00')
  await page.getByRole('dialog', { name: 'New sale' }).getByRole('button', { name: 'Close' }).click()

  await page.getByRole('link', { name: 'Activity' }).click()
  await page.getByLabel('Find activity').fill('product.price_changed')
  await expect(page.getByText('product.price_changed').first()).toBeVisible()

  await page.getByRole('link', { name: 'Products' }).click()
  await page.getByLabel('Find product').fill(code)
  await chooseAction(page.getByRole('row').filter({ hasText: `${code} ${name}` }), 'Archive')
  await page.getByRole('dialog', { name: 'Archive product' }).getByRole('button', { name: 'Archive record' }).click()
  await expect(page.getByRole('row').filter({ hasText: code })).toHaveCount(0)

  await page.getByRole('link', { name: 'Sales' }).click()
  await openForm(page, 'New sale')
  const options = await page.locator('select[name="product_id"] option').allTextContents()
  expect(options.join('\n')).not.toContain(code)
})

test('a shop phone edit, an activity edit, and a follow-up archive', async ({ page }) => {
  const stamp = Date.now()
  const shop = `Loja Ficha ${stamp}`
  const note = `Called about ${stamp}`
  const edited = `Called back ${stamp}`
  const follow = `Ring ${stamp}`
  await signIn(page)
  await page.getByRole('link', { name: 'Customers' }).click()
  await openForm(page, 'New customer')
  await page.getByLabel('Shop name').fill(shop)
  await page.getByLabel('Phone').fill('912000111')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('link', { name: `Open ${shop}` }).click()
  await expect(page.getByRole('link', { name: 'WhatsApp', exact: true })).toHaveAttribute('href', 'https://wa.me/351912000111')

  await page.getByRole('button', { name: 'Edit shop' }).click()
  await page.getByRole('dialog', { name: 'Edit shop' }).getByLabel('Phone').fill('913000222')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:913000222')
  await expect(page.getByRole('link', { name: 'WhatsApp', exact: true })).toHaveAttribute('href', 'https://wa.me/351913000222')

  await openForm(page, 'New activity')
  await page.getByLabel('Activity note').fill(note)
  await page.getByRole('button', { name: 'Log activity' }).click()
  const activity = page.getByRole('listitem').filter({ hasText: note })
  await activity.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('dialog', { name: 'Activity' })).toContainText(note)
  await page.getByRole('dialog', { name: 'Activity' }).getByRole('button', { name: 'Close' }).click()
  await chooseAction(activity, 'Edit')
  await page.getByRole('dialog', { name: 'Edit activity' }).getByLabel('Activity note').fill(edited)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: edited })).toBeVisible()

  await page.getByRole('button', { name: 'Follow-ups' }).click()
  await openForm(page, 'New follow-up')
  await page.getByLabel('Follow-up title').fill(follow)
  await page.getByRole('button', { name: 'Add follow-up' }).click()
  await page.getByRole('link', { name: 'Follow-ups' }).click()
  const followRow = page.getByRole('listitem').filter({ hasText: follow })
  await expect(followRow).toBeVisible()
  await chooseAction(followRow, 'Archive')
  await page.getByRole('dialog', { name: 'Archive follow-up' }).getByRole('button', { name: 'Archive record' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: follow })).toHaveCount(0)
})

test('supplier payment archive restores what we owe, and the preview lists the order', async ({ page }) => {
  const stamp = Date.now()
  const supplier = `CRUD Pago ${stamp}`
  const code = `Q${String(stamp).slice(-6)}`
  const name = `CRUD owed ${stamp}`
  await signIn(page)
  await page.getByRole('link', { name: 'Products' }).click()
  await openForm(page, 'New product')
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill(code)
  await page.getByPlaceholder('Name').fill(name)
  await page.getByPlaceholder('Selling price').fill('3')
  await page.getByRole('button', { name: 'Save product' }).click()
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

  await page.getByRole('link', { name: 'Payments' }).click()
  await openForm(page, 'New payment')
  await page.locator('select[name="kind"]').selectOption({ label: 'Supplier payment' })
  await chooseOption(page, 'select[name="supplier_id"]', supplier, 'hak.paySupplier')
  await page.locator('select[name="paid_by"]').selectOption({ label: 'Haseeb' })
  await page.locator('input[name="amount"]').fill('20')
  await page.getByRole('button', { name: 'Save payment' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: `${supplier} · We owe € 0,00` })).toBeVisible()

  const payment = page.getByRole('listitem').filter({ hasText: `Payment · ${supplier}` }).filter({ hasText: '€ 20,00' })
  await payment.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('dialog', { name: 'Payment' })).toContainText('Recorded by Haseeb')
  await page.getByRole('dialog', { name: 'Payment' }).getByRole('button', { name: 'Close' }).click()
  await chooseAction(payment, 'Archive')
  await page.getByRole('dialog', { name: 'Archive payment' }).getByRole('button', { name: 'Archive record' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: `${supplier} · We owe € 20,00` })).toBeVisible()

  await page.getByRole('link', { name: 'Suppliers' }).click()
  await page.getByRole('row').filter({ hasText: supplier }).getByRole('button', { name: 'Preview' }).click()
  const preview = page.getByRole('dialog', { name: 'Supplier' })
  await expect(preview).toContainText('We owe € 20,00')
  await expect(preview).toContainText(`${code} · 10 ordered`)
})

test('an expense moves net profit and a transfer moves partner balances back on archive', async ({ page }) => {
  const stamp = Date.now()
  await signIn(page)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  const startNet = await netCents(page)
  const startHaseeb = await partnerCents(page, 'Haseeb')
  const startUmar = await partnerCents(page, 'Umar')

  await page.getByRole('link', { name: 'Expenses' }).click()
  await openForm(page, 'New expense')
  await page.getByLabel('Category').fill(`CRUD rent ${stamp}`)
  await page.getByLabel('Amount').fill('5')
  await page.getByLabel('Paid by').selectOption({ label: 'Haseeb' })
  await page.getByRole('button', { name: 'Save expense' }).click()
  const expense = page.getByRole('row').filter({ hasText: `CRUD rent ${stamp}` })
  await expense.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('dialog', { name: 'Expense' })).toContainText('Paid by Haseeb')
  await page.getByRole('dialog', { name: 'Expense' }).getByRole('button', { name: 'Close' }).click()

  await page.getByRole('link', { name: 'Dashboard' }).click()
  expect(await netCents(page)).toBe(startNet - 500)

  await page.getByRole('link', { name: 'Expenses' }).click()
  await chooseAction(expense, 'Edit')
  await page.getByRole('dialog', { name: 'Edit expense' }).getByLabel('Amount').fill('8')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('link', { name: 'Dashboard' }).click()
  expect(await netCents(page)).toBe(startNet - 800)

  await page.getByRole('link', { name: 'Expenses' }).click()
  await chooseAction(expense, 'Archive')
  await page.getByRole('dialog', { name: 'Archive expense' }).getByRole('button', { name: 'Archive record' }).click()
  await expect(page.getByRole('row').filter({ hasText: `CRUD rent ${stamp}` })).toHaveCount(0)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  expect(await netCents(page)).toBe(startNet)

  await page.getByRole('link', { name: 'Transfers' }).click()
  await openForm(page, 'New transfer')
  await page.getByLabel('From').selectOption({ label: 'Haseeb' })
  await page.getByLabel('To').selectOption({ label: 'Umar' })
  await page.getByLabel('Amount').fill('10')
  await page.getByRole('button', { name: 'Save transfer' }).click()
  const transfer = page.getByRole('listitem').filter({ hasText: 'Haseeb → Umar' }).filter({ hasText: '€ 10,00' })
  await expect(transfer).toBeVisible()
  await page.getByRole('link', { name: 'Dashboard' }).click()
  expect(await partnerCents(page, 'Haseeb')).toBe(startHaseeb + 1000)
  expect(await partnerCents(page, 'Umar')).toBe(startUmar - 1000)
  expect(await netCents(page)).toBe(startNet)

  await page.getByRole('link', { name: 'Transfers' }).click()
  await chooseAction(transfer, 'Edit')
  await page.getByRole('dialog', { name: 'Edit transfer' }).getByLabel('Amount').fill('15')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('link', { name: 'Dashboard' }).click()
  expect(await partnerCents(page, 'Haseeb')).toBe(startHaseeb + 1500)
  expect(await partnerCents(page, 'Umar')).toBe(startUmar - 1500)
  expect(await netCents(page)).toBe(startNet)

  await page.getByRole('link', { name: 'Transfers' }).click()
  await chooseAction(page.getByRole('listitem').filter({ hasText: 'Haseeb → Umar' }).filter({ hasText: '€ 15,00' }), 'Archive')
  await page.getByRole('dialog', { name: 'Archive transfer' }).getByRole('button', { name: 'Archive record' }).click()
  await page.getByRole('link', { name: 'Dashboard' }).click()
  expect(await partnerCents(page, 'Haseeb')).toBe(startHaseeb)
  expect(await partnerCents(page, 'Umar')).toBe(startUmar)
  expect(await netCents(page)).toBe(startNet)
})
