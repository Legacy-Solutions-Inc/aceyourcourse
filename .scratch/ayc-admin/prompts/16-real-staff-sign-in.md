# Executer prompt — 16 Real Staff sign-in

Ticket: `.scratch/ayc-admin/issues/16-real-staff-sign-in.md` · Blocked by: 15 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Revised 2026-11-04: there's no Docker on the user's machine, and `pnpm dev` uses the hosted Supabase project.

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Staff sign in with Google through Supabase.
- computeAdminMode gains "live", for when the database and Supabase are both configured.
- In live mode:
  - "Continue with Google" runs the Supabase OAuth flow (PKCE) through /auth/callback.
  - The Guard reads the verified email, then checks the staff list.
  - The "Sign in as" list is gone.
- `pnpm staff:add-owner <email>` adds the first Owner.
- Tests never touch the hosted Supabase project.
  - On the user's machine, with no Docker, e2e runs every journey on the in-memory sample data.
  - In CI, a throwaway local Supabase on GitHub's runner also runs the Admin journeys in live mode. They sign in with password Users created with that runner's secret key.
  - The app gets no test route.

CONTEXT
- READ FIRST: the environment changed (planner, 2026-11-04). It supersedes "local Supabase for development and every test" wherever the spec, CONVENTIONS or earlier tickets say it.
  - There's no Docker on the user's machine. One hosted Supabase project serves the user's `pnpm dev` and production, and .env points at it: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, the publishable key and SUPABASE_SECRET_KEY.
  - Nothing you run may touch the hosted project: no test, script, seed, e2e run, build, reset route or query.
    - Never set TEST_DATABASE_URL or PLAYWRIGHT_DATABASE_URL to it.
    - Never run docker, `supabase start`, `pnpm db:start`, `pnpm db:reset`, `pnpm db:check` or `pnpm catalogue:seed` on this machine.
    - Read .env only for variable names, and for whether a URL's host is local. Never read or print its values.
  - With that .env, `pnpm dev` runs live: development, a database that isn't local, and Supabase. Staff sign in with real Google on the hosted project.
    - The user turns on the Google provider there, adds the redirect URLs and runs staff:add-owner, from the runbook. You don't.
  - The hosted project's redirect allow list needs `http://localhost:3000/**` while the user develops against it. Add that to the runbook's URL-configuration step, with a note.
  - Locally, DATABASE_URL must be the Session pooler (IPv4, from Dashboard → Connect).
    - The direct connection (db.<ref>.supabase.co) is IPv6-only, and this machine can't reach it.
    - Vercel keeps the transaction pooler on port 6543, as the runbook says.
    - Say this in the README's environment table and in an .env.example comment.
- Also changed since this prompt was first written:
  - Tickets 17 (photo storage) and 18 (production go-live) landed before this one. The commit labelled ticket 16 (40a3615) holds only test cleanup left over from ticket 15. None of this ticket's code exists yet.
  - src/lib/admin/mode.ts has only "sample" | "closed", with `database: "none" | "local" | "elsewhere"`. The rule after this ticket:
    - live: a database (local or elsewhere) and Supabase are both configured, in any environment
    - sample: development or test, the database is none or local, and they aren't both configured
    - closed: production without both, or development with a database that isn't local and no Supabase (as today). "Sign in as" must never reach a database off this machine.
  - playwright.config.ts forces the e2e server's DATABASE_URL to the local database, and takes NEXT_PUBLIC_SUPABASE_* from the shell or a fallback. Next also loads .env for any variable the process doesn't set. Change it so:
    - By default (the user's machine), the e2e server runs in sample mode on the in-memory store. It gets no DATABASE_URL, no Supabase URL or keys, and no secret key.
    - Prove the e2e server never gets .env's hosted values. For example, set them to empty and confirm the env schemas treat empty as unset, or use another way you can test.
    - With PLAYWRIGHT_DATABASE_URL and PLAYWRIGHT_SUPABASE_URL / _PUBLISHABLE_KEY / _SECRET_KEY set (CI), the e2e server runs live against that local Supabase.
    - It fails fast if any of them names a host that isn't local.
  - CI (.github/workflows/ci.yml) sets placeholder Supabase values (https://placeholder.supabase.co). Under the live rule, a placeholder must never turn the e2e live. In CI:
    - Start gotrue and kong in `supabase start`, plus storage-api if the photo journeys need it in live mode. Keep every other service off.
    - Export the local URL and keys from `supabase status -o env` as the PLAYWRIGHT_* variables for the e2e step only, with the secret masked (::add-mask::).
    - Keep the placeholders for the unit-test step.
  - POST /api/dev/sample-data/reset re-seeds only a local database, and answers 404 when the Admin is closed.
    - In live mode on a local database (CI), it keeps working for e2e, behind the Staff Guard.
    - It still answers 404 in production and for any database that isn't local.
  - docs/runbooks/production.md (ticket 18) carries "⚠ Ticket 16" notes: the note at the top, step 6, and the first two smoke checks in step 11.
    - Remove them, and make step 6 match the real command and what it prints.
    - Editing docs/runbooks/ is allowed.
  - These tests must stay green:
    - src/env-names.test.ts fails when the app reads a variable that .env.example, the README's environment table or the runbook's Vercel step doesn't list.
    - src/repo-secrets.test.ts fails on a committed secret.

    The Google client id and secret appear only as env() references in supabase/config.toml, and as names with empty values in .env.example.
  - `pnpm db:check` (ticket 18) reports the staff counts. What staff:add-owner prints must agree with it.
- Signing in on the user's machine after this ticket. The README documents both ways:
  - (a) Live, on the hosted project, once the user has done runbook steps 6–8: the first Owner, Google, and the redirect URLs including localhost.
  - (b) Sample mode in memory: comment out DATABASE_URL and the Supabase lines in .env, and "Sign in as" comes back. Say what that means for photo uploads.
- Already on docs/ayc-v1-planning:
  - the Staff Guard, with its sample identity arm (src/lib/admin/identity.ts, guard.ts)
  - resolveSignIn and the staff tables on the database (ticket 15)
  - src/app/auth/callback (the OAuth code exchange from the template)
  - src/lib/supabase/{client,server,middleware}.ts
- The middleware refreshes the session for /admin only in live mode. Public pages still make no Supabase call.
- Authorisation:
  - Decide from supabase.auth.getUser() (verified with the server), never getSession(), and never user_metadata.
  - The email must be verified. For Google that is the identity's email_verified, or user.email_confirmed_at.
  - The display name comes from the Google profile, for display only.
- Sign-in:
  - signInWithOAuth({ provider: "google", options: { redirectTo: `${site}/auth/callback?next=…`, queryParams: { prompt: "select_account" } } })
  - Sanitise next with safe-next (ticket 01).
  - "Use another account" signs out first.
  - When Supabase answers that the Google provider isn't enabled, show "Google sign-in isn't set up on this server".
- Local auth config (supabase/config.toml), used by CI's runner, and by anyone who runs local Supabase later:
  - [auth.external.google] enabled = true, client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)", secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)". It must start in CI with those unset. Check this.
  - the local redirect URLs
  - email/password enabled, for test Users only
  - The hosted project is configured in its dashboard, with Google only and Email off (the runbook). Check the field names against the current Supabase docs.
- e2e sign-in in live mode (CI only):
  - A Playwright global setup creates the sample staff as auth Users on the runner's local Supabase, using the secret key (the admin API).
  - A helper signs in with the password grant, and writes the @supabase/ssr session cookie into the browser context in the format the server client reads.
  - In sample mode, the existing "Sign in as" helpers stay.
  - No app route is added for tests.
- staff:add-owner:
  - creates or upgrades an active Owner entry for the email
  - idempotent
  - Staff Activity with the actor "deployment"
  - refuses without DATABASE_URL
  - never prints secrets
  - The user runs it against the hosted project. Their email is typed at the terminal and never goes in the repo.
  - Test its logic with unit tests, plus a database test that skips locally and runs in CI.

SCOPE
Create:
- the Supabase arm in src/lib/admin/identity.ts
- the sign-in screen's live mode, and the "Use another account" flow
- scripts/staff-add-owner.ts (`pnpm staff:add-owner`), with its logic tested in src/lib/admin/
- e2e/admin/global-setup.ts (auth Users, live mode only), and the password sign-in helper in e2e/admin/helpers.ts

Modify:
- src/lib/admin/mode.ts (live)
- src/middleware.ts
- src/app/auth/callback (next sanitising, and errors)
- supabase/config.toml
- playwright.config.ts (in-memory sample mode by default; live only with local PLAYWRIGHT_* values)
- .github/workflows/ci.yml (e2e in live mode against the runner's local Supabase)
- src/app/api/dev/sample-data/reset (live mode on a local database)
- .env.example and the README
- docs/runbooks/production.md (remove the ticket 16 notes; step 6; localhost in the redirect URLs)

Leave untouched: the Guard's decisions (resolveSignIn). Only the identity source changes.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 15 (the staff tables and admin.db.ts) is missing on docs/ayc-v1-planning.
   - Don't run docker or any Supabase CLI command that starts or changes a database.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly, except where READ FIRST overrides them.
   - the ticket, .scratch/ayc-admin/issues/16-real-staff-sign-in.md: every checkbox in it is part of your acceptance criteria. The live-mode e2e checkboxes are met in CI.
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 stories 51–58; Phase 2 decisions (Staff access, Invites, Seams: Staff Guard, Environments)
   - docs/adr/0002-supabase-only-auth.md and docs/adr/0008-single-brand-members-and-staff.md
   - src/lib/admin/*, src/app/auth/callback, src/lib/supabase/*, supabase/config.toml, playwright.config.ts, e2e/admin/helpers.ts, .github/workflows/ci.yml and docs/runbooks/production.md
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, supabase, supabase-postgres-best-practices, drizzle-data, supabase-auth, secure-code-guardian.
4. TDD the mode rule in every case above, and the callback's next sanitising and error handling.
5. Implement the Supabase identity arm. TDD it with a mocked Supabase client: a verified Google email, an unverified email, no user, a role set in user_metadata, and the provider not enabled.
6. Wire the sign-in screen, the callback and the middleware for live mode. Keep sample mode intact.
7. Write staff:add-owner and its tests: a new email, an existing Editor, an existing Invite, running it again, an invalid email, and no DATABASE_URL.
8. Change playwright.config.ts as READ FIRST says, and test the env it builds:
   - with no PLAYWRIGHT_* set: sample mode, with no hosted values
   - with local PLAYWRIGHT_* values: live
   - with a host that isn't local: refused
9. Add the local auth config, the global setup and the password helper for live mode, and the CI changes.
10. Run every e2e journey locally on the in-memory sample data.
11. Update the README, .env.example and the runbook.
12. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- Locally, with no Docker, `pnpm test:e2e` passes every Website and Admin journey on the in-memory sample data, and the e2e server gets none of the hosted values.
- CI starts auth on the runner's local Supabase, creates the sample staff as password Users, and runs the Admin journeys in live mode. Signing in as the Owner lands on the Overview, and signing in as Kim's email activates the Invite.
  - This is verified when the user opens a PR. Show the workflow diff.
- In live mode (unit tests with a mocked client), a verified Staff email passes the Guard, and Kim's email activates the Invite, as in Stage A.
- "Use another account" signs out, then starts the sign-in again with account selection.
- staff:add-owner creates an active Owner, upgrades an Editor or an Invite, and changes nothing when run again. The database test skips locally and runs in CI.
- The runbook:
  - has no "⚠ Ticket 16" note left
  - step 6's check matches what `pnpm staff:add-owner` and `pnpm db:check` print
  - step 8 lists `http://localhost:3000/**` for development
- The README explains both ways to sign in locally (hosted live, or in-memory sample), and that DATABASE_URL must be the Session pooler locally.
- Manual, for the user to check: after runbook steps 6–8, `pnpm dev` and "Continue with Google" sign the Owner in on localhost. Document it; don't do it.
Sad paths (each one needs a test):
- The e2e config refuses a PLAYWRIGHT_DATABASE_URL or Supabase URL whose host isn't local. With no PLAYWRIGHT_* set, it passes no database, Supabase or secret-key value.
- Development with a database that isn't local and no Supabase stays "closed". A placeholder Supabase with no database stays "sample".
- In live mode, the reset route still answers 404 in production and for a database that isn't local.
- When the Google provider isn't enabled, "Continue with Google" shows "Google sign-in isn't set up on this server", with no crash.
- A User with an unverified email is denied, and recorded.
- The callback with no code, or a bad one, returns to sign-in with "Sign-in didn't finish. Try again."
- The sample cookie is ignored in live mode, and the Sign-in-as action refuses.
- A Staff User removed while signed in is denied on their next request.
- `staff:add-owner not-an-email` exits 1 with a message. Without DATABASE_URL it exits 1, and it never prints the connection string.
- Authorisation never reads user_metadata. A test sets a role in user_metadata, and it is ignored.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked as the e2e server has them, so the build never reaches the hosted project. If the build needs a database, stop and report.
- `pnpm test:coverage` (the thresholds in vitest.config.ts must still pass; don't lower them)
- `pnpm test:e2e` (the Website and Admin projects, on the in-memory sample data)
- `pnpm test:db`: show that the database suites skip locally because TEST_DATABASE_URL isn't set. They run in CI.
- CI can't run here. Show the workflow diff, and list what runs there: test:db, and the Admin e2e in live mode.
Follow verification-before-completion.
Repo gotchas:
- `pnpm build` breaks a dev server running on :3000. If :3000 answers 200, run e2e against it only if it runs in sample mode (otherwise ask the user), and run the build in a scratchpad copy: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in (Turbopack refuses a symlinked node_modules).
- Never kill the user's server.
- Another executer may share the working tree. Verify your own diff, and report the shared-tree results separately.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project. Don't change its auth settings or data: that is the runbook, for the user. Don't run Docker or local Supabase on this machine.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/. Don't edit CONTEXT.md unless this prompt says so. docs/runbooks/ may be edited.
- Use the names in .scratch/ayc-admin/CONVENTIONS.md. If the code already differs (an earlier ticket chose otherwise), follow the code and say so in your report.
- Add no dependency unless this prompt names it. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo beyond the mockup samples in CONVENTIONS §5.
- Every Admin page and Server Action calls the Staff Guard. Authorisation never comes from the client, from hidden fields, or from user metadata.
- Out-of-scope bugs go in the report, not in the diff.
- Never commit a Google client secret or a Supabase key. CI's local values come from `supabase status` at runtime.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅, ❌ or "CI only", with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. mockup deviations (with the BUILD-MAP or mockup line), decisions you had to make, and follow-ups
6. the steps the user must do on the hosted project before signing in on localhost
7. the line "Nothing committed or pushed."
```
