# Executer prompt — 14 Catalogue on the database

Ticket: `.scratch/ayc-admin/issues/14-catalogue-on-the-database.md` · Blocked by: 12, 13 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
The Website reads the catalogue from Postgres.
- Drizzle tables for everything the Catalogue seam returns:
  - Exams and Subjects
  - Products, with their variations, photos and Listings
  - Reviews and FAQs
  - Exam page settings
  - Website settings, with the promo banner, the announcement and shop stats
- RLS is on for every table, with no policies.
- `pnpm catalogue:seed` loads the seed in one transaction. It runs on local `pnpm db:reset`. With `--production`, it refuses when data exists.
- The Catalogue seam's database arm is chosen when DATABASE_URL is set.
- The existing Catalogue behaviour suite passes against both arms, and no page changes.

CONTEXT
- Already on docs/ayc-v1-planning: the Stage A Admin (01–12) and the local Supabase foundation (13).
- The Catalogue seam's contract and types are in src/services/catalogue.ts and catalogue.types.ts, including getExamPage from ticket 09.
  - The mock arm reads the sample store.
  - The selector wraps reads with unstable_cache and the tags in catalogue.tags.ts.
- The prior art, from git history: `git show aea34ea:src/services/customers.db.ts`, plus customers.db.test.ts (pure mappers), customers.selector.test.ts and customers.rls.integration.test.ts.
- Arm selection:
  - The Catalogue seam picks the database arm when isDatabaseConfigured.
  - The Admin seam and identity stay on the sample arm until tickets 15 and 16.
  - So in this ticket, Playwright must keep DATABASE_URL unset, since the Admin's e2e writes go to the sample store.
  - The database arm is proven by the Vitest suite against TEST_DATABASE_URL.
- The seed:
  - It is validated by validateCatalogueSeed, then inserted in one transaction.
  - Photos keep their /products/... paths until ticket 17 moves them into Storage.
  - db:reset becomes `supabase db reset && pnpm catalogue:seed`, with DATABASE_URL pointed at the local database. Read it from `supabase status`, or from a documented local default.
- The schema:
  - money in integer centavos
  - ordered children with an order column
  - unique slugs, Exam codes, and Subject codes per Exam
  - cascades: Product → variations, photos, Listings and Reviews; Review → FAQ quote set to null
  - `.enableRLS()` on every table
  - the deny-all test must pass over the new tables
- The connection: postgres.js with prepare:false (it must work behind the transaction pooler in production) and a connect timeout, so an unreachable database fails fast.
- The suite refactor: catalogue.test.ts edits the seed through a seamWith helper. Turn it into a contract suite run over ARMS = [sample, database], with a per-arm loadSeed(seed). The database arm runs only when TEST_DATABASE_URL is reachable.

SCOPE
Create:
- src/lib/db/schema.ts (the catalogue tables).
- The generated migration in supabase/migrations.
- src/services/catalogue.db.ts, with its pure row mappers and their tests.
- src/services/catalogue.selector.test.ts.
- scripts/catalogue-seed.ts (`pnpm catalogue:seed`, with --production), with its testable logic in src/lib/catalogue-seed/ and tests.

Modify:
- src/services/catalogue.ts (the selector)
- src/services/catalogue.test.ts (run over both arms)
- package.json (db:reset and catalogue:seed)
- src/lib/db/client.ts (the timeout), if needed
- the README

Leave untouched: the Admin seam (ticket 15), identity (ticket 16), uploads (ticket 17), and every page.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if tickets 12 and 13 (Stage A complete; supabase/migrations, test:db and the deny-all test) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/14-catalogue-on-the-database.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 decisions (Catalogue goes real, Seams: Catalogue, Migrations); Testing Decisions → Seam 1
   - docs/adr/0006-drizzle-data-layer.md
   - the Customers prior art from git history at aea34ea, named in CONTEXT
   - src/services/catalogue*.ts, src/services/mock/catalogue.ts and src/services/catalogue.test.ts
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, supabase, supabase-postgres-best-practices, drizzle-data.
4. Design the schema from catalogue.types.ts and the Exam page record. Generate the migration, apply it with db:reset, and run the deny-all test.
5. TDD the pure row mappers (rows → seam types) with no database.
6. TDD catalogue:seed's logic:
   - validation before writing
   - one transaction
   - counts
   - --production refusing a non-empty database
7. Implement catalogue.db.ts. Refactor catalogue.test.ts into a contract suite over both arms, and make it pass on the database arm.
8. Add an equivalence test: every Website query from both arms, over the seed, deep-equals.
9. Switch the selector, add the selector test, and document db:reset and catalogue:seed in the README.
10. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- `pnpm db:reset` applies the migrations and seeds. catalogue:seed prints the counts of Exams, Subjects, Products (Live and Coming Soon), Reviews and FAQs.
- The whole Catalogue behaviour suite passes on both arms, and the equivalence test deep-equals every Website query.
- With DATABASE_URL pointed at the local database, `pnpm dev` serves every Website page from Postgres, looking exactly as before.
- The deny-all test passes over every new table.
- The selector test: DATABASE_URL set → the database arm; unset → the mock arm.
Sad paths (each one needs a test):
- An invalid seed (for example a Coming Soon Product with a price) is refused before any write, with the validation message.
- `catalogue:seed --production` on a database that already has a Product refuses, writes nothing, and exits 1.
- An unknown slug or code returns null (not found) on the database arm.
- An unreachable DATABASE_URL makes a read fail fast with a clear error, not a hang. Prove it with a test and a short timeout.
- catalogue:seed never prints DATABASE_URL, including in its error output.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage` (the thresholds in vitest.config.ts must still pass; don't lower them)
- `pnpm test:e2e` (the Website and admin projects)
- `supabase start` (Docker running), then `pnpm db:reset` and `pnpm test:db`; show the database test summary (passed and skipped).
- Also run `pnpm dev` with the local DATABASE_URL on a free port, and check /, /products, /exams/ce and /faq answer 200.
All must pass. Follow verification-before-completion.
Repo gotchas:
- `pnpm build` breaks a dev server running on :3000. If :3000 answers 200, run e2e against it (PLAYWRIGHT_PORT=3000), and run the build in a scratchpad copy: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in (Turbopack refuses a symlinked node_modules).
- Never kill the user's server.
- Another executer may share the working tree. Verify your own diff, and report the shared-tree results separately.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/. Don't edit CONTEXT.md unless this prompt says so.
- Use the names in .scratch/ayc-admin/CONVENTIONS.md. If the code already differs (an earlier ticket chose otherwise), follow the code and say so in your report.
- Add no dependency unless this prompt names it. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo beyond the mockup samples in CONVENTIONS §5.
- Every Admin page and Server Action calls the Staff Guard. Authorisation never comes from the client, from hidden fields, or from user metadata.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. mockup deviations (with the BUILD-MAP or mockup line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
