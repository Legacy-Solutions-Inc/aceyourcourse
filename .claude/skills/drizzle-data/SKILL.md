---
name: drizzle-data
description: Use when working on the data layer — the service seam (src/services/*), Drizzle schema/migrations, the DB client, DATABASE_URL, or wiring a service from mock to a real Postgres query.
---

# Drizzle data layer (this repo)

## 1. When to use

Any data-layer work: adding/altering the Drizzle schema, generating migrations,
the DB client, `DATABASE_URL`, or implementing a service behind the seam. The
seam contract itself (signatures, "reads=RSC/writes=Server Actions") lives in
[`AGENTS.md`](../../../AGENTS.md) and ADR 0003 — this skill covers the Drizzle
implementation behind it.

## 2. Version

- `drizzle-orm` **0.45.2**, `drizzle-kit` **0.31.10** (devDep), `postgres`
  (postgres.js) **3.4.9**, `dotenv` **17.4.2** (devDep, for `drizzle.config.ts`),
  `server-only` **0.0.1** (from `package.json` / installed).

## 3. Core standards

**Drizzle lives BEHIND the service seam.** Screens and Server Actions call
`src/services/*`; the service picks the implementation. Never import Drizzle or
`getDb()` from a component or action directly.

**Mock is the default.** With no `DATABASE_URL`, the seam resolves to the
in-memory mock, so the app runs, tests, and builds with **no database**. Setting
`DATABASE_URL` flips the same seam to the Drizzle-backed impl. This is the
mock-first contract (ADR 0003) extended by ADR 0006.

**`prepare: false` on the Supabase pooler.** The postgres.js client MUST pass
`{ prepare: false }` — the Supabase **transaction pooler** (port 6543) does not
support prepared statements. Use the transaction-pooler connection string.

**Lazy client — no connection at import/build.** Build the client inside
`getDb()` on first use, never at module eval, so `next build` never opens a
socket. `getDb()` throws a clear error if `DATABASE_URL` is unset.

**`DATABASE_URL` is a server-only secret.** It is validated ONLY in
`src/env.server.ts` (top-of-file `import "server-only"`). Never `NEXT_PUBLIC`,
never referenced from `src/env.ts`, `src/config.ts`, or any client module.

**Schema & migrations.** Define tables with `pgTable`/`pgEnum`; derive row types
with `$inferSelect` / `$inferInsert`. `pnpm db:generate` diffs the schema to SQL
under `./drizzle/` **offline** (no DB); `pnpm db:migrate` and `pnpm db:studio`
require a live `DATABASE_URL`. Keep a **pure** row→domain mapper so it's unit
-testable without a DB.

**Two migration sources, aligned.** Drizzle owns `./drizzle/` (app data);
Supabase owns `supabase/migrations/` (tenancy + RLS). Where objects overlap, keep
names identical (the `customer_status` enum, the `created_at` column). The Drizzle
schema is **single-tenant** (no `organization_id`) — tenancy is a separate,
blocked track.

> **KNOWN GAP:** the live query path (`db:migrate`, real reads/writes, RLS) is
> **unverified** — no Postgres/Supabase database has been available. Only the
> offline migration generation and the mock-default app/build are verified.

## 4. In this template

- `src/lib/db/schema.ts` — `pgEnum("customer_status", …)` + single-tenant
  `pgTable("customers", …)` (`status` default `pending`, `created_at` timestamptz);
  exports `CustomerRow` / `NewCustomerRow`.
- `src/lib/db/client.ts` — `import "server-only"`; lazy `getDb()` singleton;
  `postgres(url, { prepare: false })` → `drizzle(client, { schema })`; throws if
  `DATABASE_URL` unset.
- `src/env.server.ts` — `import "server-only"`; zod-validated optional
  `DATABASE_URL`; exports `serverEnv` and `isDatabaseConfigured`.
- `src/services/customers.ts` — thin selector: `isDatabaseConfigured ? dbImpl :
mockImpl`, typed against a `CustomersService` contract so both impls stay in
  signature.
- `src/services/customers.mock.ts` — the default in-memory implementation.
- `src/services/customers.db.ts` — `import "server-only"`; Drizzle impl + the
  pure exported `rowToCustomer(row)` mapper (Date → ISO, enum → `CustomerStatus`).
- `drizzle.config.ts` — `import "dotenv/config"`; `schema`, `out: ./drizzle`,
  `dialect: postgresql`, `schemaFilter: ["public"]`, and a placeholder
  `dbCredentials.url` fallback so `db:generate` runs offline.
- `package.json` — `db:generate` / `db:migrate` / `db:studio` (Supabase's
  `db:reset` / `db:types` are separate).
- `docs/adr/0006-drizzle-data-layer.md` — the decision and posture (read-only).

Future tenancy authz postures: see [`references/drizzle-rls.md`](references/drizzle-rls.md)
(reference-only — not active in this single-tenant round).

## 5. Red flags

- Referencing `DATABASE_URL` from the client, `src/env.ts`, or `src/config.ts` —
  it is server-only.
- Opening a DB connection at import/module-eval time (must be lazy via `getDb()`).
- Omitting `{ prepare: false }` on the postgres.js client with the transaction
  pooler.
- Calling Drizzle / `getDb()` from a component or Server Action instead of the
  seam.
- Treating the live query path as verified — it is the stated KNOWN GAP.
- Adding `organization_id` / tenancy to the Drizzle schema (single-tenant now;
  tenancy is a blocked, separate track).
- Letting the Drizzle and Supabase migrations drift on shared object names.

## 6. Sources

- Drizzle overview — https://orm.drizzle.team/docs/overview
- Get started: PostgreSQL — https://orm.drizzle.team/docs/get-started/postgresql-new
- Connect to Supabase (`prepare: false`) — https://orm.drizzle.team/docs/connect-supabase
- Row-Level Security — https://orm.drizzle.team/docs/rls
- postgres.js driver — https://orm.drizzle.team/docs/get-started-postgresql
