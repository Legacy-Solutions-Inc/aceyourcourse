# Executer prompt — 19 Development password sign-in

Ticket: `.scratch/ayc-admin/issues/19-development-password-sign-in.md` · Blocked by: 16 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Supabase Auth engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Until go-live, Staff can sign in to the Admin on localhost with an email and a password. Production stays Google-only, enforced by our own code.
- The sign-in screen gets a "DEVELOPMENT ONLY" email and password box under "Continue with Google". It shows only under `pnpm dev`, in live mode, while Supabase says its Email provider is on.
- Signing in with it goes through the Staff Guard exactly as Google does.
- Outside `pnpm dev`, the Staff Guard counts a session only when Supabase records it as an OAuth sign-in. A password session counts as signed out there, even with a confirmed email.
- The runbook and the README say how to use it and how to end it at go-live.

CONTEXT
- Why: there's no Docker on the user's machine, and `pnpm dev` uses the one hosted Supabase project, which is also production. Google isn't set up yet. The user wants to sign in on localhost now, and to test Owner and Editor roles with plus-addresses (you+editor@gmail.com) without several Google accounts.
- The hosted project today has the Email provider on, sign-ups on, Confirm email on, and Google off. Sign-ups can't be closed for Email alone, because a first Google sign-in (the first Owner, every Invite) is a sign-up too. You never touch the hosted project: the user changes its settings through the runbook.
- The user creates the development Users by hand: Supabase dashboard → Authentication → Users → Add user → Create new user, with Auto Confirm User ticked. The app has no sign-up, no password reset and no script for this.
- Already on docs/ayc-v1-planning (ticket 16, commits ad64581 and 2c2e3b6):
  - src/lib/admin/mode.ts: computeAdminMode gives "live" | "sample" | "closed"
  - src/lib/admin/identity.ts:
    - attemptFromUser(user), which is pure: signed-out | unverified | verified
    - getSignInAttempt and getIdentity
    - googleEnabled(), which reads Supabase's public GET /auth/v1/settings
    - startGoogleSignIn and finishGoogleSignIn
    - endSession
  - src/lib/admin/guard.ts: continueSignIn() signs in through the Guard after a Supabase session exists. Staff get { status: "staff" }, anyone else is recorded and redirected to the 403 screen, and an unverified email gets { status: "unverified" } with the session ended. /auth/callback uses it.
  - src/lib/auth/session.ts: getSession() wraps supabase.auth.getUser()
  - src/app/admin/sign-in/page.tsx shows GoogleSignInForm in live mode and SignInAsPanel in sample mode. Its actions are in src/app/admin/sign-in/actions.ts, and its messages in src/lib/admin/sign-in-problem.ts.
  - src/app/admin/actions.ts: switchAccount ("Use another account" on the 403 screen) signs out, then goes to Google in live mode
  - e2e/server.ts and playwright.config.ts:
    - The webServer command is `pnpm dev`, so NODE_ENV is "development" in every e2e run, CI's included.
    - Locally, e2e runs on the in-memory sample data (the env is blanked).
    - CI's live run uses PLAYWRIGHT_* values for the runner's local Supabase.
  - e2e/admin/helpers.ts: in live mode the sample Users are confirmed password Users (ensurePasswordUser, E2E_PASSWORD), and signInLive writes the session cookies directly. Keep that helper for the other specs.
  - e2e/admin/global-setup.ts seeds the runner's database and makes those Users.
  - supabase/config.toml (CI's local Supabase): [auth.email] enable_signup = true, enable_confirmations = false
  - Database tests (*.db.test.ts, `pnpm test:db`) read TEST_DATABASE_URL, TEST_SUPABASE_URL and TEST_SUPABASE_SECRET_KEY, and skip locally. They run in CI.
- @supabase/supabase-js 2.49.4, with auth-js 2.69.1. auth.getClaims() exists in this version.
- Before you code, follow the supabase skill: check https://supabase.com/changelog.md for auth breaking changes, and the current docs for signInWithPassword, getClaims, the JWT `amr` claim, and the auth error codes. From the docs:
  - Error codes: invalid_credentials, email_not_confirmed, email_provider_disabled, over_request_rate_limit (HTTP 429).
  - `amr` is an array of { method, timestamp }, with methods such as oauth, password, otp, magiclink, anonymous and token_refresh.
  - Confirm, citing the doc or the auth server source in your report:
    - a Google sign-in through PKCE carries method "oauth"
    - a refreshed access token keeps the session's original method
- The rule, fail closed:
  - Under `pnpm dev` (env.NODE_ENV === "development"), a session counts when its amr lists "oauth" or "password".
  - Anywhere else (production builds, Vercel previews, Vitest's "test"), only "oauth" counts.
  - Any other method, or an amr that's missing or unreadable, never counts. Such a session is treated as signed out (SignInAttempt "signed-out"): it's not recorded, and it's not a 403.
  - The amr comes from supabase.auth.getClaims(), which verifies the token. Never take it from getSession(), from decoding the cookie yourself, or from user_metadata.
  - Keep supabase.auth.getUser() for the User and its verified email, as now.
- The box shows only when all hold: adminMode === "live", env.NODE_ENV === "development", and Supabase's public auth settings say external.email === true.
  - Hidden when Supabase doesn't answer.
  - Read the settings once per render, in the same call that serves the Google check: generalise googleEnabled() into one reader of { google, email }.
  - Sample and closed modes never show it.
- The password sign-in Server Action:
  - It answers notFound() unless adminMode === "live" and env.NODE_ENV === "development", whatever is posted.
  - It validates with a zod schema in src/services/admin.schema.ts. An empty email gives "Enter your email". An empty password gives "Enter your password". A malformed email gives the existing typed-email message.
  - It calls signInWithPassword on the Supabase server client (src/lib/supabase/server.ts, with cookies), then continueSignIn(), exactly as /auth/callback does:
    - staff: redirect to safeAdminNext(next)
    - unverified: the unverified message
    - signed-out: "Sign-in didn't finish. Try again."
    - not Staff: continueSignIn's own 403 redirect
  - If continueSignIn can't see the new session in the same request, fix it so the Guard reads it. /auth/callback has the same pattern, so say what you found in the report.
  - Supabase errors map, by code, to these exact messages:
    - invalid_credentials: "That email and password don't match." (also for an unknown email; never say which was wrong)
    - over_request_rate_limit or HTTP 429: "Too many tries. Wait a minute and try again."
    - email_provider_disabled: "Password sign-in is off on this project."
    - email_not_confirmed: "This email isn't confirmed. Confirm the User in the Supabase dashboard, then try again."
    - unreachable or a network error: the existing "Sign-in isn't answering right now. Try again in a minute."
    - any other error: "Sign-in didn't finish. Try again."
  - It returns { error, fieldErrors, email } for useActionState. The typed email is kept, and the password is never sent back.
- The box (a client component next to google-sign-in-form.tsx, using useActionState as sign-in-as-panel.tsx does):
  - a labelled region "Development only"
  - a mono label "DEVELOPMENT ONLY" in the style of the screen's "ADMIN DASHBOARD" label
  - the line "Sign in with a password"
  - Email (type email, autocomplete email) and Password (type password, autocomplete current-password) fields, with visible labels
  - a "Sign in" button, disabled while pending
  - a hidden `next`
  - field errors shown next to their field (aria-describedby), and the form error in role="alert"
  - no "Forgot password" link and no sign-up link
  - It isn't in the mockup: keep it plainly separate from the mockup's screen, and say so in your report.
- "Use another account" (switchAccount): in live mode, when the box would show, it signs out and returns to paths.admin.signIn(), where both ways are offered. Otherwise it behaves as now.
- The runbook (docs/runbooks/production.md). Keep every existing step number, because other documents cite them.
  - After step 6, add "While you develop, before go-live":
    - create your password User (Add user → Create new user, Auto Confirm User ticked)
    - invite test Editors with plus-addresses from Settings → Staff & Invites, then create them the same way
    - keep Confirm email on (Authentication → Sign In / Providers → Email)
    - never click a "Confirm your signup" email you didn't ask for
    - steps 7 and 8 can wait until go-live
  - At the top of step 8, add "First: end development sign-in":
    1. remove the test Editors from Staff & Invites
    2. delete their Users (Authentication → Users)
    3. your own User stays, and your first Google sign-in attaches Google to it
    4. after 8.2 turns Email off, the box is gone on localhost
  - Add both to step 8's Check.
- The README's "Signing in locally" section lists the password box as the first live way. It also says Google needs runbook steps 7 and 8. The paragraph that says the hosted project has Email off becomes "until go-live, Email stays on for the development box; the runbook turns it off".

SCOPE
Create:
- src/components/admin/password-sign-in-form.tsx and its test
- a pure module for the method rule (for example src/lib/admin/sign-in-method.ts) and its test
- a CI-only database test for the refresh fact (for example src/lib/admin/sign-in-method.db.test.ts):
  1. create a confirmed password User with the secret key
  2. sign in with the password
  3. refreshSession
  4. getClaims: amr still lists "password"
  5. delete the User
Modify:
- src/lib/admin/identity.ts (the amr read, the settings reader, the sign-in function), its tests and identity.live.test.ts
- src/lib/admin/guard.ts only if continueSignIn needs it, plus guard.live.test.ts
- src/lib/admin/sign-in-problem.ts if a message belongs there
- src/app/admin/sign-in/page.tsx, actions.ts, and their tests (page.test.tsx, live.test.tsx, actions.test.ts)
- src/app/admin/actions.ts (switchAccount) and its test
- src/services/admin.schema.ts (the password sign-in schema) and its test
- e2e/admin/sign-in.spec.ts (live-only cases, and the box's absence in sample mode); e2e/admin/a11y.spec.ts if the live sign-in screen is checked there
- docs/runbooks/production.md and README.md, as above
Don't touch: the mockup, the spec, the ADRs, CONTEXT.md, supabase/config.toml (Email is already on locally), .env or .env.example (no new variables).

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 16 (live mode, continueSignIn, /auth/callback) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md (§1 mode, §3 Staff Guard and identity, including the ticket 19 rule)
   - the ticket, .scratch/ayc-admin/issues/19-development-password-sign-in.md: every checkbox is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md, Phase 2 → "Development password sign-in, until go-live", Environments, Staff access and Invites, plus story 51
   - the files in CONTEXT above
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, forms-validation, supabase-auth, supabase, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. Check the Supabase docs as CONTEXT says, and write down what you confirmed about "oauth" and refresh.
5. TDD the pure method rule: the dev, production and test environments × oauth, password, otp, token_refresh-only, an empty amr and a missing amr.
6. TDD identity: attemptFromUser stays pure and takes the session's methods, or a sibling function does. Make the live arm read amr through getClaims. Update the live tests' Supabase mocks.
7. TDD the action, the schema and the sad-path messages, with Supabase's client mocked at the server-client seam.
8. TDD the box and the page's show/hide matrix. Then switchAccount.
9. Write the live-only e2e cases and the CI database test. They can't run here, so make sure they skip cleanly locally.
10. Update the runbook and the README.
11. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- Under `pnpm dev` in live mode, with Supabase saying Email is on, the sign-in screen shows "Continue with Google" and, under it, the "Development only" box.
- (CI live e2e) The Owner signs in through the box with E2E_PASSWORD and lands on the Overview. With ?next=/admin/settings they land there.
- (CI live e2e) A confirmed password User whose email has a pending Invite signs in, and the Invite becomes active with its Staff Role.
- (CI live e2e) A confirmed password User who isn't Staff gets the 403 screen, and the attempt is recorded. "Use another account" returns to the sign-in screen with the box.
- In development, a session whose amr lists "password" or "oauth" counts. In production, one that lists "oauth" counts.
- (CI database test) A refreshed password session still reports "password".
Sad paths (each one needs a test):
- A production build, sample mode, Email off, or Supabase not answering: the box isn't rendered.
- Posting the action outside development, or outside live mode, answers 404, and Supabase is never called.
- Supabase errors show their messages, with the typed email kept and the password field empty:
  - invalid_credentials (a wrong password, or an unknown email): "That email and password don't match."
  - over_request_rate_limit or HTTP 429: "Too many tries. Wait a minute and try again."
  - email_provider_disabled: "Password sign-in is off on this project."
  - email_not_confirmed: the not-confirmed message
  - a network error: "Sign-in isn't answering right now. Try again in a minute."
- An empty email gives "Enter your email", and an empty password gives "Enter your password". Each shows next to its field, and Supabase isn't called.
- A next of `https://evil.example` or `//evil.example` lands on the Overview.
- A confirmed password session outside development counts as signed out: getIdentity is null, requireStaff redirects to sign-in, and nothing is recorded.
- A session with amr ["otp"], ["token_refresh"] only, [] or no amr counts as signed out in every environment.
- getClaims failing or returning an error counts as signed out, and doesn't crash.
- user_metadata claiming a provider or role changes nothing.
- (CI live e2e) A wrong password stays on sign-in with "That email and password don't match."
- Sample mode still shows "Sign in as" and no box (local e2e).

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked as the e2e server has them, so the build never reaches the hosted project.
- `pnpm test:coverage` (the thresholds in vitest.config.ts must still pass; don't lower them)
- `pnpm test:e2e` (the Website and Admin projects, on the in-memory sample data)
- `pnpm test:db`: show that the database suites, the new one included, skip locally because TEST_DATABASE_URL isn't set. They run in CI.
- CI can't run here. List which new tests run only there: the live e2e cases and the database test.
Follow verification-before-completion.
Repo gotchas:
- `pnpm build` breaks a dev server running on :3000. If :3000 answers 200, run e2e against it only if it runs in sample mode (otherwise ask the user), and run the build in a scratchpad copy: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in (Turbopack refuses a symlinked node_modules).
- Never kill the user's server.
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` for another vitest or playwright before a full run. Verify your own diff, and report the shared-tree results separately.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, and don't sign in to it. Don't change its auth settings, Users or data: that's the runbook, for the user. Don't run Docker or local Supabase on this machine.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/. Don't edit CONTEXT.md. docs/runbooks/ and README.md may be edited.
- Use the names in .scratch/ayc-admin/CONVENTIONS.md. If the code already differs, follow the code and say so in your report.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo beyond the mockup samples in CONVENTIONS §5. Test passwords live only in tests that run against a throwaway local Supabase (E2E_PASSWORD).
- No sign-up, no password reset, no "magic link", and no new env flag. Being under development is the only switch in our code, and Supabase's Email setting is the other.
- Every Admin page and Server Action calls the Staff Guard. Authorisation never comes from the client, from hidden fields, or from user metadata.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. what the Supabase docs or source confirmed about "oauth", refresh and getClaims (with links), whether continueSignIn saw the new session in the same request, decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
