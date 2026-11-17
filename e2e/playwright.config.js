import { defineConfig, devices } from '@playwright/test'

// Runs against the Docker stack (`docker compose up -d` from the repo root).
export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5174'
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL || 'http://localhost:8025'
export const ADMIN_STATE = 'playwright/.auth/admin.json'

export default defineConfig({
  testDir: './tests',
  // Tests share one dev database, so keep them serial for predictable data.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    locale: 'id-ID',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.js/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
})
