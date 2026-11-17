import { request } from '@playwright/test'
import { BASE_URL } from '../playwright.config.js'
import { ADMIN } from './accounts.js'

/** API context authenticated as the seeded admin (talks to /api through the Vite proxy). */
export async function adminApi() {
  const ctx = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Accept: 'application/json' },
  })
  const res = await ctx.post('/api/auth/login', { data: ADMIN })
  if (!res.ok()) throw new Error(`Admin API login failed: ${res.status()} ${await res.text()}`)
  const { token } = await res.json()
  await ctx.dispose()

  return request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })
}

/** Reset a user back to "password = NIP, must change password on next login". */
export async function resetUserPassword(api, nip) {
  const list = await api.get('/api/admin/users', { params: { q: nip, per_page: 100 } })
  if (!list.ok()) throw new Error(`Listing users failed: ${list.status()} ${await list.text()}`)
  const body = await list.json()
  const users = body.data ?? body.users?.data ?? body.users ?? body
  const user = users.find((u) => u.nip === nip)
  if (!user) throw new Error(`User with NIP ${nip} not found`)

  const res = await api.post(`/api/admin/users/${user.id}/reset-password`)
  if (!res.ok()) throw new Error(`Reset password failed: ${res.status()} ${await res.text()}`)
}
