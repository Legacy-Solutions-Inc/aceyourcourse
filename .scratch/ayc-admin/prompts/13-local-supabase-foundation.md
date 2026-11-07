# Executer prompt — 13 Local Supabase foundation

Ticket: `.scratch/ayc-admin/issues/13-local-supabase-foundation.md` · Blocked by: — (by choice after 12) · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Get local Supabase ready for development and CI, and get the repo ready for database tables.
- Rename NEXT_PUBLIC_SUPABASE_ANON_KEY to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY everywhere, with no fallback. Add a server-only SUPABASE_SECRET_KEY.
- drizzle-kit writes migrations into supabase/migrations with Supabase prefixes. Remove the drizzle/ folder and db:migrate.
- Local Postgres matches the hosted major version.
- A deny-all database test proves the browser roles can't touch any table, and guards every future table.
- Database tests skip cleanly without local Supabase. CI starts it.

CONTEXT
- This is Stage B's first ticket (CONVENTIONS §1). No tables exist yet; tickets 14–15 add them.
- Today:
  - src/env.ts validates NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
  - src/config.ts reads them (isSupabaseConfigured, config.supabase.anonKey).
  - src/env.server.ts has DATABASE_URL and isDatabaseConfigured.
  - src/lib/db/client.ts is a lazy getDb() with postgres.js (prepare:false); src/lib/db/schema.ts is empty.
  - playwright.config.ts and .github/workflows/ci.yml pass placeholder Supabase values.
  - supabase/config.toml has [db] major_version = 15 and no migrations folder.
  - package.json has db:reset (supabase db reset), db:types, db:generate, db:migrate and db:studio.
  - The Supabase CLI is 2.104.0. Docker may not be running: ask the user to start Docker Desktop if `supabase start` fails for that reason.
- Supabase's current keys:
  - publishable keys (sb_publishable_…) replace the legacy anon key
  - secret keys (sb_secret_…) replace service_role, and are server-only
  - `supabase status` prints the local ones
  - Check the current Supabase docs and changelog before relying on any CLI flag (the supabase skill says how).
- drizzle-kit can write into supabase/migrations with Supabase timestamp prefixes (migrations.prefix "supabase"). Verify this against the installed drizzle-kit.
- In Supabase, new tables in public get default grants for anon and authenticated. The first migration revokes those defaults (ALTER DEFAULT PRIVILEGES … REVOKE). Every later table also enables RLS with no policies (spec Phase 2: Access is checked on the server).
- The database test convention:
  - TEST_DATABASE_URL, never DATABASE_URL, so unit tests never switch the app's arm.
  - Skip with a clear reason when it's unset or unreachable.
  - The Customers RLS integration test in git history (`git show aea34ea:src/services/customers.rls.integration.test.ts`) shows the skip pattern.
- The user's .env holds real hosted values. Never read it aloud or print it.
- Under the local-and-production decision, .env holds LOCAL values from now on:
  - DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
  - the local API URL, publishable key and secret key, from `supabase status`
  - The hosted values go only into Vercel (ticket 18).
  - Today, .env's DATABASE_URL points at the hosted project. From ticket 14 the app would use it, so it must change before then.
- Tell the user exactly what to change in .env: the rename, and the local values. Don't edit .env yourself.

SCOPE
Create:
- The first migration in supabase/migrations: revoke the default privileges on public from anon and authenticated.
- src/lib/db/deny-all.db.test.ts.
- src/lib/db/test-database.ts, the TEST_DATABASE_URL helper that skips when unreachable.
- A vitest config, or a project, for the database tests: `pnpm test:db`, node environment, `*.db.test.ts`.

Modify:
- src/env.ts, src/config.ts, src/lib/supabase/* and the middleware or CSP, if they reference the key.
- src/env.server.ts: SUPABASE_SECRET_KEY, optional.
- drizzle.config.ts.
- package.json scripts: db:start, db:stop, db:reset, db:generate and test:db; remove db:migrate.
- supabase/config.toml: major_version, set to the user's answer.
- playwright.config.ts, .github/workflows/ci.yml, .env.example, the README, and every test referencing the old name.

Delete: the drizzle/ folder, if it exists, and the db:migrate script.

Leave untouched: the seams. No tables in this ticket.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 12 (Stage A complete; by the user's choice, Stage B starts after it) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/13-local-supabase-foundation.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Implementation Decisions → Architecture (server-checked access), Phase 2 (Environments, Access is checked on the server, Keys, Migrations); Testing Decisions → Permission and deny-all tests
   - docs/adr/0006-drizzle-data-layer.md and docs/adr/0012-vercel-and-supabase-singapore.md
   - src/env.ts, src/env.server.ts, src/config.ts, src/lib/db/*, src/lib/supabase/*, drizzle.config.ts, supabase/config.toml, playwright.config.ts, .github/workflows/ci.yml and .env.example
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, supabase, supabase-postgres-best-practices, drizzle-data.
4. Ask the user for the hosted project's Postgres major version (Dashboard → Settings → Infrastructure), and wait for the answer. Set it in supabase/config.toml.
5. Rename the key (TDD the env schema change), then add a test that greps the tracked files for NEXT_PUBLIC_SUPABASE_ANON_KEY and fails on any hit.
6. Add SUPABASE_SECRET_KEY to the server env only, with a test that src/env.ts doesn't declare it.
7. Point drizzle-kit at supabase/migrations with Supabase prefixes, remove drizzle/ and db:migrate, and add the scripts.
8. Write the revoke migration and the deny-all test. Prove the test can fail: in the test itself, create a temp-schema fixture table with RLS off, and with a policy for anon, in a transaction that is rolled back.
9. Update CI:
   - install the Supabase CLI with the official setup action
   - `supabase start`, excluding the services it doesn't need
   - export TEST_DATABASE_URL
   - run `pnpm test:db`
   - rename the key
10. Update the README and .env.example: Docker, db:start, the local keys from `supabase status`, and the rename the user must make in their own .env.
11. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- `pnpm db:start` then `pnpm db:reset` applies the revoke migration cleanly, and `pnpm test:db` passes the deny-all test.
- `pnpm db:generate` writes a timestamped file into supabase/migrations, with no drizzle/ folder.
- The app builds and runs with NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. No tracked file mentions the old name.
- `pnpm test` passes with no database running, and the database tests are reported as skipped with the reason.
- CI runs the database tests against a started local Supabase.
Sad paths (each one needs a test):
- With TEST_DATABASE_URL unset or unreachable, the database tests skip and don't fail.
- The deny-all check fails on a fixture table with RLS off, with a policy for anon, or with a grant to authenticated. The failure names the table.
- An invalid publishable key value (an empty string is treated as unset; "x" is accepted only as a non-empty string) follows the env schema's rules. A malformed URL fails fast.
- Importing src/env.server.ts from client code fails the build (server-only), and SUPABASE_SECRET_KEY is never NEXT_PUBLIC_.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage` (the thresholds in vitest.config.ts must still pass; don't lower them)
- `pnpm test:e2e` (the Website and admin projects)
- `supabase start` (Docker running), then `pnpm db:reset` and `pnpm test:db`; show the database test summary (passed and skipped).
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
- Never print the contents of .env, or any key or connection string, and never commit a local key in a tracked file other than the well-known local defaults the Supabase CLI documents.
- Don't connect to the hosted project.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. mockup deviations (with the BUILD-MAP or mockup line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
