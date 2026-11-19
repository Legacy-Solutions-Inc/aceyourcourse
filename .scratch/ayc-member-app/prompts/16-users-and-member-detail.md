# Executer prompt — 16 Users list, Member detail and force sign-out

Ticket: `.scratch/ayc-member-app/issues/16-users-and-member-detail.md` · Blocked by: 04, 05 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Owners see a Users list and each Member's detail page, so they can support Members and spot shared accounts. They can force-sign-out a Member's Active Device, with a reason that's logged. Editors never see any of it.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 3 → "Beta access", "Active Device"
  - "Phase 3 planning decisions (added 2026-11-17)" → the beta gate (the Beta Testers tab lives in this Users screen), "Staff in the Member App"
  - Testing Decisions → "Phase 3 seams" → "Admin seam, extended"
  - Stories 129, 130 and 132.
- Read CONTEXT.md (Member, Staff, Staff Role, Beta Tester, Active Device, Access Pass, Target Exam, Staff Activity), ADR 0011, .scratch/ayc-admin/CONVENTIONS.md and docs/mockup/admin/BUILD-MAP.md §3.10 "Users" (list and detail).
  - The mockup's "Grant a plan…" and "Extend access…" panels are ticket 17. Don't build them here.
  - The mockup says "The member gets an email". That's wrong: there's no email in Phase 3.
- Earlier Phase 3 tickets created the concepts you build on. Find them in the code, and don't invent paths:
  - the Owner-only Users screen with its Beta Testers tab, and the Member record (01)
  - consent records (02)
  - Target Exams (03)
  - the Active Device record, the device switch log and "Session ended" (04)
  - the Access Pass record and its history, and the content tables (05)
- Existing code to follow:
  - the Admin seam in src/services/admin.ts, admin.mock.ts and admin.db.ts, with its Staff rules: Owner-only actions, the "invalid" result shape, and Staff Activity per write
  - src/lib/admin/staff-rows.ts
  - the Staff Guard in src/lib/admin/guard.ts
  - Staff Activity in src/lib/db/schema.ts (staffActivity: actorEmail, actorName, entity, entityId, action, before, after)
  - the existing Admin list helpers (for example src/lib/admin/product-list.ts) for URL-driven search, filters and paging
- **The list:**
  - search by name or email
  - filters: All, Active Pass, Expired, None, Staff, Beta Tester
  - columns: User (name and email), Target Exam(s), Access Pass end (red when expired, in Asia/Manila; src/lib/manila-time.ts), Active Device label and when, and role (Member, Editor, Owner)
  - paged, with the state in the URL
- **Member detail:**
  - profile and joined date
  - Target Exams with Exam Dates
  - Access Passes with their history of grants
  - the progress summary per Target Exam
  - device switch count and log (time and label)
  - consent versions and date
  - purchase history: an empty, labelled section, "Purchases arrive with Payments (Phase 4)"
- **The progress summary must work whether or not ticket 15 has landed.** If the Member seam exposes ticket 15's summary, use it. Otherwise show the basic counts: cards marked, quizzes taken with their quiz average, pages viewed and last active (the last Study Day). Note which one you used.
- **Force sign-out:**
  - needs a reason
  - clears the Member's Active Device, so their next Member App request lands on "Session ended"
  - logged in Staff Activity with the reason and the old device label

SCOPE
Modify or add:
- the Admin seam (contract, both arms) for listing Users, reading Member detail and force sign-out, with tests
- the Users list and Member detail screens and their component tests
- a migration only if something is missing (for example an index for the search), in the repo's style, with RLS on and no anon or authenticated policies
- e2e: extend the Admin spec on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Member App screens (beyond what "Session ended" already does), Payments.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0010-access-follows-the-exam.md. Stop and report anything else.
   - `git switch feat/phase3-member-app`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that tickets 01, 04 and 05 are present. If they're missing, stop and ask.
2. Read AGENTS.md, CONTEXT.md, CONVENTIONS.md, the ticket (every checkbox is part of your acceptance criteria), and the spec and mockup sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, data-tables, forms-validation, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the URL parsing for search, filters and paging as pure functions.
5. TDD the Admin seam against both arms: each filter, search, the detail read, force sign-out, Staff Activity, and an Editor refused.
6. TDD the screens: the empty states, the expired highlight and the reason field.
7. Extend the e2e: an Owner filters to Beta Tester, opens a detail page, forces sign-out, and the Member's next /app request shows "Session ended". An Editor gets the refusal.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Owner searches by name or email, filters by each filter, pages, and opens a detail page with every section.
- Forcing sign-out with a reason sends the Member's device to "Session ended" on its next request. The action is in Staff Activity.
- The progress summary shows, with ticket 15's summary or the basic counts.
Sad paths (each one needs a test):
- An Editor is refused the list, the detail page and force sign-out on the server, and doesn't see the Users nav item.
- A Member who isn't Staff can never reach these pages or actions.
- A search with no results shows an empty state.
- An unknown or malformed Member ID answers 404.
- Force sign-out without a reason is refused.
- Force sign-out on a Member with no Active Device is handled with a clear message and no Staff Activity noise.
- Invalid filter or page parameters fall back to defaults.
- An Access Pass ending today shows right across Asia/Manila midnight.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked, as the e2e server has them
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm test:e2e` (the in-memory sample data). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree while they run. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase3-member-app, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project or Vercel, and never apply a migration to hosted.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Every Admin page calls the Staff Guard, and Owner-only actions refuse Editors on the server.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (which progress summary you used) and follow-ups
6. any migration filename, with "Apply <migration> to hosted after merging (the user does this)", or "No migration"
7. the line "Nothing committed or pushed."
```
