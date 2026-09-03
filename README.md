# Game Store Technical Assessment

## Overview

Game Store is a monorepo containing a Django REST API and a Next.js client for
browsing and purchasing region-specific digital game items. PostgreSQL stores
the catalog, users, and immutable purchase receipts.

## Features

- CSV-backed product catalog for Jordan (`JO`) and Saudi Arabia (`SA`)
- JWT-authenticated REST API
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
```

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

### Create Demo User

```powershell
python backend/manage.py createsuperuser --username demo --email demo@example.com
```

Use the prompted password when signing in.

### Start Backend

```powershell
python backend/manage.py runserver
```

### Frontend Setup

```powershell
Set-Location frontend
npm install
```

### Start Frontend

```powershell
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

### Backend

| Variable | Purpose | Local default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Local Compose database |
| `DJANGO_SECRET_KEY` | Django/JWT signing secret | Unsafe example value |
| `DEBUG` | Django debug mode | `true` |
| `ALLOWED_HOSTS` | Comma-separated hosts | `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | Allowed browser origins | `http://localhost:3000` |

### Frontend

| Variable | Purpose | Local default |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Browser-visible API base URL | `http://localhost:8000/api/v1` |

## API Documentation

With the backend running, Swagger UI is available at `http://localhost:8000/api/docs/`
and the OpenAPI schema at `http://localhost:8000/api/schema/`.

## Authentication

Send credentials to `POST /api/v1/auth/login`. Use the returned access token as
`Authorization: Bearer <token>`. Application endpoints deny unauthenticated
requests by default.

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

- Access and refresh tokens are stored in browser `sessionStorage` for assessment
  simplicity. This remains accessible to JavaScript and therefore increases the
  impact of an XSS flaw compared with an HttpOnly cookie design.
- The API has no refresh-token rotation or revocation infrastructure.
- Local development runs only PostgreSQL in Docker; application processes run on
  the host for faster feedback.

## Future Improvements

- Use secure HttpOnly cookies and CSRF protection for a production browser client.
- Add CI for backend tests, Ruff, frontend linting, type checks, and builds.
- Add deployment-specific security headers, observability, and secret management.
