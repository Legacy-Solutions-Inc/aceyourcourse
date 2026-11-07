# Executer prompt — 18 Production go-live

Ticket: `.scratch/ayc-admin/issues/18-production-go-live.md` · Blocked by: 16, 17 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Give the user everything they need to switch production on safely: a runbook, and the read-only checks it uses. The user runs every production step; you never touch production.
- The database: link, db push, the one-time seed, the first Owner.
- Google sign-in: the Google Auth Platform, the Supabase provider, the URLs, and Email off in hosted.
- The Vercel env vars, and a smoke checklist.
- `pnpm db:check`: a read-only health and deny-all check against any DATABASE_URL.
- `catalogue:seed --production --check`: a dry run.

CONTEXT
- Already on docs/ayc-v1-planning:
  - the whole Admin on the database
  - live Google sign-in
  - Storage
  - catalogue:seed --production, which refuses when data exists
  - staff:add-owner
- Production facts (spec, ADR 0012):
  - Vercel Pro and Supabase Pro, both in Singapore.
  - The hosted project's direct connection (db.<ref>.supabase.co:5432) is IPv6-only and failed with ENOTFOUND here.
  - Production uses the transaction pooler: postgres.<ref>@aws-…pooler.supabase.com:6543, with prepare:false, which src/lib/db/client.ts already sets.
  - Migrations: `supabase link --project-ref <ref>`, then `supabase db push`.
  - Keys: the publishable key (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) and the secret key (SUPABASE_SECRET_KEY, server-only, never NEXT_PUBLIC_).
- Google OAuth:
  - Google Auth Platform: branding; audience External and published; the openid, email and profile scopes; a Web client.
  - Authorised JavaScript origins: the site URL.
  - Authorised redirect URI: https://<ref>.supabase.co/auth/v1/callback.
  - Supabase: the Google provider with that client id and secret; Email provider off; the Site URL and redirect URLs including {site}/auth/callback.
  - Check the current Supabase and Google docs for the field names.
- The first Owner's email is given by the user at deployment. Never write it in the repo or the runbook; use <owner-email>.
- MEMBER_APP_LIVE stays unset (off).
- The spec's Further Notes list other launch items (PostHog key, site URL, Legal sign-off). Reference them rather than repeating them.

SCOPE
Create:
- docs/runbooks/production.md
- scripts/db-check.ts (`pnpm db:check`), with its logic in src/lib/db/check.ts and tests against local Supabase
- the --check dry-run flag on catalogue:seed --production
- a test that scans tracked files for secrets (sb_secret_, a postgres URL with a password, a Google client secret pattern)

Modify: the README (the environment table, and a link to the runbook), .env.example, and package.json.

Leave untouched: app behaviour.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if tickets 16 and 17 (live sign-in, staff:add-owner, the Storage arm) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/18-production-go-live.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Implementation Decisions → Architecture and Phase 2 (Environments, Keys, Migrations, Catalogue goes real, Staff access); Further Notes
   - docs/adr/0012-vercel-and-supabase-singapore.md
   - the README, .env.example, scripts/catalogue-seed.ts, scripts/staff-add-owner.ts and src/lib/db/client.ts
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, supabase, supabase-postgres-best-practices, drizzle-data, supabase-auth, devops-engineer.
4. TDD db:check's logic against local Supabase:
   - migrations applied compared with the local folder
   - deny-all per table
   - the bucket and its limits
   - catalogue counts
   - read-only, with every statement in a READ ONLY transaction
5. Add catalogue:seed --production --check, and test it on an empty and a seeded local database.
6. Write the secret-scan test.
7. Write the runbook, in order, with a check after each step:
   - link
   - check the Postgres version
   - db push
   - db:check
   - seed --check, then seed
   - staff:add-owner
   - Google setup
   - Supabase auth settings
   - Vercel env vars, marking which are secret
   - deploy
   - the smoke checklist
   - rollback notes
8. Dry-run the runbook's commands against local Supabase (substituting the local URL) to prove they work as written.
9. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- `pnpm db:check` against the local database reports the migrations applied, every table deny-all, the bucket's limits and the catalogue counts, and exits 0.
- `catalogue:seed --production --check` on an empty local database reports what it would insert, and writes nothing.
- The runbook's commands, run against local Supabase, work as written.
- The smoke checklist covers: the Owner signs in with Google; invite an Editor; an edit goes live; the Editor is refused Settings; a non-Staff account gets the 403 screen; the publishable key reads nothing through the REST API; photos load from Storage.
Sad paths (each one needs a test):
- db:check exits 1 and names the table when a table has RLS off or a policy for anon. Test it with a rolled-back fixture.
- `--check` against a seeded database reports "would refuse: catalogue data exists".
- Each script without DATABASE_URL exits 1 with a clear message, and never prints a connection string.
- The secret scan fails on a fixture string shaped like sb_secret_… in a tracked file. Prove it in the test with an in-memory sample, not a committed secret.

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
- Never connect to, push to, or seed the hosted project, and never change Google or Supabase dashboard settings. The user does that by following the runbook.
- Never write a real email address, ref, key or password into the runbook. Use placeholders like <ref>, <owner-email> and <password>.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. mockup deviations (with the BUILD-MAP or mockup line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
