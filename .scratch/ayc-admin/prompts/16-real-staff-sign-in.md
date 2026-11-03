# Executer prompt — 16 Real Staff sign-in

Ticket: `.scratch/ayc-admin/issues/16-real-staff-sign-in.md` · Blocked by: 15 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Staff sign in with Google through Supabase.
- computeAdminMode gains "live", for when the database and Supabase are configured.
- In live mode:
  - "Continue with Google" runs the Supabase OAuth flow (PKCE) through /auth/callback.
  - The Guard reads the verified email, then checks the staff list.
  - The "Sign in as" list is gone.
- `pnpm staff:add-owner <email>` adds the first Owner.
- e2e signs in with local password Users created with the local secret key. The app gets no test route.

CONTEXT
- Already on docs/ayc-v1-planning:
  - the Staff Guard, with its sample identity arm (src/lib/admin/identity.ts, guard.ts)
  - resolveSignIn and the staff tables on the database (ticket 15)
  - src/app/auth/callback (the OAuth code exchange from the template)
  - src/lib/supabase/{client,server,middleware}.ts
- The mode rule (CONVENTIONS §1):
  - live when the database and Supabase are both configured, in any environment
  - sample in development or test without them
  - closed in production without them
- The middleware refreshes the session for /admin only in live mode. Public pages still make no Supabase call.
- Authorisation:
  - Decide from supabase.auth.getUser() (verified with the server), never getSession(), and never user_metadata.
  - The email must be verified. For Google that is the identity's email_verified, or user.email_confirmed_at.
  - The display name comes from the Google profile, for display only.
- Sign-in:
  - signInWithOAuth({ provider: "google", options: { redirectTo: `${site}/auth/callback?next=…`, queryParams: { prompt: "select_account" } } })
  - Sanitise next with safe-next (ticket 01).
  - "Use another account" signs out first.
- Local config (supabase/config.toml applies to local only):
  - [auth.external.google] enabled = true, client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)", secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
  - the local redirect URLs
  - email/password enabled for test Users only
  - The hosted project is configured in its dashboard, with Google only and Email off (ticket 18's runbook). Check the field names against the current Supabase docs.
- e2e sign-in:
  - A Playwright global setup creates the sample staff as local auth Users with the local secret key (the admin API).
  - A helper signs in with the password grant against local Supabase, and writes the @supabase/ssr session cookie into the browser context in the format the server client reads.
  - No app route is added for tests.
- staff:add-owner:
  - creates or upgrades an active Owner entry for the email
  - idempotent
  - Staff Activity with the actor "deployment"
  - refuses without DATABASE_URL
  - never prints secrets
  - The first production Owner's email is given at deployment and never goes in the repo.

SCOPE
Create:
- the Supabase arm in src/lib/admin/identity.ts
- the sign-in screen's live mode, and the "Use another account" flow
- scripts/staff-add-owner.ts (`pnpm staff:add-owner`), with its logic tested in src/lib/admin/
- e2e/admin/global-setup.ts (local auth Users), and the password sign-in helper in e2e/admin/helpers.ts

Modify:
- src/lib/admin/mode.ts (live)
- src/middleware.ts
- src/app/auth/callback (next sanitising, and errors)
- supabase/config.toml
- playwright.config.ts (the local Supabase URL and keys from `supabase status`, read at runtime and never committed)
- .env.example and the README

Leave untouched: the Guard's decisions (resolveSignIn). Only the identity source changes.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 15 (the staff tables and admin.db.ts) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/16-real-staff-sign-in.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 stories 51–58; Phase 2 decisions (Staff access, Invites, Seams: Staff Guard, Environments)
   - docs/adr/0002-supabase-only-auth.md and docs/adr/0008-single-brand-members-and-staff.md
   - src/lib/admin/*, src/app/auth/callback, src/lib/supabase/* and supabase/config.toml
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, supabase, supabase-postgres-best-practices, drizzle-data, supabase-auth, secure-code-guardian.
4. TDD the mode rule in all four cases, and the callback's next sanitising and error handling.
5. Implement the Supabase identity arm. TDD it with a mocked Supabase client: a verified Google email, an unverified email, and no user.
6. Wire the sign-in screen, the callback and the middleware for live mode. Keep sample mode intact for development without the database.
7. Write staff:add-owner and its tests: a new email, an existing Editor, an existing Invite, an invalid email, and no DATABASE_URL.
8. Add the local auth config, the Playwright global setup and the password sign-in helper. Run every admin e2e journey in live mode.
9. Document local Google setup (optional for local; needed for production) in the README.
10. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- In live mode, signing in as the local Owner (via the password helper) lands on the Overview. Every Stage A Admin journey passes in live mode.
- Signing in as Kim's email activates the Invite, as in Stage A.
- "Use another account" signs out and starts the sign-in again with account selection.
- `pnpm staff:add-owner owner@example.com` creates an active Owner. Running it again changes nothing. Signing in as that email reaches Settings.
- With local Google credentials configured, "Continue with Google" redirects to Google's consent screen, for manual verification only.
Sad paths (each one needs a test):
- With Google not configured locally, "Continue with Google" shows "Google sign-in isn't set up on this server", with no crash.
- A User with an unverified email is denied, and recorded.
- The callback with no code, or a bad one, returns to sign-in with "Sign-in didn't finish. Try again."
- The sample cookie is ignored in live mode, and the Sign-in-as action refuses.
- A Staff User removed while signed in is denied on their next request.
- `staff:add-owner not-an-email` exits 1 with a message. Without DATABASE_URL it exits 1, and it never prints the connection string.
- Authorisation never reads user_metadata. A test sets a role in user_metadata, and it is ignored.

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
- Don't connect to the hosted project, and don't change its auth settings. That is ticket 18's runbook, for the user.
- Never commit a Google client secret or a Supabase key. Local values are read from `supabase status` or from env at runtime.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. mockup deviations (with the BUILD-MAP or mockup line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
