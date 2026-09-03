# Architectural Decisions

## ADR-001 — Django REST Framework

### Context

The application needs authenticated, validated, documented REST endpoints.

### Decision

Use Django REST Framework serializers, generic views, permissions, and pagination.

### Reason

They solve the required HTTP concerns with familiar Django conventions.

### Alternatives Considered

Plain Django JSON views and Django Ninja.

### Trade-offs

DRF adds a dependency but removes repetitive request and error-handling code.

## ADR-002 — PostgreSQL instead of SQLite

### Context

Persistent storage needs enforceable constraints and a reproducible shared engine.

### Decision

Use PostgreSQL 17 through Docker Compose and `DATABASE_URL`.

### Reason

It matches the assignment and supports the same constraints expected in deployment.

### Alternatives Considered

SQLite for a lower setup cost.

### Trade-offs

Local development requires Docker Desktop.

## ADR-003 — Monorepo structure

### Context

Backend, frontend, data, and documentation evolve together.

### Decision

Keep them in one repository with explicit top-level directories.

### Reason

One change can update a contract, client, test, and documentation coherently.

### Alternatives Considered

Separate repositories.

### Trade-offs

Tooling remains independently configured in each module.

## ADR-004 — Django management command for CSV import

### Context

Catalog data must be validated, transactional, and repeatably imported.

### Decision

Implement `import_items` as a Django management command.

### Reason

It reuses configured models, transactions, validation, and operator output.

### Alternatives Considered

A standalone script or upload API.

### Trade-offs

Import is an operator workflow rather than an end-user feature.

## ADR-005 — Product snapshot fields on Order

### Context

Receipts must remain historically accurate after product edits.

### Decision

Copy title, unit price, and location into each order.

### Reason

Receipt reads no longer depend on mutable catalog values.

### Alternatives Considered

Read current product values or version the complete product model.

### Trade-offs

Snapshot fields duplicate a small amount of data intentionally.

## ADR-006 — Page-number pagination

### Context

The user-facing catalog needs direct previous/next navigation and bounded responses.

### Decision

Use page-number pagination with a default of 12 and maximum of 48.

### Reason

It is simple for the required UI and supported directly by DRF.

### Alternatives Considered

Cursor and limit/offset pagination.

### Trade-offs

Page boundaries may shift while products are inserted, which is acceptable here.

## ADR-007 — JWT authentication

### Context

The independent browser client must authenticate API requests.

### Decision

Issue SimpleJWT access and refresh tokens from `/api/v1/auth/login`.

### Reason

It satisfies the stateless token requirement and integrates with DRF.

### Alternatives Considered

Django sessions and opaque API tokens.

### Trade-offs

Browser token storage requires careful XSS risk management.

## ADR-008 — No payment gateway or inventory management

### Context

Products are digital and the assignment defines purchase as order creation.

### Decision

Do not implement payment, stock, carts, or reservation.

### Reason

Those systems introduce rules and failure modes outside the stated objective.

### Alternatives Considered

Mock payment or stock fields.

### Trade-offs

The purchase flow demonstrates persistence, not financial settlement.

## ADR-009 — Direct Django ORM usage instead of Repository Pattern

### Context

Django ORM already abstracts persistence and provides test support.

### Decision

Use querysets directly in views, commands, and the purchase function.

### Reason

A repository wrapper would duplicate the ORM without enabling another requirement.

### Alternatives Considered

Per-model and generic repositories.

### Trade-offs

Application code remains intentionally coupled to Django ORM.

## ADR-010 — Limited service layer only for purchase workflow

### Context

Purchase creation includes ownership and immutable commercial snapshots.

### Decision

Keep one keyword-only `purchase_product` function in `orders.services`.

### Reason

It gives the meaningful operation a testable home without service-layer ceremony.

### Alternatives Considered

Put all logic in the serializer or introduce service interfaces for every app.

### Trade-offs

Simple catalog reads continue to live in conventional DRF views.
