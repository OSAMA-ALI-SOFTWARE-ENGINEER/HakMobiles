import type { Locator } from '@playwright/test'

const menuActions = new Set(['Edit', 'Archive', 'Invoice PDF', 'Change role', 'Reset password', 'Deactivate'])

export async function chooseAction(row: Locator, name: string) {
  if (!menuActions.has(name)) {
    await row.getByRole('button', { name, exact: true }).click()
    return
  }
  await row.getByRole('button', { name: 'Actions', exact: true }).click()
  await row.getByRole('menuitem', { name, exact: true }).click()
}
