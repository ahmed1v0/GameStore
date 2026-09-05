# Game Store Technical Assessment

## Overview

Game Store is a monorepo containing a Django REST API and a Next.js client for
browsing and purchasing region-specific digital game items. PostgreSQL stores
the catalog, users, and immutable purchase receipts.

## Features

- CSV-backed product catalog for Jordan (`JO`) and Saudi Arabia (`SA`)
- JWT-authenticated REST API
- Signup with optional email verification, password recovery, secure refresh cookies, and admin/user management
- Paginated and location-filtered product browsing
- Single-product purchase flow with historical receipt snapshots
- Generated OpenAPI schema and Swagger UI
- Responsive Next.js client

## Technology Stack

- Python 3.13, Django, Django REST Framework, SimpleJWT, drf-spectacular
- PostgreSQL 17, pytest, pytest-django, Ruff
- Next.js, React, TypeScript, Tailwind CSS, TanStack Query, Zod

## Architecture Overview

The backend follows Django application boundaries: `catalog` owns products and
CSV import, while `orders` owns purchases and receipts. Django ORM is used
directly; only the purchase workflow has a dedicated service function. The
frontend keeps HTTP access in `src/lib/api`, server state in TanStack Query, and
route-specific UI in the App Router.

## Repository Structure

```text
backend/       Django API, applications, migrations, and tests
frontend/      Next.js application
data/          Importable product CSV
docs/          Architecture, decisions, and testing strategy
docker-compose.yml
```

## Prerequisites

- Python 3.13
- Node.js 22 or newer
- Docker Desktop with Docker Compose

## Quick Start

For an existing checkout with dependencies installed, start PostgreSQL, apply migrations,
and run both applications from one PowerShell terminal:

```powershell
.\run-all.ps1
```

Use `.\run-all.ps1 -Install` for the first setup and `-OpenBrowser` to open the app.
Press Ctrl+C to stop Django and Next.js. PostgreSQL stays running unless you add
`-StopDatabaseOnExit`. Use `-SkipDocker` when PostgreSQL is managed separately, or
`-CheckOnly` to validate prerequisites without starting services.

### Clone Repository

```bash
git clone <repository-url>
cd assessment
```

### Environment Configuration

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

The checked-in examples contain local-only values. Change the Django secret in
any shared or deployed environment.

### Start PostgreSQL

```powershell
docker compose up -d db
docker compose ps
```

Continue once the `db` service reports `healthy`.

### Backend Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".\backend[dev]"
```

### Database Migrations

```powershell
python backend/manage.py migrate
```

### CSV Import

```powershell
python backend/manage.py import_items data/items.csv
```

### Seed Administrator

```powershell
python backend/manage.py seed_admin --username admin --email admin@example.com --password P@ssw0rd
```

The command is idempotent and updates the administrator password if the account already exists.

### Start Backend

```powershell
python backend/manage.py runserver
```

### Frontend Setup

```powershell
Set-Location frontend
npm ci
```

### Start Frontend

```powershell
npm run dev
```

Open `http://localhost:3000`.

VS Code users can select the `Full Stack` launch target after PostgreSQL is
healthy and dependencies are installed. It starts both development servers with
debugging enabled.

## Environment Variables

### Backend

| Variable | Purpose | Local default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Local Compose database |
| `DJANGO_SECRET_KEY` | Django/JWT signing secret | Unsafe example value |
| `DEBUG` | Django debug mode | `true` |
| `ALLOWED_HOSTS` | Comma-separated hosts | `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | Allowed browser origins | `http://localhost:3000` |
| `EMAIL_VERIFICATION_ENABLED` | Require new users to verify email | `true` in `.env.example` |
| `EMAIL_BACKEND` | Console locally or SMTP delivery | Console backend in `.env.example` |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | SMTP credentials | Empty |
| `EMAIL_USE_TLS` / `EMAIL_USE_SSL` | SMTP transport security (choose one) | `true` / `false` |
| `EMAIL_TIMEOUT` | Maximum SMTP wait in seconds | `10` |

### Frontend

| Variable | Purpose | Local default |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Browser-visible API base URL | `http://localhost:8000/api/v1` |

## API Documentation

With the backend running, Swagger UI is available at `http://localhost:8000/api/docs/`
and the OpenAPI schema at `http://localhost:8000/api/schema/`.

## Authentication

Use `ADMIN_CREDENTIALS.local.md` to record the credentials you choose for your local
administrator. This file is ignored by Git and does not create an account.

Both catalog and user lists paginate in SQL. See [page performance](docs/PERFORMANCE.md)
for query budgets, cancellation, caching, index setup and scaling considerations.

Email verification follows `EMAIL_VERIFICATION_ENABLED`. The example enables it,
and this workspace's local environment is enabled. With console email, new signups
follow the verification link printed by Django; with SMTP they receive text and HTML mail.
Existing accounts retain access. Use `createsuperuser` to
bootstrap the first administrator, then manage users at `/admin/users`.

`POST /api/v1/auth/login` returns an access token and user, and sets an HttpOnly
refresh cookie. Authentication POST requests require CSRF protection. Application
endpoints accept `Authorization: Bearer <token>` and deny unauthenticated requests
by default. See [authentication setup and API contract](docs/AUTHENTICATION.md) for
SMTP, migrations, session behavior, roles, throttling, and deployment configuration.

## CSV Import

The management command validates the complete file inside a transaction and
uses the CSV `id` as the stable product identifier. Re-importing a file updates
existing products rather than duplicating them.

## Running Tests

```powershell
Set-Location backend
pytest
```

## Code Quality

```powershell
Set-Location backend
ruff check .
ruff format --check .

Set-Location ../frontend
npm run lint
npm run typecheck
npm run build
```

## Design Decisions

The project deliberately uses Django and Next.js conventions instead of generic
repositories, CQRS, or global frontend state. See `docs/DECISIONS.md` for the
trade-offs behind each meaningful choice.

## Assumptions

- Products are digital and have no inventory limit.
- Each purchase creates one order for one product.
- Prices use two decimal places and a single unspecified settlement currency.
- Product IDs in the source CSV are stable external identifiers.
- The prompt did not include product rows, so `data/items.csv` contains representative
  fictional assessment data matching the required schema and locations.

## Trade-offs

- Access tokens stay in memory; rotating refresh tokens use HttpOnly cookies with
  CSRF protection. Deployment assumes HTTPS and a frontend/API on the same site.
- Email delivery is synchronous with a bounded timeout. Failed deliveries can be
  retried through the resend/recovery forms.
- Local development runs only PostgreSQL in Docker; application processes run on
  the host for faster feedback.

## Future Improvements

- Add an asynchronous email queue for higher-volume delivery.
- Add CI for backend tests, Ruff, frontend linting, type checks, and builds.
- Add deployment-specific security headers, observability, and secret management.
