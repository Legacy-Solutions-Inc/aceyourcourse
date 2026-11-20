# Executer prompt — 01 Member App shell, sign-in and the beta gate

Ticket: `.scratch/ayc-member-app/issues/01-member-app-shell-and-beta-gate.md` · Blocked by: none · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15, TypeScript, Supabase Auth and Drizzle engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation, so this prompt is your complete brief. Follow it exactly and work test-first. Stop and ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
A Visitor opens /app, signs in with Google and lands in the Member App's shell, with a placeholder Home.
- While the Member App switch (MEMBER_APP_LIVE) is off, only active Staff and Beta Testers get past sign-in. Everyone else sees "Not open yet".
- Owners keep the Beta Tester list in a new Owner-only Users screen in the Admin.
- In sample mode, a development-only "Sign in as" list of sample Members drives e2e.

CONTEXT
- Read first:
  - AGENTS.md and CONTEXT.md: Member, Staff, Beta Tester (new), Invite, Staff Activity, Guard, Surface.
  - The spec, docs/specs/2026-10-29-ayc-v1.md:
    - Phase 3 → "Phase 3 planning decisions (added 2026-11-17)" → "How the work is staged" and "The beta gate"
    - stories 81 and 133a–133d
    - Testing Decisions → "Phase 3 seams"
  - ADR 0008 (one app, Members and Staff).
  - docs/mockup/member-app/BUILD-MAP.md §2 (the shell, sidebar, drawer, nav items) and the `signin` screen in §3.
  - .scratch/ayc-admin/CONVENTIONS.md: the Staff Guard; the live, sample and closed modes; Staff Activity; the conflict check.
  - The ticket: every checkbox is part of your acceptance criteria.
- What exists today:
  - Routes: src/paths.ts has paths.memberApp.home ("/app") and paths.memberApp.plans, and no /app route yet. src/lib/session-routes.ts already lists "/app" in SESSION_PREFIXES, and src/middleware.ts refreshes sessions there.
  - Admin sign-in:
    - src/lib/admin/identity.ts: getIdentity, startGoogleSignIn, finishGoogleSignIn, endSession, sample sessions via SAMPLE_IDENTITY_COOKIE "ayc_admin_sample", listSampleUsers, startSampleSession.
    - src/lib/admin/guard.ts: the Staff Guard, continueSignIn.
    - src/lib/admin/mode.ts: computeAdminMode → "live" | "sample" | "closed".
  - The OAuth callback, src/app/auth/callback/route.ts, sanitises `next` with safeAdminNext (src/lib/admin/safe-next.ts), which only keeps /admin paths. Its comment says Phase 3 will widen `next`.
  - The switch: memberAppLive() in src/services/catalogue.rules.ts reads serverEnv.MEMBER_APP_LIVE (src/env.server.ts, server-only).
  - The staff list: the staff table in src/lib/db/schema.ts, read through the Admin seam (src/services/admin.ts with admin.mock.ts and admin.db.ts; getStaffByEmail). Staff are active, invited or removed. Only active Staff pass the gate.
  - Admin UI pieces to reuse: src/components/admin/sign-in-as-panel.tsx, google-sign-in-form.tsx, auth-screen.tsx, admin-menu.ts (the sidebar menu; add Users for Owners only), typed-delete-dialog.tsx.
  - Migrations: drizzle-kit generates them from src/lib/db/schema.ts with `pnpm db:generate` into supabase/migrations (`<timestamp>_<name>.sql`, snapshots in supabase/migrations/meta). Existing migrations enable RLS per table with no policies. The deny-all database test is src/lib/db/deny-all.db.test.ts.
- Decisions for this ticket:
  - The gate is one server-side function, the "Member App gate". From (switch, the User's verified email, active Staff?, Beta Tester?) it returns "open" or "not-open-yet". Make it pure, with a server wrapper that gathers its inputs.
  - Every /app page (through the Member App layout) and every Member App Server Action calls the gate. Later tickets add consent and the Active Device behind it.
  - Beta Tester matching is by verified Google email, lowercased. An unverified email never matches, in the same way identity.ts already treats emails.
  - Beta Testers have no expiry and no role.
  - Adding and removing a tester writes Staff Activity, through the Admin seam with the same conventions as Staff and Invites.
  - The Member record is created the first time someone passes the gate, keyed by the Supabase User id, with name and email. Nobody who is refused gets one.
  - Sign-in: reuse the Google OAuth start and callback.
    - Widen the callback's `next` handling so a Member App path is kept. Add a pure safeMemberAppNext with tests, mirroring safeAdminNext; anything else falls back to /app.
    - The callback sends an /app destination to /app, never through the Staff Guard's continueSignIn.
    - Keep Admin behaviour unchanged.
  - The shell (BUILD-MAP §2): the desktop sidebar (brand, seven numbered nav items, footer with name, email and Sign out), and the mobile Menu button and drawer (Escape, ✕ and the scrim close it). Home is a placeholder ("Welcome, {first name}"). The other nav items stay visible and open a simple "Coming in the beta" screen. No exam switcher yet; ticket 03 adds it.
  - Sample mode: when the Admin's mode would be "sample", /app shows a development-only "Sign in as" list:
    - a Beta Tester (tester@example.com)
    - an Owner from the existing sample staff
    - a Member who isn't a tester (stranger@example.com), who sees "Not open yet" while the switch is off
    - Closed mode: /app answers 404 the way /admin does.
    - Reuse the identity module's sample-session approach with a separate cookie, or share the sample identity if that's cleaner. Say which in your report.
  - Not open yet: keeps them signed in and shows the support email from Settings (the contact email) and "Sign out".

SCOPE
Create or modify:
- the gate (pure plus server wrapper) and the safe Member App `next`, with their tests
- the Member seam (new): a sample arm, a database arm and one behaviour suite, starting with getOrCreateMember and isBetaTester
- the Admin seam: listBetaTesters, addBetaTester and removeBetaTester, in both arms, with Staff Activity
- src/lib/db/schema.ts (members, beta_testers) and the generated migration
- the OAuth callback route and its test
- /app routes: the layout with the gate, sign-in, not open yet, Home and the placeholder nav screens; components under src/components/member-app/
- /admin/users with a Beta Testers tab (Owner only), plus the Admin menu entry
- src/paths.ts entries for the new routes
- e2e: a new Member App Playwright project or spec(s), and an Admin spec for Beta Testers
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Website's pages, and the Admin's existing sign-in behaviour beyond the callback's `next` widening.

APPROACH
1. Pre-flight (below).
2. Read the files in CONTEXT.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, supabase-auth, drizzle-data, supabase-postgres-best-practices, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure gate as a table: switch on or off × active Staff, removed Staff, invited Staff, Beta Tester, removed tester, neither × verified or unverified email.
5. TDD safeMemberAppNext: an /app path is kept; /admin, other origins, "//x", "/\x", ".." and /application fall back to /app.
6. TDD the seams (both arms through one suite): Beta Tester add (validated, lowercased, unique), remove, list with date and who added, and Staff Activity; getOrCreateMember is idempotent.
7. Add the tables and generate the migration with RLS enabled. Extend the deny-all database test.
8. Build the routes and shell. Write component tests for the shell, drawer and not-open-yet screen.
9. e2e on the sample data:
   - a tester signs in as and reaches Home
   - the stranger sees "Not open yet" and signs out
   - an Owner adds and removes a tester in Admin → Users
   - an Editor doesn't see Users
10. Verify. Then run requesting-code-review on your diff, fix the in-scope findings, and report.

ACCEPTANCE CRITERIA
Happy paths:
- Switch off: a Beta Tester and an active Staff User reach the shell after sign-in (sample "Sign in as" in e2e; Google in live mode through the callback, tested at the route level).
- Switch on: anyone reaches the shell.
- An Owner adds a tester by email and removes them. Each change shows in Staff Activity.
- The shell's sidebar, mobile drawer and Sign out work. Sign out ends the session and returns to the sign-in screen.
- "Sign in as" lists the sample Members in sample mode.
Sad paths (each one needs a test):
- A removed tester is refused at their next request while the switch is off.
- Removed or invited (not yet active) Staff are treated as non-testers.
- Email matching ignores case. An unverified email never matches.
- An invalid email, or one already on the list, is refused with a message.
- An Editor who posts the Beta Tester actions directly is refused on the server, and doesn't see the Users screen.
- A gated person's direct request to any /app page or Member App action is refused, and no Member record is created for them.
- An unsafe `next` falls back to /app. Admin `next` handling is unchanged.
- Without a session, /app routes go to the sign-in screen.
- In production with no database and no Supabase (closed), /app answers 404 and "Sign in as" is absent.

PRE-FLIGHT (APPROACH step 1)
- Run `git status`. The only uncommitted changes allowed are: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md, docs/adr/0010-access-follows-the-exam.md (the planner's docs), and the work of the earlier Phase 3 tickets named in "Blocked by". If anything else is uncommitted, stop and ask.
- `git switch feat/phase3-member-app`. If it's behind main, run `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a new branch.
- Check that each blocking ticket's work is present (its screens, seam functions and tables). If it's missing, stop and ask.

VERIFICATION
Run each of these and show its last lines:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked, as the e2e server has them.
- `pnpm test:coverage` (the thresholds must still pass; don't lower them).
- `pnpm test:e2e` (the Website, Admin and Member App specs, on the in-memory sample data).
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run in LIVE mode against the hosted project.
  - Never run Playwright e2e against them, and never kill them.
  - Never run `pnpm build` in the working tree while they run.
  - Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` before a full run, verify your own diff, and report the shared-tree results separately.
- Playwright silently skips the admin project when a Website spec fails. If that happens, rerun with `--project=admin --no-deps` and report both.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase3-member-app, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project or Vercel, and never change their data or settings. Write migration files only. The user applies them to hosted after merging.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency, and move none from devDependencies to dependencies, without stopping to ask first.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo. Use example.com addresses in tests and sample data.
- Authorisation stays on the server: the Staff Guard, the staff list, the Beta Tester list and the Member's own records decide. Never trust the client, hidden fields or user_metadata.
- Every Admin page and Admin Server Action still calls the Staff Guard. Every Member App page and Member App Server Action runs the Member App's server checks (the gate, and later tickets' consent and Active Device checks).
- Every new table has RLS on with no anon or authenticated policies (deny-all), and the deny-all database test covers it.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion, from this prompt and the ticket's checkboxes, marked ✅ or ❌ with the test that proves it. Mark the database-only ones "CI only, not run here".
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made, and follow-ups
6. each new migration filename, with the line "Apply <migration> to hosted after merging (the user does this)", or "No migration" if there is none
7. the line "Nothing committed or pushed."
```
