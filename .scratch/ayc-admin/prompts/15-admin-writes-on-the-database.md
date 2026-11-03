# Executer prompt — 15 Admin writes on the database

Ticket: `.scratch/ayc-admin/issues/15-admin-writes-on-the-database.md` · Blocked by: 14 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Every Admin read and write runs on Postgres:
- settings, Staff and Invites, and denied sign-ins
- Products and their photo records
- Reviews and FAQs
- Exam pages, the promo banner and the announcement

Each write and its Staff Activity record go in one transaction. The conflict check compares the stamp saved in the row, and deletes cascade.

Every Stage A Admin behaviour suite passes against both arms. From this ticket, e2e runs on the local database, and the reset route re-seeds it. The route refuses any database that isn't local.

CONTEXT
- Already on docs/ayc-v1-planning:
  - the Admin seam contract with its sample arm (src/services/admin.ts and src/services/mock/admin/*.ts)
  - the suites src/services/admin.*.test.ts, written with describe.each(ADMIN_ARMS)
  - the catalogue tables and database arm (ticket 14)
- New tables:
  - staff: email unique and lowercased; name; Staff Role owner | editor; status active | invited; invited_at; expires_at; last_signed_in_at
  - denied_sign_ins: email, at, reason
  - staff_activity: actor_email, actor_name, entity, entity_id, action, before jsonb, after jsonb, at
  - updated_at and updated_by on every editable table, which become the conflict stamp
  - All have RLS on with no policies, and the deny-all test must pass.
- The conflict check is optimistic: `UPDATE … WHERE id = $1 AND updated_at = $expected`. Zero rows means the record changed (return conflict, with who saved it and when) or is gone (return not-found).
- Single toggles skip the stamp check, as in Stage A.
- Transactions: the role check, validation, the write, Staff Activity, then returning the tags. A failure anywhere rolls back everything.
- Deletes match Stage A's preview counts: Product → Reviews and photos, with the FAQ quotes from those Reviews cleared; Review → FAQ quotes cleared.
- The local seed adds the sample staff from CONVENTIONS §5, so "Sign in as" still works in development against the database. `--production` never adds staff.
- The reset route on the database arm:
  - truncates and re-seeds, then clears every catalogue tag
  - refuses unless DATABASE_URL's host is localhost or 127.0.0.1
  - stays 404 outside development
- The Playwright webServer sets DATABASE_URL to the local database from now on, and the admin specs reset through the route as before. Identity stays on the sample arm until ticket 16.

SCOPE
Create:
- the new tables and their migration
- src/services/admin.db.ts, implementing every area, organised the way the sample arm is
- the database-arm entries in ADMIN_ARMS
- tests for the transaction and rollback behaviour

Modify:
- src/services/admin.ts (the selector)
- the reset route (the database arm, with the local-only guard)
- scripts/catalogue-seed.ts (the sample staff, local only)
- playwright.config.ts (DATABASE_URL)
- the README

Leave untouched: what the Admin suites assert. Only the arms list grows.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 14 (the catalogue tables, catalogue.db.ts, catalogue:seed) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/15-admin-writes-on-the-database.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 decisions (Seams: Admin, Staff Activity, Conflict check, Deleting, Invites); Testing Decisions (Admin seam)
   - .scratch/ayc-admin/CONVENTIONS.md §3 (the Admin seam write contract)
   - src/services/admin.ts, src/services/mock/admin/*.ts and every src/services/admin.*.test.ts
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, supabase, supabase-postgres-best-practices, drizzle-data.
4. Add the tables and the migration. Apply them with db:reset, and run the deny-all test.
5. Implement admin.db.ts area by area. After each area, add the database arm to that suite and make it pass unchanged.
6. TDD the rollback: force a failure after the write but before Staff Activity (for example a constraint), and assert there is no row change and no Staff Activity row.
7. Add the reset route's database arm with the local-only guard, and switch Playwright to the database. Make the Website and admin projects pass.
8. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- Every src/services/admin.*.test.ts passes on both arms, with the same assertions.
- An Owner's Settings save writes the row and one staff_activity row in the same transaction, and the Website shows the change.
- Deleting a Product with Reviews removes them and clears their FAQ quotes, matching the preview counts.
- The e2e (Website and admin projects) passes with DATABASE_URL on the local database.
- "Sign in as" works against the database in development, with the sample staff seeded locally.
Sad paths (each one needs a test):
- Conflict on the database arm: two updates with the same expected stamp, where the second returns conflict with the first's savedBy and savedAt.
- Updating a row deleted by another session returns not-found, not conflict.
- A forced failure mid-write leaves no change and no Staff Activity row.
- Inviting an email that differs only in case from an existing Staff email is refused as a field error, not a crash.
- The reset route refuses when DATABASE_URL's host isn't local, even in development, and answers 404 in production.
- An Editor calling an Owner-only area on the database arm is refused, with nothing written.

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

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. mockup deviations (with the BUILD-MAP or mockup line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
