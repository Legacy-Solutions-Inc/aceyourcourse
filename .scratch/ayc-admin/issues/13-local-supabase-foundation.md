# 13 — Local Supabase foundation

**What to build:** Developers and CI run a local Supabase, and the repo is ready for database tables.

- **Keys.** `NEXT_PUBLIC_SUPABASE_ANON_KEY` becomes `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` everywhere, with no fallback. A server-only `SUPABASE_SECRET_KEY` is added.
- **Migrations.**
  - drizzle-kit writes migrations into `supabase/migrations` with Supabase timestamp prefixes.
  - The old `drizzle/` folder and `db:migrate` are removed.
  - Local Postgres matches the hosted major version.
- **The deny-all guard.** A database test proves the browser roles can't read or write any table, and it keeps guarding every table added later.
- **Skipping.** Database tests skip cleanly when local Supabase isn't running.
- **CI** starts local Supabase.

**Blocked by:** None — can start immediately. By choice it runs after 12, because Stage A comes first.

**Status:** ready-for-agent

Spec: Implementation Decisions → Architecture (one Supabase project, server-checked access) and Phase 2 (Environments, Access is checked on the server, Keys, Migrations); Testing Decisions → Permission and deny-all tests. Conventions: §1, §6, §7.

- [ ] **Before starting,** ask the user for the hosted project's Postgres major version (Dashboard → Settings → Infrastructure). Set `supabase/config.toml` `[db] major_version` to it.
- [ ] **The rename, with no fallback.** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` replaces the old name in:
  - `src/env.ts`, `src/config.ts` and the Supabase clients
  - the middleware and the CSP builder, if either references the key
  - the Playwright config and CI
  - `.env.example`, the README, and every test

  A leftover `NEXT_PUBLIC_SUPABASE_ANON_KEY` anywhere fails a test.

- [ ] **The secret key.** `SUPABASE_SECRET_KEY` is optional and server-only (`src/env.server.ts`). Nothing imported by client code can reach it, and a test proves `src/env.ts` doesn't declare it.
- [ ] **Migration generation.** `drizzle.config.ts` writes to `supabase/migrations` with `migrations.prefix: "supabase"`. `pnpm db:generate` produces a timestamped file that `supabase db reset` applies.
  - `drizzle/` and `db:migrate` are gone.
  - New scripts: `db:start`, `db:stop` and `db:reset`. In this ticket, `db:reset` is `supabase db reset`; ticket 14 adds the seed.
- [ ] **The first migration** revokes the default table, sequence and function privileges on `public` from `anon` and `authenticated`.
- [ ] **The deny-all test** (database) checks, for every table in `public`:
  - RLS is enabled
  - there are no policies for `anon` or `authenticated`
  - neither role has any grant

  It passes with zero tables today. A deliberately broken fixture migration in a temp schema proves the test can fail.

- [ ] **Running the database tests.** They use `TEST_DATABASE_URL`, never `DATABASE_URL`, and are skipped with a clear note when it's unset or unreachable.
  - `pnpm test` still runs everything else with no database.
  - `pnpm test:db` runs only the database tests.
- [ ] **CI:**
  - installs the Supabase CLI and runs `supabase start` (only the services it needs)
  - sets `TEST_DATABASE_URL` to the local database
  - runs the database tests
  - uses the publishable-key name
- [ ] **The README** explains:
  - installing Docker and starting it
  - `pnpm db:start`, and the local keys from `supabase status`
  - which env vars to rename in `.env` (the user does this themselves; never print `.env`)
- [ ] **Sad paths:**
  - the env schema rejects an invalid publishable key value
  - the database tests skip when no database is reachable
  - the deny-all test fails on a table with RLS off, a policy for `anon`, or a grant to `authenticated`
