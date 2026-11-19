# GrowHub

GrowHub is an internal knowledge-sharing and gamification platform. Employees share knowledge, complete learning modules, join communities, and earn points, levels, and leaderboard rankings.

## Project structure

| Path | Description |
| --- | --- |
| `backend/` | Laravel REST API (PHP 8.4, PostgreSQL) |
| `frontend/` | Vue 3 + Vite web app |
| `grow_hub_apk/` | Flutter mobile app |
| `e2e/` | Playwright end-to-end tests |
| `docker/` | Docker configuration for local development |
| `docs/` | Project documentation |

## Getting started

Requires Docker Desktop, or Docker Engine with Compose v2.

```bash
docker compose up -d --build
```

The first start installs dependencies, runs migrations, and seeds the database.

| Service | URL |
| --- | --- |
| Web app | http://localhost:5174 |
| API | http://localhost:8001 |
| Mailpit (local email inbox) | http://localhost:8025 |
| PostgreSQL | `localhost:5432` (database, user, and password: `growhub`) |

Seeded accounts use their NIP as both username and password. For example, the local admin account is `1000000001`.

To stop the stack:

```bash
docker compose down
```

## Running tests

Backend tests:

```bash
docker compose exec backend php artisan test
```

End-to-end tests (Node 20+, with the Docker stack running):

```bash
cd e2e
npm install
npx playwright install chromium
npm test
```

## Mobile app

The mobile app runs outside Docker with the Flutter SDK. On the login screen, set the server URL to `http://10.0.2.2:8001/api` for the Android emulator or `http://127.0.0.1:8001/api` for the iOS simulator.

## Documentation

- [API documentation](docs/API_DOCUMENTATION.md)
- [System documentation](docs/SYSTEM_DOCUMENTATION.md)
- [User guide (Markdown)](docs/PANDUAN_PENGGUNA.md)
- [User guide (Word)](docs/Panduan_Pengguna_GrowHub.docx)
