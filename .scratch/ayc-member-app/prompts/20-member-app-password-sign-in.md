# Executer prompt — 20 Password sign-in in the Member App (temporary)

Ticket: `.scratch/ayc-member-app/issues/20-member-app-password-sign-in.md` · Blocked by: none (Phase 3 tickets 01 and 04 and Admin ticket 24 are done) · Branch: `feat/phase3-member-app` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Supabase Auth engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
While the site is being tested, the Member App's sign-in screen (/app/sign-in) also offers the email and password box the Admin already has, under "Continue with Google". Beta Testers and Staff with a password User sign in to /app with it.
- The Admin's existing server-only switch ADMIN_PASSWORD_SIGN_IN now turns password sign-in on for BOTH Surfaces. Don't add a new variable. The user chose to reuse this one.
- The Member App also starts counting a session the way the Staff Guard does (fail closed).
- This is temporary: the user removes it with the Admin's box once testing is done. Keep the change small and easy to take out.

CONTEXT
- The pieces to reuse:
  - Ticket 19/24 built the Admin's box. src/lib/admin/sign-in-method.ts has passwordSignInPermitted({ adminMode, nodeEnv, passwordSwitch }), which is live mode and (NODE_ENV "development" or the switch "true"). It also has signInMethodCounts(amr, passwordAllowed), which counts oauth always, password only when allowed, anything else never, and an unreadable amr never.
  - src/lib/admin/identity.ts has passwordSignInAllowed(), passwordSignInPurpose() ("development" → "DEVELOPMENT ONLY", otherwise "TESTING ONLY"), passwordSignInOffered() (allowed, and Supabase says Email is on), startPasswordSession(email, password) (throws where not allowed), endSession(), and the private sessionMethodCounts(userId), which reads getClaims() and checks sub and amr.
  - src/components/admin/password-sign-in-form.tsx is the box. It takes its heading label from the server. src/app/admin/sign-in/actions.ts → signInWithPassword is the Admin's action: parse with passwordSignInSchema, start the session, map problems with PASSWORD_PROBLEMS, never send the password back.
- The Member App today:
  - src/app/app/sign-in/page.tsx shows "Continue with Google" (live) or "Sign in as" (sample), with the line "Use your Google account. No separate username or password."
  - src/app/app/sign-in/actions.ts has signInAs (sample; calls claimDeviceAtSignIn, then redirects to safeMemberAppNext) and continueWithGoogle.
  - /auth/callback finishes Google and claims the device for someone the gate lets in.
  - src/lib/member-app/guard.ts → readAccess() takes the User from getSignedInUser() (src/lib/admin/identity.ts) and runs memberAppGate.
  - getSignedInUser does NOT check how the session signed in. So today any verified Supabase session passes, including magic link or anonymous, or a password session made while passwords aren't allowed. That's the gap to close.
- Decisions (spec, Phase 3 → "Password sign-in in the Member App, while testing (added 2026-11-20)"):
  - **Where the Member App box is allowed:** exactly where passwordSignInAllowed() says, so the two Surfaces never disagree.
  - **Where it's offered:** exactly where passwordSignInOffered() says.
  - **After a password sign-in:** follow Google's path. claimDeviceAtSignIn() runs, and it only claims for someone the gate lets in. Then redirect to safeMemberAppNext(next). The page the Member lands on sends a gated person to "Not open yet".
  - **An unconfirmed email** is refused with PASSWORD_PROBLEMS.unconfirmed. Any session the Member App doesn't count is ended (endSession) and refused with the generic failure, as the Admin does.
  - **What counts in /app:** Google everywhere; a password only where passwordSignInAllowed(); nothing else. Sample mode is unchanged ("Sign in as" has no amr).
  - **Unchanged:** no sign-up, no password reset, no password rules. Password Users are made by hand in the Supabase dashboard with "Confirm email" on. The beta gate, consent and the Active Device are unchanged. The Admin's behaviour is unchanged.
- **Recommended shape:**
  - Export one server function from identity.ts, for example signedInUserCounts(user) or getCountedSignedInUser(). It is the Member App's equivalent of the Staff Guard's method check, built on the same sessionMethodCounts.
  - Make readAccess() return signed-out when the method doesn't count, in live mode only.
  - Add signInWithPassword to src/app/app/sign-in/actions.ts by reusing the Admin action's parsing and PASSWORD_PROBLEMS. Move shared bits to a small shared module rather than copying them, if that keeps it tidy.
  - Don't change getSignedInUser's meaning for the Admin.

SCOPE
Modify:
- src/lib/admin/identity.ts and its tests (only the exported method-check helper for the Member App, if you add it there)
- src/lib/member-app/guard.ts and its tests (count the session's method in live mode)
- src/app/app/sign-in/page.tsx, actions.ts and their tests (the box, its label, the line under the heading, the action)
- src/components/admin/password-sign-in-form.tsx and its test, only if it needs a prop to post to the Member App action or to keep `next`
- docs/runbooks/production.md:
  - In "Testing on the deployed site", say ADMIN_PASSWORD_SIGN_IN now turns on the box in both the Admin and the Member App, and that testers need a password User made in the Supabase dashboard ("Confirm email" on) plus a place on the Beta Testers list.
  - In step 8's "First: end development sign-in", say turning it off ends both.
- .env.example: the comment on ADMIN_PASSWORD_SIGN_IN says it covers both Surfaces
- e2e only if the existing Member App sign-in spec needs a tweak. The e2e server runs in sample mode, where the box never shows, so assert it's absent there.
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, migrations, src/lib/db/schema.ts, src/env.ts (the switch is already in src/env.server.ts; never make it NEXT_PUBLIC_).

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/ and graphify-out/). Stop and report if there are uncommitted changes other than .scratch/ and the planner's docs (docs/specs/2026-10-29-ayc-v1.md).
   - Stay on feat/phase3-member-app (`git switch feat/phase3-member-app`). If it's behind main, run `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
2. Read AGENTS.md, CONTEXT.md (Member, Staff, Beta Tester, Active Device), .scratch/ayc-admin/CONVENTIONS.md §3, the ticket (every checkbox is an acceptance criterion), the spec sections named above, and every file in CONTEXT.
3. Skills: test-driven-development, testing-unit, testing-e2e, supabase-auth, nextjs-app-router, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the Member App's method check: oauth counts with the switch on and off; password counts only where allowed; otp, magiclink, anonymous, a missing amr or an unreadable one never count; a getClaims error or a sub mismatch is signed out.
5. TDD readAccess with that check: a password session with passwords not allowed is signed out in live mode, and sample mode is unchanged.
6. TDD the action and the page:
   - 404 where not allowed (sample, closed, production with the switch off)
   - field errors
   - a wrong password keeps the email and never echoes the password
   - unconfirmed is refused
   - an uncounted session is ended
   - success claims the device for a gated-in Member and redirects to safe next
   - a gated-out person isn't given a device and lands on "Not open yet"
   - the box and its label show only when offered
7. Update the runbook and .env.example. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- Production build, live mode, switch "true", Email on: /app/sign-in shows "Continue with Google" and, under it, the box headed "TESTING ONLY". A Beta Tester with a confirmed password User signs in, their device becomes the Active Device, and they reach the Member App (proved at the action and guard level; the user checks the real deployment).
- `pnpm dev`, live mode: the box shows headed "DEVELOPMENT ONLY", whatever the switch says.
- Switch unset or "false" in production: /app/sign-in is exactly as today, and a password session counts as signed out in /app.
- Google sign-in works as before, with the switch on or off. The Admin's box and Staff Guard behave exactly as before.
Sad paths (each one needs a test):
- Switch "true" with the Email provider off, or Supabase not answering: no box.
- Sample or closed mode: no password box, and the Member App password action answers 404.
- Switch "false" in production: posting the action directly answers 404, and a session made with a password elsewhere is signed out in /app.
- Switch "true", Member App switch off: a password User who isn't Staff or a Beta Tester ends at "Not open yet", and no device is claimed.
- Switch "true": an unconfirmed email is refused. A wrong password shows the existing message, keeps the email and never sends the password back.
- otp, magiclink, anonymous, or a missing or unreadable amr never count in /app, whatever the switch says.
- An unsafe `next` falls back to /app.
- The switch never reaches the client bundle: no NEXT_PUBLIC_ name, and no client component reads it (a grep in your report).

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked as the e2e server has them
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm test:e2e` (on the in-memory sample data)
- the grep for ADMIN_PASSWORD_SIGN_IN across src/, showing it's read only in server code
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers (:3000 and :3001) run in LIVE mode against the hosted project. Never run Playwright e2e against them, never kill them, and never run `pnpm build` in the working tree while they run. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` before a full run, and verify your own diff.
- Playwright skips the admin project silently when a website spec fails. Rerun with `--project=admin --no-deps`.
- A moved route can leave stale .next/types. Fix them with `pnpm exec next typegen`.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase3-member-app, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, never change its Auth settings or Users, and never set anything in Vercel. Turning the switch on and making password Users is the user's job.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency, no new env variable, and no sign-up, password reset or password rules. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. The gate, the staff list and the Beta Tester list decide. Never trust the client, hidden fields or user_metadata, and keep the method check failing closed.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command, and the grep
5. decisions you made, and follow-ups (including exactly what to delete when the user removes password sign-in from both Surfaces)
6. the line "Nothing committed or pushed." and the reminder "To use it on the deployed site: keep ADMIN_PASSWORD_SIGN_IN=true in Vercel (Production) and redeploy, keep the Supabase Email provider on with Confirm email, make each tester a password User in the Supabase dashboard, and add them as a Beta Tester in Admin → Users. Set the switch to false before go-live: that ends password sign-in in both the Admin and the Member App."
```
