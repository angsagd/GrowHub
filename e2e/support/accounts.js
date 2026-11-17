// Seeded by backend/database/seeders/DatabaseSeeder.php — default password is the NIP.
// Override with E2E_ADMIN_NIP / E2E_ADMIN_PASSWORD if you changed the admin password locally.
export const ADMIN = {
  nip: process.env.E2E_ADMIN_NIP || '1000000001',
  password: process.env.E2E_ADMIN_PASSWORD || process.env.E2E_ADMIN_NIP || '1000000001',
}

// Reserved for the first-login test: it gets reset to "must change password" before each run.
// Don't use this account in other tests.
export const FIRST_LOGIN_USER = {
  nip: '2023010017',
  email: 'ayu.kusuma@growhub.co.id',
}
