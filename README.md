# GrowHub

- `backend/` — Laravel API (PHP 8.4)
- `frontend/` — Vue + Vite web app
- `grow_hub_apk/` — Flutter mobile app (not containerised; run it with the Flutter SDK)

## Local development with Docker

Requires Docker Desktop (or Docker Engine + Compose v2).

```bash
docker compose up -d --build
docker compose logs -f backend   # first boot runs composer install, migrations and seeding
```

| Service  | URL                          | Notes                                   |
|----------|------------------------------|-----------------------------------------|
| Frontend | http://localhost:5174        | Vite dev server, proxies `/api` and `/storage` to the backend |
| Backend  | http://localhost:8001        | `php artisan serve`                     |
| Postgres | `localhost:5432`             | db/user/password: `growhub`             |
| Mailpit  | http://localhost:8025        | Catches all outgoing mail (e.g. OTPs)   |

Seeded employee accounts log in with their NIP as both username and password.

Override host ports with `FRONTEND_PORT`, `BACKEND_PORT`, `DB_FORWARD_PORT` or `MAILPIT_PORT`
(e.g. in a root `.env` file) if they clash with something already running.

### What happens on backend start

`docker/backend/entrypoint.sh` creates `backend/.env` from `.env.example` if missing, writes the
Docker DB/mail settings into it, installs Composer deps, generates `APP_KEY`, runs migrations,
seeds the database **only if it has no users**, and links storage. Your data survives restarts.

### Common commands

```bash
docker compose exec backend php artisan test          # uses sqlite :memory:, dev DB untouched
docker compose exec backend php artisan migrate:fresh --seed
docker compose exec backend php artisan tinker
docker compose exec frontend npm install <package>
docker compose exec db psql -U growhub growhub
docker compose down        # stop
docker compose down -v     # stop and wipe the database and node_modules volumes
```

### Browser tests (Playwright)

End-to-end tests live in `e2e/` and run on your machine (Node 20+) against the Docker stack.

```bash
cd e2e
npm install
npx playwright install chromium   # first time only
npm test                          # headless
npm run test:ui                   # interactive UI mode
npm run report                    # open the last HTML report (traces/videos of failures)
npm run codegen                   # record a new test by clicking through the app
```

- Logs in as the seeded admin (`1000000001`, password = NIP). If you changed that password
  locally, run with `E2E_ADMIN_PASSWORD=<password> npm test`.
- `first-login.spec.js` resets user `2023010017` to "must change password", reads the OTP
  email from Mailpit's API, and resets the user again afterwards. Keep that account for tests only.
- Tests run serially against the dev database. To start from clean seed data:
  `docker compose exec backend php artisan migrate:fresh --seed`.

### Mobile app against the Docker backend

The app's built-in defaults use port 8000; the Docker backend is on 8001. Set the server URL
on the login screen to `http://10.0.2.2:8001/api` (Android emulator), `http://127.0.0.1:8001/api`
(iOS simulator / desktop) or `http://<your-machine-LAN-IP>:8001/api` (physical device) —
or start with `BACKEND_PORT=8000 docker compose up -d` to match the defaults.
