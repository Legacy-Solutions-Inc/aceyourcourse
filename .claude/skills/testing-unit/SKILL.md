---
name: testing-unit
description: Use when writing or changing unit/component tests — Vitest, React Testing Library, jsdom, coverage thresholds, or anything under vitest.config.ts / *.test.ts(x).
---

# Unit & component testing (this repo)

## 1. When to use

Writing or updating Vitest tests (`*.test.ts` / `*.test.tsx`), tuning
`vitest.config.ts`, or reasoning about coverage. For end-to-end/browser tests use
**testing-e2e**. TDD workflow and seam rules live in `AGENTS.md` and the global
`test-driven-development` skill — this covers the tooling.

## 2. Version

- `vitest` **3.2.7**, `@vitest/coverage-v8` **3.2.7**, `@testing-library/react`
  **16.3.2**, `@testing-library/jest-dom` **6.9.1**, `@testing-library/user-event`
  **14.6.1**, `jsdom` **26.1.0** (from `package.json` / installed).

## 3. Core standards

**Vitest runs in jsdom with globals on.** `describe/it/expect` are global;
`@testing-library/jest-dom` matchers (`toBeInTheDocument`, …) load from the setup
file.

**Test behavior through the public surface, not internals.** For pure logic and
the service seam, assert inputs→outputs. For components, use React Testing
Library: `render` + `screen`, and prefer **accessible queries**
(`getByRole` with a `name`, then `getByLabelText`/`getByText`) over test ids or
DOM structure. Query types: `getBy` (must exist), `queryBy` (may be absent),
`findBy` (async). Use **`@testing-library/user-event`** for interactions rather
than `fireEvent`.

**Coverage: v8 provider, with a ratchet.** `pnpm test:coverage` runs
`vitest run --coverage`. Thresholds (`lines`/`functions`/`branches`/`statements`,
including **per-glob** thresholds) sit just BELOW the measured baseline so a
regression fails CI — raise tests, don't lower thresholds. Some code is
deliberately **excluded**: vendored `src/components/ui/**`, generated
`database.types.ts`, and the **offline-unverifiable Drizzle DB layer**
(`src/lib/db/client.ts`, and Phase 2's `*.db.ts` seam arms) — its query bodies
need a live Postgres, so they're checked by the database tests instead; pure row
mappers are tested separately.

**Database tests** are `*.db.test.ts`, in the `db` project (node env). They
connect through `src/lib/db/test-database.ts` with `TEST_DATABASE_URL` (never
`DATABASE_URL`) and skip with the reason when it's unset or unreachable, so
`pnpm test` needs no Docker. See **drizzle-data**.

## 4. In this template

- `vitest.config.ts` — two `projects`: `unit` (`environment: "jsdom"`,
  `setupFiles: ["./vitest.setup.ts"]`, every test but `*.db.test.ts`) and `db`
  (node, `*.db.test.ts`); `globals: true`, the `@` alias, a `server-only` test alias,
  and the `coverage` block (v8; `text`+`lcov`; `include: src/**`; excludes above;
  global + `src/lib/**` + `src/services/**` thresholds).
- `vitest.setup.ts` — `import "@testing-library/jest-dom/vitest";`.
- `test/stubs/server-only.ts` — empty stub the config aliases `server-only` to, so
  server modules (e.g. `src/env.server.ts`) can be imported under Vitest.
- Example tests to copy:
  - Pure units — `src/lib/csp.test.ts`, `src/lib/seo.test.ts`,
    `src/lib/session-routes.test.ts`.
  - Seam (mock path) — `src/services/catalogue.test.ts`.
  - Seed validation — `src/services/catalogue.schema.test.ts`.
  - Component (RTL) — `src/components/website/product-card.test.tsx`.
  - Pure row mapper and env-driven seam selection — the template's Customers
    tests in git history at commit `aea34ea` (list them with
    `git ls-tree -r --name-only aea34ea | grep -i customer`).
- Scripts: `test` (`vitest run`, both projects), `test:db` (`vitest run --project
db`), `test:coverage`, `test:watch`.

## 5. Red flags

- `getByTestId`/DOM-structure queries when a role/label query works.
- `fireEvent` for user interactions instead of `user-event`.
- Lowering a coverage threshold to go green instead of adding a test (breaks the
  ratchet).
- Un-excluding the DB layer or expecting DB-query coverage offline (documented
  excludes; no live DB).
- Testing private/internal functions instead of the seam or public component
  behavior.
- Forgetting the jsdom env / setup import (jest-dom matchers won't exist).

## 6. Sources

- Vitest guide — https://vitest.dev/guide/
- Vitest coverage — https://vitest.dev/guide/coverage
- React Testing Library — https://testing-library.com/docs/react-testing-library/intro
- Query priority — https://testing-library.com/docs/queries/about
- user-event — https://testing-library.com/docs/user-event/intro
- jest-dom matchers — https://github.com/testing-library/jest-dom
