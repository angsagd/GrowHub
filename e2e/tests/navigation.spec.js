import { test, expect } from '@playwright/test'
import { ADMIN_STATE } from '../playwright.config.js'

test.use({ storageState: ADMIN_STATE })

const pages = [
  ['/', 'Home – GrowHub'],
  ['/dashboard', 'My Dashboard & Gamification – GrowHub'],
  ['/feed', 'Knowledge Feed – GrowHub'],
  ['/leaderboard', /Leaderboard/],
  ['/learning', /Learning/],
]

for (const [path, title] of pages) {
  test(`admin can open ${path}`, async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto(path)
    await expect(page).toHaveURL(path)
    await expect(page).toHaveTitle(title)
    expect(errors, 'uncaught JS errors').toEqual([])
  })
}
