# Game Store Technical Assessment

## Overview

Game Store is a monorepo containing a Django REST API and a Next.js client for
browsing and purchasing region-specific digital game items. PostgreSQL stores
the catalog, users, normalized region/currency reference data, and immutable
purchase receipts.

## Features

- CSV-backed product catalog for Jordan (`JO`) and Saudi Arabia (`SA`)
- Normalized region and currency reference data (`JOD` / `SAR`)
- Currency-aware monetary precision using ISO minor units
- JWT-authenticated REST API
- Signup with optional email verification, password recovery, secure refresh cookies, and admin/user management
- Paginated and location-filtered product browsing
- Idempotent single-product purchase flow with immutable historical receipt snapshots
- Stable UUID transaction references for purchase receipts
- Generated OpenAPI schema and Swagger UI
- Responsive Next.js client

## Technology Stack

- Python 3.13, Django, Django REST Framework, SimpleJWT, drf-spectacular
- PostgreSQL 17, pytest, pytest-django, Ruff
- Next.js, React, TypeScript, Tailwind CSS, TanStack Query, Zod

## Architecture Overview

The backend follows Django application boundaries: `catalog` owns products,
regions, money validation, and CSV import, while `orders` owns purchases and
immutable receipts. Django ORM is used directly; only the purchase workflow has
a dedicated service function. The frontend keeps HTTP access in `src/lib/api`,
server state in TanStack Query, and route-specific UI in the App Router.

## Repository Structure

```text
backend/       Django API, applications, migrations, and tests
frontend/      Next.js application
data/          Importable product CSV
docs/          Architecture, decisions, and testing strategy
docker-compose.yml
```

## Prerequisites

- Python 3.13 or 3.14
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
git checkout idempotency-key
```

### Environment Configuration

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Git Bash:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

The checked-in examples contain local-only values. Change the Django secret in
any shared or deployed environment.

### Start PostgreSQL

```bash
docker compose up -d db
docker compose ps
```

Continue once the `db` service reports `healthy`.

### Backend Setup

Create the virtual environment from the repository root:

```bash
python -m venv .venv
```

#### PowerShell activation

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell reports that running scripts is disabled, either enable activation
for the current terminal only:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

or skip activation entirely and call the virtual environment Python directly:

```powershell
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -m pip install -e ".\backend[dev]"
```

`-Scope Process` affects only the current PowerShell session and does not
permanently change the machine execution policy.

#### Git Bash activation

From the repository root:

```bash
source .venv/Scripts/activate
```

From inside the `backend` directory:

```bash
source ../.venv/Scripts/activate
```

Git Bash uses `/` path separators. Do not use PowerShell paths such as
`.\.venv\Scripts\python.exe` inside Git Bash.

Install backend dependencies after activation:

```bash
python -m pip install -e "./backend[dev]"
```

If you prefer not to activate the environment, from the repository root you can
run:

```bash
./.venv/Scripts/python.exe -m pip install -e "./backend[dev]"
```

## Database Migrations

Migrations are committed to the repository. Normally you should **not** run
`makemigrations` just to start the project.

From the repository root:

```bash
python backend/manage.py showmigrations
python backend/manage.py migrate
python backend/manage.py check
```

From inside `backend`:

```bash
python manage.py showmigrations
python manage.py migrate
python manage.py check
```

Without activating the virtual environment, from the repository root:

PowerShell:

```powershell
.\.venv\Scripts\python.exe backend\manage.py showmigrations
.\.venv\Scripts\python.exe backend\manage.py migrate
.\.venv\Scripts\python.exe backend\manage.py check
```

Git Bash:

```bash
./.venv/Scripts/python.exe backend/manage.py showmigrations
./.venv/Scripts/python.exe backend/manage.py migrate
./.venv/Scripts/python.exe backend/manage.py check
```

To inspect only the order migrations:

```bash
python backend/manage.py showmigrations orders
```

The fintech changes include the catalog region/currency migrations and the
purchase receipt migration. Do not use `migrate --fake` unless you deliberately
know the database schema already matches the migration state.

## CSV Import

```bash
python backend/manage.py import_items data/items.csv
```

The importer validates the complete file before writing and performs a bulk
upsert using the CSV `id` as the stable product identifier. Re-importing updates
existing products rather than duplicating them.

## Seed Administrator

```bash
python backend/manage.py seed_admin --username admin --email admin@example.com --password P@ssw0rd
```

The command is idempotent and updates the administrator password if the account already exists.

## Start Backend

```bash
python backend/manage.py runserver
```

The API runs at `http://localhost:8000` by default.

## Frontend Setup

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`.

VS Code users can select the `Full Stack` launch target after PostgreSQL is
healthy and dependencies are installed. It starts both development servers with
debugging enabled.

## PostgreSQL Connection

Local Docker Compose uses the following defaults:

| Setting | Value |
| --- | --- |
| Host | `localhost` |
| Port | `5432` |
| Database | `assessment` |
| Username | `assessment` |
| Password | `assessment` |

Connection string:

```text
postgresql://assessment:assessment@localhost:5432/assessment
```

These values come from `docker-compose.yml` and `backend/.env.example`. Override
them with environment variables when needed.

### Access PostgreSQL from the terminal

Confirm the database container is running:

```bash
docker compose ps
```

Open `psql` inside the PostgreSQL container:

```bash
docker compose exec db psql -U assessment -d assessment
```

Useful `psql` commands:

```text
\dt
\d catalog_product
\d catalog_region
\d orders_order
\q
```

Example queries:

```sql
SELECT * FROM catalog_region;
SELECT * FROM catalog_product ORDER BY id;
SELECT * FROM orders_order ORDER BY created_at DESC;
```

To inspect the fintech receipt snapshot fields:

```sql
SELECT
    id,
    reference,
    product_title,
    unit_price,
    currency_code,
    currency_minor_unit,
    product_location,
    product_location_name,
    created_at
FROM orders_order
ORDER BY created_at DESC;
```

### Access PostgreSQL with a GUI

DBeaver, DataGrip, pgAdmin, or another PostgreSQL client can connect using:

```text
Host: localhost
Port: 5432
Database: assessment
Username: assessment
Password: assessment
```

DBeaver is a convenient option when inspecting tables, foreign keys, indexes,
constraints, and query plans during the assessment.

## Environment Variables

### Backend

| Variable | Purpose | Local default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://assessment:assessment@localhost:5432/assessment` |
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

Email verification follows `EMAIL_VERIFICATION_ENABLED`. The example enables it.
With console email, new signups follow the verification link printed by Django;
with SMTP they receive text and HTML mail. Existing accounts retain access. Use
`createsuperuser` or `seed_admin` to bootstrap the first administrator, then
manage users at `/admin/users`.

`POST /api/v1/auth/login` returns an access token and user, and sets an HttpOnly
refresh cookie. Authentication POST requests require CSRF protection. Application
endpoints accept `Authorization: Bearer <token>` and deny unauthenticated requests
by default. See [authentication setup and API contract](docs/AUTHENTICATION.md) for
SMTP, migrations, session behavior, roles, throttling, and deployment configuration.

## Purchase Idempotency and Fintech Data Integrity

`POST /api/v1/orders` requires a UUID `Idempotency-Key`. Retrying the same purchase
with the same key returns the original receipt rather than creating a duplicate
order. Reusing the same key for a different product is rejected.

Receipts keep immutable snapshots of customer-visible commercial data, including
product title, unit price, market, currency, currency minor unit, and a stable UUID
transaction reference. Historical receipts therefore do not change when catalog
or reference data is later edited.

Money is represented using decimal values on the backend and exact minor-unit
arithmetic on the frontend. JOD supports three fractional digits and SAR supports
two. Mixed-currency cart totals are kept separate rather than being added together.

See [purchase idempotency](docs/PURCHASE_IDEMPOTENCY.md) for implementation details.

## Running Tests

Backend:

```bash
cd backend
pytest
```

Frontend:

```bash
cd frontend
npm test
```

## Code Quality

Backend:

```bash
cd backend
ruff check .
ruff format --check .
```

Frontend:

```bash
cd frontend
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
- Each purchase intent creates one order for one product.
- Product IDs in the source CSV are stable external identifiers.
- Supported local markets are currently Jordan and Saudi Arabia.
- JOD uses three fractional digits; SAR uses two.
- The cart is a client-side saved selection, not a payment settlement or reservation system.
- The prompt did not include product rows, so `data/items.csv` contains representative
  fictional assessment data matching the required schema and locations.

## Trade-offs

- Access tokens stay in memory; rotating refresh tokens use HttpOnly cookies with
  CSRF protection. Deployment assumes HTTPS and a frontend/API on the same site.
- Email delivery is synchronous with a bounded timeout. Failed deliveries can be
  retried through the resend/recovery forms.
- Local development runs only PostgreSQL in Docker; application processes run on
  the host for faster feedback.
- Currency metadata is modeled explicitly so price validation and receipts remain
  deterministic without introducing a full payments or FX subsystem.

## Future Improvements

- Add an asynchronous email queue for higher-volume delivery.
- Add CI for backend tests, Ruff, frontend linting, type checks, and builds.
- Add deployment-specific security headers, observability, and secret management.
