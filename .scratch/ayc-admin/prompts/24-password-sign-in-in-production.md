# Executer prompt — 24 Password sign-in in production (temporary)

Ticket: `.scratch/ayc-admin/issues/24-password-sign-in-in-production.md` · Blocked by: none (19 done) · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Supabase Auth engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
While the deployed site is being tested, Staff can sign in to the production Admin with the email and password box that `pnpm dev` shows today, next to "Continue with Google".
- A server-only switch, ADMIN_PASSWORD_SIGN_IN ("true" or "false", unset means "false"), turns it on per environment in Vercel.
- Turning the switch off, or the Supabase Email provider off, ends it, with no code change.
- This is temporary. The user removes it once testing is done, so keep the change small and easy to take out.

CONTEXT
- Ticket 19 built the "DEVELOPMENT ONLY" password box. Two checks keep it out of production today:
  1. passwordSignInAllowed() in src/lib/admin/identity.ts returns adminMode === "live" && env.NODE_ENV === "development". passwordSignInOffered() adds "Supabase says its Email provider is on". The sign-in page (src/app/admin/sign-in/page.tsx) shows the box only when offered. The action signInWithPassword (src/app/admin/sign-in/actions.ts) calls notFound() when not allowed. startPasswordSession() throws when not allowed.
  2. The Staff Guard: sessionMethodCounts() in identity.ts calls signInMethodCounts(claims.amr, env.NODE_ENV) from src/lib/admin/sign-in-method.ts. countedMethods() gives ["oauth", "password"] under "development" and ["oauth"] otherwise. It fails closed on any other method or an unreadable amr.
- Prior art for the switch: MEMBER_APP_LIVE in src/env.server.ts. It's server-only, an optionalEnv(z.enum(["true", "false"]).optional()), and a deploy-time setting that flips with no code change. Follow it exactly. src/env.ts holds only NEXT_PUBLIC_* and NODE_ENV. Never put the switch there, and never make it NEXT_PUBLIC_.
- The box: src/components/admin/password-sign-in-form.tsx. Its heading reads "DEVELOPMENT ONLY". Outside `pnpm dev` it reads "TESTING ONLY". Pass the label in from the server; don't read env in the client component.
- Decisions (spec, Phase 2 → "Password sign-in in production, while testing (added 2026-11-11)"):
  - Where the box is allowed: live mode, and (NODE_ENV === "development" or the switch "true"). It's offered while Supabase says Email is on.
  - What counts: password counts exactly where the box is allowed, oauth everywhere, every other method never.
  - Unchanged: Staff only (the staff list decides), no sign-up, no password reset, Users made by hand in the Supabase dashboard with "Confirm email" on, sample mode, closed mode, Members, Google.
- Recommended shape: one pure function decides whether a password is allowed from (adminMode, NODE_ENV, switch), and both checks use it. Change signInMethodCounts to take that boolean (or a small options object) instead of nodeEnv, so the Guard and the box can never disagree.

SCOPE
Modify:
- src/env.server.ts and its test (the switch)
- src/lib/admin/sign-in-method.ts and its tests (sign-in-method.test.ts, and sign-in-method.db.test.ts only where the signature changes)
- src/lib/admin/identity.ts and its tests (passwordSignInAllowed, sessionMethodCounts, the header comment)
- src/app/admin/sign-in/page.tsx, actions.ts and their tests (the label, and only what the new check needs)
- src/components/admin/password-sign-in-form.tsx and its test (the heading as a prop)
- .env.example (document ADMIN_PASSWORD_SIGN_IN, unset) if the repo has one
- docs/runbooks/production.md: under "While you develop, before go-live", add "Testing on the deployed site": set ADMIN_PASSWORD_SIGN_IN=true in Vercel (Project → Settings → Environment Variables, Production), redeploy, sign in with the TESTING ONLY box. In step 8's "First: end development sign-in", add a first item: set it to "false" (or delete it) in Vercel and redeploy.
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the sample "Sign in as" panel, migrations, src/lib/db/schema.ts.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/). Stop and report if there are uncommitted changes other than .scratch/ and the spec.
   - Switch to docs/ayc-v1-planning (`git switch docs/ayc-v1-planning`). It was merged into main through PR #8. If it is behind main, run `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md (Staff, Staff Guard)
   - .scratch/ayc-admin/CONVENTIONS.md §3 (the Staff Guard and sign-in methods)
   - the ticket: every checkbox is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md, Phase 2 → "Development password sign-in, until go-live" and "Password sign-in in production, while testing"
   - the files in CONTEXT
3. Skills: test-driven-development, testing-unit, supabase-auth, nextjs-app-router, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the switch in the server env: "true", "false", unset and "" pass; any other value fails with a message naming ADMIN_PASSWORD_SIGN_IN.
5. TDD the pure decision as a table: every combination of adminMode (live, sample, closed) × NODE_ENV (development, test, production) × switch (true, false, unset).
6. TDD signInMethodCounts with the new argument: oauth always counts; password only when allowed; otp, magiclink, anonymous, a missing amr or an unreadable one never count.
7. TDD the page, the action and the form: the box and its label, the 404 when not allowed, and the existing wrong-password and unreachable messages.
8. Update the runbook and .env.example. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- Production build, live mode, switch "true", Email on: the sign-in screen shows "Continue with Google" and, under it, the box headed "TESTING ONLY". An Owner on the staff list with a confirmed password User signs in and reaches the Admin (a test at the action and Guard level; the real deployment is checked by the user).
- Google sign-in counts with the switch on or off.
- `pnpm dev`, live mode: the box shows headed "DEVELOPMENT ONLY", whatever the switch says. Ticket 19's tests still pass unchanged in meaning.
- Switch unset or "false" in production: the sign-in screen and Guard behave exactly as before this ticket.
Sad paths (each one needs a test):
- ADMIN_PASSWORD_SIGN_IN="yes" (or "1", "TRUE") fails the server env check with a message naming the variable.
- Switch "true" with the Email provider off, or Supabase not answering: no box.
- Switch "true" in sample or closed mode: no box, and the password action answers 404.
- Switch "false" in production: posting the password action directly answers 404. A session whose amr says password is refused by the Staff Guard.
- Switch "true": a password User whose email isn't on the staff list ends at "denied". One with an unconfirmed email is refused.
- Switch "true": a wrong password shows the existing message, keeps the email, and never sends the password back.
- Switch "true": otp, magiclink, anonymous, or a missing or unreadable amr still never counts.
- The switch never reaches the client bundle: no NEXT_PUBLIC_ name, and no client component reads it (a test or a grep in your report).

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked as the e2e server has them.
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm test:e2e` (the Website and Admin projects, on the in-memory sample data)
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
- The grep for ADMIN_PASSWORD_SIGN_IN across src/, showing it's read only in server code.
Follow verification-before-completion.
Repo gotchas:
- The user's dev server on :3000 runs in LIVE mode against the hosted project. Never run Playwright e2e against it, never kill it, and never run `pnpm build` in the working tree while it runs. Run the build and e2e in a scratchpad copy on another port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` before a full run, verify your own diff, and report the shared-tree results separately.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, never change its Auth settings or Users, and never set anything in Vercel. Turning the switch on is the user's job.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Add no sign-up, password reset, or password rules. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server: the Staff Guard and the staff list decide. Never trust the client, hidden fields or user_metadata, and keep the method check failing closed.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command, and the grep
5. decisions you had to make, and follow-ups (including exactly what to delete when the user removes this later)
6. the line "Nothing committed or pushed." and the reminder "To use it on the deployed site: set ADMIN_PASSWORD_SIGN_IN=true in Vercel (Production), redeploy, and keep the Supabase Email provider on with Confirm email. Set it to false before go-live."
```
