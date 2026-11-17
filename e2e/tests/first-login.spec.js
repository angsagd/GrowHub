import { test, expect } from '@playwright/test'
import { FIRST_LOGIN_USER as USER } from '../support/accounts.js'
import { adminApi, resetUserPassword } from '../support/api.js'
import { clearInbox, waitForOtp } from '../support/mailpit.js'
import { loginPage } from '../support/pages.js'

test('first login forces a password change verified by email OTP', async ({ page }) => {
  const api = await adminApi()
  await resetUserPassword(api, USER.nip)
  await clearInbox(USER.email)

  // Default password is the NIP; the app should switch to the OTP flow and email a code.
  await loginPage(page).login(USER.nip, USER.nip)
  const otpInput = page.locator('#otp-code-input')
  await expect(otpInput).toBeVisible()

  const otp = await waitForOtp(USER.email)
  await otpInput.fill(otp)
  await page.getByRole('button', { name: 'Verifikasi Kode OTP' }).click()

  const newPassword = `E2e-${Date.now()}`
  await page.getByPlaceholder('Minimal 8 karakter').fill(newPassword)
  await page.getByPlaceholder('Ulangi password baru').fill(newPassword)
  await page.getByRole('button', { name: 'Simpan & Masuk ke GrowHub' }).click()

  await expect(page).toHaveURL('/')

  // Leave the account in its seeded state for the next run / manual use.
  await resetUserPassword(api, USER.nip)
  await api.dispose()
})
