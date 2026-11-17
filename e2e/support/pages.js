/** Locators for the login screen (frontend/src/views/LoginView.vue). */
export function loginPage(page) {
  return {
    nip: page.getByPlaceholder('e.g. 202301001'),
    password: page.getByPlaceholder('Enter password'),
    submit: page.getByRole('button', { name: 'Sign In' }),
    error: page.locator('.error-alert'),
    async login(nip, password) {
      await page.goto('/login')
      await this.nip.fill(nip)
      await this.password.fill(password)
      await this.submit.click()
    },
  }
}
