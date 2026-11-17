import { test, expect } from '@playwright/test'
import { ADMIN } from '../support/accounts.js'
import { loginPage } from '../support/pages.js'

test.describe('Login', () => {
  test('rejects a NIP that is not 9-10 digits', async ({ page }) => {
    const login = loginPage(page)
    await login.login('12345', 'whatever')
    await expect(login.error).toContainText('9 to 10 numeric digits')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('shows an error for a wrong password', async ({ page }) => {
    const login = loginPage(page)
    await login.login(ADMIN.nip, 'wrong-password')
    await expect(login.error).toContainText('NIP atau password salah')
  })

  test('admin can sign in and reach the home page', async ({ page }) => {
    await loginPage(page).login(ADMIN.nip, ADMIN.password)
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'Knowledge Categories' })).toBeVisible()
  })

  test('protected pages redirect to login when signed out', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })
})
