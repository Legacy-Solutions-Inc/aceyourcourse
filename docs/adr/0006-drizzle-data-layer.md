# 6. Drizzle as the typed data layer behind the seam

Date: 2026-07-31

## Status

Accepted

## Context

The Service Seam (ADR 0003) routes all app data through `src/services/*` and
promises that "become real" is a one-file change per service: swap the mock body
for real queries, signatures unchanged. We now need the real implementation for
the Customers seam. It must:

- keep the seam's public signatures identical, so screens (RSC) and Server
  Actions never change;
- keep the app **mock-by-default** — it still runs, type-checks, and builds with
  no database configured (ADR 0003's "runs with zero backend");
- be typed end to end and share enum/column names with the existing Postgres
  schema in `supabase/migrations/` where they overlap, so the two never diverge;
- open no database connection at import or build time.

Supabase already owns authentication (ADR 0002) and, on the multi-tenancy track,
row-level security and storage (ADR 0005). What was missing was a typed query
builder and a migration workflow for application data.

## Decision

Adopt **Drizzle ORM** as the typed data layer that lives **behind** the service
seam. Supabase keeps auth, RLS, and storage; Drizzle owns typed reads/writes and
migrations for app data.

- **Driver:** `postgres` (postgres.js) with `prepare: false`, which is required
  by the Supabase transaction pooler (port 6543). The client
  (`src/lib/db/client.ts`) is a **lazy singleton** — the connection is built on
  first `getDb()` call, never at module eval, so `next build` needs no database.
- **Server-only secret:** `DATABASE_URL` is validated apart from the public env
  in `src/env.server.ts` (marked `import "server-only"`), exactly as `src/env.ts`
  anticipated when it said to split server and client schemas once a server
  secret appears. It is never `NEXT_PUBLIC` and never referenced from client code.
- **Mock-by-default:** `src/services/customers.ts` is a thin selector — it
  resolves to the Drizzle-backed impl (`customers.db.ts`) when
  `isDatabaseConfigured`, otherwise to the in-memory mock (`customers.mock.ts`).
  With no `DATABASE_URL`, the mock is the default and the app runs backend-free.
- **Schema scope:** the Drizzle schema (`src/lib/db/schema.ts`) is
  **single-tenant** — a `customers` table with no `organization_id`. It reuses
  the `customer_status` enum and the `created_at` column name from
  `supabase/migrations/20260715132833_init_multitenancy.sql` on the ground they
  share. Migrations are generated to `./drizzle/` and are separate from
  `supabase/migrations/` (owned by the blocked multi-tenancy track).
- **Intended authz posture (future tenancy track):** when org scoping lands, the
  authorization boundary is enforced **in the seam** — every query is scoped by
  the caller's active organization — with Postgres **RLS as defense-in-depth**
  (ADR 0005). The seam scopes; RLS guarantees that a bug or a forged cookie in
  the seam can never cross tenants.

## Consequences

- The Customers seam has a real, typed database implementation while the app
  still runs and builds with no backend — ADR 0003's contract holds.
- There are now two migration sources: Drizzle (`./drizzle/`, app data) and
  Supabase (`supabase/migrations/`, tenancy + RLS). They must stay aligned on
  shared objects; this ADR fixes the shared names as the contract.
- Adopting an ORM adds dependencies (`drizzle-orm`, `postgres`, `drizzle-kit`)
  and a migration workflow (`db:generate` / `db:migrate` / `db:studio`).
- This round is install + migration generation only. The live query path
  (`db:migrate`, real reads/writes, RLS interaction) is unverified until a
  Postgres/Supabase database is available.
