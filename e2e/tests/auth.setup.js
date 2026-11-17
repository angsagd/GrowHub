import { test as setup, expect } from '@playwright/test'
import { ADMIN_STATE } from '../playwright.config.js'
import { ADMIN } from '../support/accounts.js'
import { loginPage } from '../support/pages.js'

// Logs in once as admin and saves localStorage (token) for tests that use ADMIN_STATE.
setup('authenticate as admin', async ({ page }) => {
  await loginPage(page).login(ADMIN.nip, ADMIN.password)
  await expect(page).toHaveURL('/')
  await page.context().storageState({ path: ADMIN_STATE })
})
