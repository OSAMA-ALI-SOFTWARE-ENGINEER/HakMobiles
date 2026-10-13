import { expect, test } from '@playwright/test'

test('header menus stay separate and the user form is labelled', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Email').fill('haseeb@hak.test')
  await page.getByRole('textbox', { name: 'Password' }).fill('ChangeMe123!')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.getByRole('button', { name: 'Notifications' }).click()
  const notices = page.getByRole('region', { name: 'Notices' })
  const account = page.getByRole('region', { name: 'Account' })
  await expect(notices).toBeVisible()
  await expect(notices.getByText('Notices')).toBeVisible()
  await expect(account).toHaveCount(0)

  await page.getByRole('button', { name: 'Account, Haseeb' }).click()
  await expect(account).toBeVisible()
  await expect(account.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await expect(notices).toHaveCount(0)

  const accountBox = await account.boundingBox()
  await page.getByRole('button', { name: 'Notifications' }).click()
  await expect(notices).toBeVisible()
  await expect(account).toHaveCount(0)
  const noticeBox = await notices.boundingBox()
  expect(accountBox).toBeTruthy()
  expect(noticeBox).toBeTruthy()

  await page.mouse.click(8, 8)
  await expect(notices).toHaveCount(0)

  await page.getByRole('link', { name: 'Admin' }).click()
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  await page.getByRole('button', { name: 'New login', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'New login' })).toBeVisible()
  await expect(page.getByLabel('Name')).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Role')).toHaveValue('Salesperson')
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog', { name: 'New login' })).toHaveCount(0)
  await expect(page.getByRole('listitem').filter({ hasText: 'haseeb@hak.test' })).toContainText('Super Admin')
})

test('a user can save their own phone from the account menu', async ({ page }) => {
  const phone = `91${String(Date.now()).slice(-7)}`
  await page.goto('/')
  await page.getByLabel('Email').fill('haseeb@hak.test')
  await page.getByRole('textbox', { name: 'Password' }).fill('ChangeMe123!')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.getByRole('button', { name: 'Account, Haseeb' }).click()
  await page.getByRole('button', { name: 'Profile' }).click()
  const dialog = page.getByRole('dialog', { name: 'Profile' })
  await dialog.getByLabel('Phone').fill(phone)
  await dialog.getByRole('button', { name: 'Save profile' }).click()
  await expect(dialog).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Account, Haseeb' }).click()
  await expect(page.getByRole('region', { name: 'Account' })).toContainText(phone)
})

test('pages fill the screen and each form opens from a button', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Email').fill('haseeb@hak.test')
  await page.getByRole('textbox', { name: 'Password' }).fill('ChangeMe123!')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Sales by month' })).toBeVisible()

  const content = await page.locator('.content').boundingBox()
  expect(content?.width ?? 0).toBeGreaterThan(900)
  expect(content?.height ?? 0).toBeGreaterThan(500)

  await page.getByRole('link', { name: 'Products' }).click()
  const list = await page.locator('.record-list').first().boundingBox()
  expect(list?.width ?? 0).toBeGreaterThan(800)
  await expect(page.getByLabel('Product name')).toHaveCount(0)
  await expect(page.getByLabel('Category', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'New product', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New product' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Product name')).toBeVisible()
  await expect(dialog.getByLabel('Product category')).toBeVisible()
  await expect(dialog.getByLabel('Selling price')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Adjust stock', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Adjust stock' }).getByLabel('Quantity change')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  const forms: [string, string, string, string][] = [
    ['Sales', 'New sale', 'New sale', 'Sale date'],
    ['Purchases', 'New purchase', 'New purchase', 'Shipping'],
    ['Payments', 'New payment', 'New payment', 'Payment type'],
    ['Expenses', 'New expense', 'New expense', 'Paid by'],
    ['Transfers', 'New transfer', 'New transfer', 'From'],
    ['Customers', 'New customer', 'New customer', 'Shop name'],
    ['Settings', 'Edit invoice footer', 'Invoice footer', 'Invoice footer'],
  ]
  for (const [link, button, dialogName, field] of forms) {
    await page.getByRole('link', { name: link }).click()
    await expect(page.getByLabel(field, { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: button, exact: true }).click()
    const popup = page.getByRole('dialog', { name: dialogName })
    await expect(popup.getByLabel(field, { exact: true })).toBeVisible()
    await popup.getByRole('button', { name: 'Close' }).click()
    await expect(popup).toHaveCount(0)
  }
})
