# Executer prompt — 04 Active Device

Ticket: `.scratch/ayc-member-app/issues/04-active-device.md` · Blocked by: 01 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15, TypeScript, Supabase Auth and web-security engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation, so this prompt is your complete brief. Follow it exactly and work test-first. Stop and ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Each Member uses the Member App on one device at a time.
- Signing in on a new device makes it the Active Device. The old device's next request lands on "Session ended", which offers "Sign in on this device".
- A session that never claimed this device, for example one signed in through /admin, gets a one-tap "Use the Member App on this device" screen.
- Every claim is logged.

CONTEXT
- Read first:
  - AGENTS.md and CONTEXT.md (Active Device, Member, Staff).
  - ADR 0011 (one Active Device, Member App only, and why not Supabase's single-session setting).
  - The spec, docs/specs/2026-10-29-ayc-v1.md:
    - Phase 3 → "Active Device"
    - "Phase 3 planning decisions (added 2026-11-17)" → "The Active Device: no device token" and "Staff in the Member App"
    - stories 107–109 and 133f
  - docs/mockup/member-app/BUILD-MAP.md: the `session` screen.
  - The ticket: every checkbox is part of your acceptance criteria.
- What exists:
  - Ticket 01: the gate, the Member seam, the members table, Google sign-in for /app through src/app/auth/callback/route.ts, and the /app layout.
  - Ticket 02 (consent) may or may not be done, because 04 is only blocked by 01. If it's present, the device check runs after consent. If not, put the device check right after the gate, and leave a clear single place where consent slots in. Say which in your report.
  - src/middleware.ts refreshes sessions for /app. Keep the device check in the server layout and actions, not middleware, unless you find a strong reason; ask first if so.
- Decisions for this ticket:
  - The token is 32 random bytes, base64url, in a cookie named "ayc_device": httpOnly, Secure (except on localhost in development), SameSite=Lax, Path=/app, with a long max-age.
  - Only a SHA-256 hash is stored, on the Member's Active Device record (one row per Member) with claimed-at and the device label. The raw token is never stored or logged.
  - Claiming happens in two places, and each replaces the record and appends a switch-log row (Member, time, device label):
    - when the Member App's Google sign-in completes (the callback, for /app destinations)
    - when the Member confirms "Use the Member App on this device" or "Sign in on this device"
  - The first claim is logged too.
  - The check is a seam function: deviceStatus(member, requestToken) returns "active" | "no-token" | "replaced". Compare hashes in constant time.
  - Where it runs: every /app page (the layout) and every Member App Server Action, after the gate (and consent).
    - "no-token" shows the "Use the Member App on this device" screen.
    - "replaced" shows "Session ended" (mockup `session`): "You signed in on another device", with "Sign in on this device". That starts Google sign-in with next set to the current /app path and claims on return.
    - Actions answer with a refusal the UI turns into those screens. They make no change.
  - Device label: a small pure parser of the User-Agent into "{Browser} on {OS}" (Chrome, Safari, Firefox, Edge, Samsung Internet × Android, iOS, macOS, Windows, Linux). Anything else is "Unknown browser". No new dependency.
  - The Admin is exempt: /admin never reads, sets or checks the device. Staff in /app are checked like any Member.
  - Sign-out from /app clears the cookie, and doesn't clear the Active Device record.
  - Sample mode: the "Sign in as" flow claims the device the same way, so e2e can show replacement with two browser contexts.

SCOPE
Create or modify:
- the Member seam (both arms, one behaviour suite): claimDevice, deviceStatus, listDeviceSwitches, deviceSwitchCount
- src/lib/db/schema.ts (member_active_devices, member_device_switches) and the generated migration
- the pure User-Agent label parser and the token helpers, with tests
- the callback route (claim for /app), the /app layout check, the two screens and their actions, and the sample sign-in claim
- e2e: two browser contexts. A signs in, then B signs in; A's next navigation shows "Session ended"; A uses "Sign in on this device" and B is then replaced.
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Admin's sign-in and Staff Guard (only verify they're unaffected).

APPROACH
1. Pre-flight (below).
2. Read the files in CONTEXT.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, supabase-auth, drizzle-data, supabase-postgres-best-practices, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the token and hash helpers, and the label parser over real UA strings.
5. TDD the seam: claim, status for active, no-token, replaced and a tampered token, and the switch log.
6. Add the tables and migration with RLS on, and extend the deny-all test.
7. Wire the callback, layout, screens and actions, with component tests for both screens.
8. Write the two-context e2e.
9. Verify, run requesting-code-review, fix the in-scope findings, and report.

ACCEPTANCE CRITERIA
Happy paths:
- Signing in on device B sends device A to "Session ended" on its next request.
- "Sign in on this device" on A makes A active again, and B is then replaced.
- A session with no token sees "Use the Member App on this device". Confirming claims the device.
- Every claim, including the first, is logged with its time and device label.
- Using the Admin on another device never replaces the Member App device.
Sad paths (each one needs a test):
- A tampered or unknown token is treated as "replaced", never as "active".
- A replaced device's Server Action posts are refused, with no change.
- The raw token is never stored or logged. Assert that only the hash reaches the seam.
- One Member's token never matches another Member's record.
- The claim action refuses a gated person (and one who hasn't agreed to the Terms, if 02 is present).
- An unknown User-Agent gets "Unknown browser".
- The cookie is httpOnly and SameSite=Lax, and Secure outside local development.

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
