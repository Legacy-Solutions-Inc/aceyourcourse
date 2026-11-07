# 15 — Admin writes on the database

**What to build:** Every Admin read and write runs on Postgres. That covers:

- settings, Staff and Invites, and denied sign-ins
- Products and their photo records
- Reviews and FAQs
- Exam pages, the promo banner and the announcement

**How each write works:**

- Each write and its Staff Activity record go in **one transaction**.
- The conflict check compares the saved stamp held in the row.
- Deletes cascade, using the counts the dialogs show.

**Tests and e2e:**

- Every Stage A Admin behaviour suite passes against both arms.
- From this ticket, e2e runs against the local database. The reset route re-seeds the local database, and it refuses any database that isn't local.

**Blocked by:** 14 — Catalogue on the database

**Status:** ready-for-agent

Spec: Implementation Decisions → Phase 2 (Seams: Admin, Staff Activity, Conflict check, Deleting, Invites); Testing Decisions → Admin seam, Seam 5 (Admin). Conventions: §3 (Admin seam), §6.

- [ ] **The schema** adds:
  - `staff`: a unique lowercased email, name, Staff Role, status (active or invited), invited at, expires at, last signed in
  - `denied_sign_ins`
  - `staff_activity`: actor email and name, entity, entity id, action, `before` and `after` as jsonb, and a timestamp
  - `updated_at` and `updated_by` on every editable table

  Every table has RLS on and no policies, and the deny-all test passes.

- [ ] **The database arm** (`admin.db.ts`) implements every area in the Admin seam contract. Each write runs in one transaction: role check, validation, conflict check, write, Staff Activity, then returning the tags.
  - **The conflict check** is optimistic: the update only applies where `updated_at` still equals the expected stamp. Otherwise it returns `conflict`, with who saved it and when.
- [ ] **Every Admin suite runs over both arms** (`describe.each(ADMIN_ARMS)`) and passes, unchanged in what it asserts.
- [ ] **Atomic failures.** A write that fails partway (forced in a test) leaves no row change and no Staff Activity row.
- [ ] **Delete cascades** match the counts shown: Product → Reviews and photos, with the FAQ quotes from those Reviews cleared; Review → FAQ quotes cleared. Staff Activity keeps the values from before.
- [ ] **Sample staff.**
  - The local seed adds the sample staff (CONVENTIONS §5), so "Sign in as" keeps working in development against the local database.
  - `catalogue:seed --production` never adds staff.
- [ ] **The reset route.** `POST /api/dev/sample-data/reset` truncates and re-seeds on the database arm, then clears every tag.
  - It refuses unless `DATABASE_URL` points at `localhost` or `127.0.0.1`.
  - It stays 404 outside development.
- [ ] **e2e on the database.** Playwright sets `DATABASE_URL` to the local database, and runs `pnpm db:reset` or the reset route before the run. The Website and Admin projects both pass on the database arm.
- [ ] **Sad paths**, all tested on the database arm:
  - a conflict
  - not-found after a concurrent delete
  - an Editor forbidden from Owner-only areas
  - a unique-email violation on invite, surfacing as a field error rather than a crash
  - the reset route refusing a non-local URL
