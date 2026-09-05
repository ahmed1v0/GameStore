# Testing Strategy

Verification tests cover both settings: immediate signup/login, pending-account
access and refresh, retained exemptions, disabled-account rejection, and password recovery.
UI tests cover hidden verification actions and configuration errors.

## Goals

Tests protect observable API behavior, database invariants, import atomicity, and
the complete user journey without testing Django or React internals.

## Backend Tests

`test_performance.py` asserts SQL pagination and bounded query counts for list,
detail, receipt and identity reads, including real JWT authentication. The frontend
pagination tests verify server page/search requests, cancellation and cached revisits.

### Authentication

Tests cover verified signup, validation and database email uniqueness, expiry/replay
of email tokens, generic recovery acknowledgments, CSRF rejection, cookie flags,
refresh rotation, password/session invalidation, deactivation/reactivation, role
authorization, superuser/self-protection, audit records, throttles and email failures.
PostgreSQL concurrency tests exercise signup, refresh and competing admin demotions.
Migration tests verify existing-account exemptions and duplicate-email failure safety.

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

Vitest and Testing Library cover session restoration, one shared refresh, browser-lock
usage, logout races, failed logout, request cancellation, stale identity responses,
cache isolation, purchase non-retry on network failure, role loss, auth forms, and
admin route guards. Resend verification is tested for initial signup/login, successful
signup, unverified login, missing/expired links, successful verification, and the
resend page itself. TypeScript, ESLint and the production Next.js build also run.

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
- Signup shows resend only after account creation succeeds.
- Unverified login shows resend next to its error, while incorrect credentials do not.
- Verification and recovery links show invalid/expired states and a way to request another.
- Reload restores the cookie session and sign-out clears the account across tabs.
- Admin user search, role/status controls and self-protection render correctly.

## Running Tests

```powershell
Set-Location backend
pytest
ruff check .
ruff format --check .

Set-Location ../frontend
npm test
npm run lint
npm run typecheck
npm run build
```
