# Testing Strategy

## Goals

Tests protect observable API behavior, database invariants, import atomicity, and
the complete user journey without testing Django or React internals.

## Backend Tests

### Authentication

Valid credentials return tokens, invalid credentials return 401, and protected
resources reject requests without a valid access token.

### Products

Tests cover product output and deterministic ordering.

### Pagination

Tests cover the default size, custom size, response metadata, and maximum cap.

### Filtering

Tests cover `JO`, `SA`, and invalid location values.

### Product Details

Tests cover successful retrieval and 404 behavior.

### Purchase Flow

Tests verify authentication, ownership, persistence, 201 behavior, snapshot
values, and unknown-product validation.

### CSV Import

Tests cover valid import, idempotent re-import, invalid locations, invalid prices,
malformed rows, and rollback without partial writes.

## Frontend Tests

Static quality gates are TypeScript strict mode, ESLint, and the production Next.js
build. The highest-value future component tests are auth redirect, catalog states,
pagination/filter interactions, duplicate-purchase prevention, and receipt output.

## Integration Scenarios

The backend suite exercises API views against PostgreSQL through DRF's test client.
Manual integration covers login, authenticated listing, detail, purchase, persisted
receipt retrieval, and the Next.js redirect flow.

## Manual Verification Checklist

- Login succeeds and invalid credentials show a useful error.
- Protected pages redirect to login when no session exists.
- Product grid is usable at 375px and 1440px.
- Loading, empty, and API-error states are visible and readable.
- Location filtering resets pagination.
- Buy is disabled while a purchase is pending.
- Receipt values match the order snapshot.
- Swagger authorizes requests with an access token.

## Running Tests

```powershell
Set-Location backend
pytest
ruff check .
ruff format --check .

Set-Location ../frontend
npm run lint
npm run typecheck
npm run build
```
