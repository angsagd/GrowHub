import { request, expect } from '@playwright/test'
import { MAILPIT_URL } from '../playwright.config.js'

const query = (email) => `to:"${email}"`

/** Delete every Mailpit message addressed to `email`. */
export async function clearInbox(email) {
  const ctx = await request.newContext({ baseURL: MAILPIT_URL })
  await ctx.delete('/api/v1/search', { params: { query: query(email) } })
  await ctx.dispose()
}

/** Wait for the newest OTP email to `email` and return the 6-digit code. */
export async function waitForOtp(email, { timeout = 15_000 } = {}) {
  const ctx = await request.newContext({ baseURL: MAILPIT_URL })
  let messageId

  await expect
    .poll(
      async () => {
        const res = await ctx.get('/api/v1/search', { params: { query: query(email), limit: 1 } })
        messageId = (await res.json()).messages?.[0]?.ID
        return messageId
      },
      { timeout, message: `No email to ${email} arrived in Mailpit` },
    )
    .toBeTruthy()

  const msg = await (await ctx.get(`/api/v1/message/${messageId}`)).json()
  await ctx.dispose()

  const text = `${msg.Text || ''} ${(msg.HTML || '').replace(/<[^>]+>/g, ' ')}`
  const code = text.match(/\b\d{6}\b/)?.[0]
  if (!code) throw new Error(`No 6-digit OTP found in email "${msg.Subject}"`)
  return code
}
