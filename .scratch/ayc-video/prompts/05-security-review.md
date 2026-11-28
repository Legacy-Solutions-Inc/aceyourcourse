# Executer prompt — 05 Security review

Ticket: `.scratch/ayc-video/issues/05-security-review.md` · Blocked by: 04 · Branch: `feat/phase5-video` (shared by every Phase 5 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior application-security engineer with deep Next.js, TypeScript, Supabase and Postgres experience, working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Review the whole Platform (Website, Admin, Member App, payments and video) and write a plain security report the client can read, docs/security-review.md. Fix small, clearly in-scope issues with a test each; list bigger ones as follow-ups. This is the "security review" item of contract Milestone 4.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 5 → "Phase 5 planning decisions (added 2026-11-28)": The security review
  - Architecture and cross-cutting; Phase 3 → "Access decision seam", "Active Device", "Burned-in watermark"; Phase 4 → "PayMongo integration"
  - Testing Decisions → "Permission and deny-all tests"
  - Story 186
- Read:
  - AGENTS.md, CONTEXT.md, every ADR in docs/adr/ (0002 Supabase-only auth, 0010, 0011 and 0013 matter most)
  - .scratch/ayc-video/grilling-notes.md, decision 16
  - docs/runbooks/production.md (how secrets and keys are set)
- Where to look (find the rest yourself):
  - Sign-in: src/lib/admin/sign-in-method.ts, src/lib/admin/password-sign-in.ts, src/lib/admin/guard.ts, src/lib/admin/identity.ts, src/lib/member-app/guard.ts, src/lib/auth/, src/middleware.ts, src/lib/supabase/
  - The temporary password sign-in behind the server-only `ADMIN_PASSWORD_SIGN_IN` (Admin and Member App)
  - Database rules: src/lib/db/schema.ts (every table's `.enableRLS()`), src/lib/db/deny-all.db.test.ts
  - Access: src/lib/member-app/access.ts, access-check.ts, src/services/study-access.ts, the Reviewer PDF page endpoint, the Lesson playback pass and Lesson progress saves (Phase 5), and every Admin Server Action's role check
  - Secrets: every `process.env` read; nothing server-only may be NEXT_PUBLIC_ or reach a client bundle
  - Webhooks and jobs: src/lib/paymongo/webhook.ts, src/app/api/paymongo/**, src/app/api/cron-access.ts, src/app/api/reviewer-pdfs/**
  - Browser protections: src/lib/csp.ts, src/middleware.ts, cookies set by Supabase and by the app
  - Uploads and input: src/services/uploads.types.ts, src/lib/file-signature.ts, the Reviewer PDF upload, the Lesson video upload permission, every Zod schema behind a Server Action or route
  - Personal data: Staff Activity (before/after), the data export, Orders, the Admin's Member detail
  - src/app/api/dev/** (must be unreachable in production)
- **The report** (docs/security-review.md):
  - a short plain-language summary first, for the client
  - the date and the commit reviewed (`git rev-parse --short HEAD`)
  - for each area below: what was checked, how, and the result (passed, fixed, or follow-up); for a follow-up, its risk (high, medium, low) and the suggested fix
  - no secrets, keys, connection strings, real emails or personal data
- **Areas:**
  1. Sign-in: Google only in production for Members and Staff. Flag the temporary password sign-in as a follow-up, with its risk and how to remove it. Do NOT remove or change it.
  2. Database rules: every table has RLS on with no browser policies; Members read only their own data through the server.
  3. Access: every protected read (decks, quizzes, Reviewer PDF pages, video playback passes, Lesson progress saves) goes through the access decision on the server; Owner-only actions are refused for Editors on the server; Admin pages refuse non-Staff.
  4. Secrets: all server-only; the PayMongo webhook signature and the cron secret are checked; the VdoCipher key never reaches the browser.
  5. Browser protections: security headers, cookie flags, and only VdoCipher's player (and its upload and script hosts) allowed beyond the existing sources.
  6. Uploads and input: types, sizes and form input checked on the server.
  7. Personal data: where it's shown and who can see it.
  8. Development routes and sample mode: unreachable or inert in production.
  9. Dependencies: `pnpm audit`; explain each high or critical finding and whether it's reachable.
- **Fixes:** make a fix only when it's small and clearly in scope (a missing role check, a missing validation, a header). Each fix gets a test that fails without it. Anything larger, risky or needing a product decision becomes a follow-up, not a change.

SCOPE
Modify or add:
- docs/security-review.md
- small fixes in the files they touch, each with a test
- tests that prove a check (for example extending the deny-all test to Phase 5's tables, a bundle check for server-only names)
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the temporary password sign-in, dependencies (no upgrades in this ticket; list them as follow-ups).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md, docs/adr/0013-video-on-vdocipher.md, and earlier Phase 5 tickets' uncommitted work if the user says so. Stop and report anything else.
   - `git switch feat/phase5-video`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 04 is present (Lesson progress saves). If it's missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read the spec sections, the ADRs and the runbook above.
3. Skills: secure-code-guardian, supabase (its security checklist), supabase-postgres-best-practices, nextjs-app-router, coding-standards, test-driven-development (for each fix), testing-unit, verification-before-completion, requesting-code-review.
4. Walk each area in order. Record evidence as you go (the file and the check, or the test that proves it).
5. For each small fix: write the failing test first, fix, see it pass.
6. Run `pnpm audit` and record the findings.
7. Write docs/security-review.md.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- docs/security-review.md covers every area above, with the date, the commit reviewed and a plain summary.
- Each "fixed" item has a test that fails without the fix.
- The temporary password sign-in is listed as a follow-up and still works as before.
Sad paths (each one needs a test or a recorded, repeatable check):
- A browser key reading or writing any table is refused (the deny-all test covers every table, including Phase 5's).
- An Editor calling an Owner-only action is refused on the server.
- A protected read for a locked item, a replaced device or no device token is refused.
- A PayMongo webhook with a bad signature changes nothing, and a cron call without the secret is refused.
- No server-only variable name appears in the client bundle (checked against the scratchpad build).
- An upload of the wrong type or size is refused on the server.
- Development routes refuse requests in production mode.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables, SUPABASE_SECRET_KEY, both PAYMONGO_* variables and VDOCIPHER_API_SECRET blanked; then search the client output for server-only names
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
- `pnpm audit`
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright or any probe against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in. Make sure the copy has no leftover coverage/ or build output.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.
- Known failures on HEAD (check they fail without your change too, and report rather than fix): the sharp beforeAll timeouts (page-images.sharp, reviewer-reader), products-list.spec:173, the e2e overview promo-banner spec, and the database-arm member.payments / member.billing suites on PGlite.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase5-video, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo, VdoCipher or Vercel, and never test against a deployed site. Review the code and run local tests only.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add, remove or upgrade no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, never read .env beyond variable names, and never put a real person's email address in the repo or the report.
- Don't remove or weaken the temporary password sign-in; only report it.
- Out-of-scope or large issues go in the report as follow-ups, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test or check that proves it; mark the CI-only ones "CI only, not run here"
3. the fixes made, each with its test
4. the results of each verification command, including `pnpm audit`
5. the follow-ups, highest risk first, each with its suggested fix
6. "No migration", or the migration filename(s) with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
