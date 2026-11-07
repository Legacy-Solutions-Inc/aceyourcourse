# 14 — Catalogue on the database

**What to build:** The Website can read the catalogue from Postgres.

- **Tables.** Drizzle tables hold everything the Catalogue seam returns:
  - Exams and Subjects
  - Products, with their variations, photos and Listings
  - Reviews and FAQs
  - Exam page settings
  - Website settings, with the promo banner, the announcement and shop stats

  Every table has RLS on with no policies.

- **Seeding.** `pnpm catalogue:seed` loads the Phase 1 seed in one transaction. It runs on every local `pnpm db:reset`. With `--production`, it refuses if any catalogue data exists.
- **The database arm.** The Catalogue seam's database arm is chosen when `DATABASE_URL` is set. The existing Catalogue behaviour suite passes against both arms, and the pages don't change.

**Blocked by:** 12 — Admin-wide checks on the prototype, 13 — Local Supabase foundation

**Status:** ready-for-agent

Spec: Implementation Decisions → Phase 2 (Catalogue goes real, Seams: Catalogue, Migrations); Testing Decisions → Seam 1 and the Admin seam (both arms). Prior art: Customers in git history at `aea34ea` (`customers.db.ts`, its mapper test, its selector test, the RLS integration test). Conventions: §3 (Catalogue seam), §6.

- [ ] **The schema** covers every field in `catalogue.types.ts` and the Exam page settings from ticket 09:
  - money in integer centavos
  - ordered children with an order column
  - foreign keys with the right cascades: Product → variations, photos, Listings and Reviews; a Review → FAQ quotes are set to null
  - unique slugs, Exam codes and Subject codes per Exam
  - `enableRLS()` on every table

  The generated migration applies cleanly with `pnpm db:reset`, and the deny-all test passes over the new tables.

- [ ] **`pnpm catalogue:seed`** validates the seed with `validateCatalogueSeed`, then inserts everything in one transaction.
  - It reports counts.
  - With `--production`, it refuses when any catalogue row exists, and it never deletes.
  - It never prints `DATABASE_URL`.
  - `pnpm db:reset` becomes `supabase db reset && pnpm catalogue:seed`.
- [ ] **The database arm** (`catalogue.db.ts`) implements the whole contract with Drizzle. Pure row mappers turn rows into the seam types and have their own tests.
- [ ] **The selector** chooses the database arm when `DATABASE_URL` is set and the mock arm otherwise, and has a selector test. The Admin seam and identity stay on the sample arm until tickets 15 and 16.
- [ ] **Caching and tags** work the same on both arms.
- [ ] **One behaviour suite, two arms.** The Catalogue suite runs over both arms. The seed-editing helper loads an edited seed into each arm. The database run skips when `TEST_DATABASE_URL` is unset.
- [ ] **Equivalence.** A test reads every Website query from both arms over the same seed and deep-equals the results.
- [ ] **Playwright keeps the sample arm** for now (`DATABASE_URL` unset), because Admin writes still go to the sample store. That is noted in the README.
- [ ] **Sad paths:**
  - the seed refuses invalid seed data before writing
  - `--production` refuses a non-empty database and changes nothing
  - an unknown slug or code returns not-found on the database arm
  - the database arm with an unreachable database throws a clear error, not a hang. The connection uses a timeout.
