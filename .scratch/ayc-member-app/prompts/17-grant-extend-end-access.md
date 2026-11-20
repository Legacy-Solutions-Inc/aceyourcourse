# Executer prompt — 17 Grant, extend and end access, with notices

Ticket: `.scratch/ayc-member-app/issues/17-grant-extend-end-access.md` · Blocked by: 16 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
From a Member's detail page, Owners can grant an Access Pass for an Exam, extend one, or end one now, each with a reason saved in Staff Activity. Members see a dismissible in-app notice. A grant for an Exam the Member doesn't have adds it to their Target Exams.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 3 → "Beta access"
  - "Phase 3 planning decisions (added 2026-11-17)" → "Grants and ending access", "In-app notices", "Target Exams" (grant-added)
  - Phase 4 → "Order ledger" (how Paid Orders will stack later)
  - Testing Decisions → "Phase 3 seams"
  - Stories 131, 133h and 133j.
- Read CONTEXT.md (Access Pass: each grant extends from its current end date, or from now if expired; Target Exam; Exam Date; Official Exam Date; Staff Activity), ADR 0010 (with its amendment), .scratch/ayc-admin/CONVENTIONS.md and docs/mockup/admin/BUILD-MAP.md §3.10 "Users" (the detail's "Extend access…" and "Grant a plan…" panels).
  - Our decisions win where the mockup differs. The mockup says "The member gets an email": wrong, it's an in-app notice only. Its "Grant a plan" means an Access Pass for an Exam.
- Earlier Phase 3 tickets created the concepts you build on. Find them in the code, and don't invent paths:
  - the Member detail page and the Admin seam's Users reads (16)
  - the Access Pass record and its history (05)
  - Target Exams, including removed ones and the restore on re-add (03)
  - the Member App shell (01), where the notice banner shows
  - the access decision (05), which already turns a pass end into allowed or expired
- **The rules:**
  - **Grant:** pick an Exam; days of 30, 90, 180 or 365, or a custom whole number 1–365; and a reason. New end = max(current end, now) + days.
  - **Extend:** 3, 7, 14 or 30 days, with a reason. Only on an existing pass, from max(current end, now).
  - **End access now:** a reason. Sets the end to now, keeps every progress record, and the Member sees the expired state.
  - **Record each grant's and extension's days** as their own history rows (source "grant"), so Phase 4 can tell granted days from paid ones. From Phase 4, "End access now" may end only granted days. Note that in a code comment and the report, but build no Phase 4 logic.
  - **Dates** show in Asia/Manila (src/lib/manila-time.ts).
- **The Target Exam:** a grant for an Exam the Member doesn't have adds it with the Official Exam Date (or restores a removed one, keeping its progress), on their next visit or straight away, as fits ticket 03's model.
- **Notices:**
  - one dismissible banner per notice in the Member App:
    - "You now have {Exam} All-Access until {date}"
    - "Your {Exam} access was extended to {date}"
    - "Your {Exam} access has ended"
  - dismissing is stored per Member and notice
  - no email and no notification centre
- **Every action** is recorded in Staff Activity: entity Access Pass, the action, before and after end dates, and the reason. Follow the Admin seam's existing pattern in src/services/admin*.ts.

SCOPE
Modify or add:
- the Admin seam (both arms) for grant, extend and end, with tests
- the Member seam (both arms) for listing and dismissing notices, with tests
- the Member detail page's Grant, Extend and End panels, and the Member App notice banner, with component tests
- a migration for notices and any history columns, in the repo's style, with RLS on and no anon or authenticated policies
- e2e: extend the Admin and Member App specs on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, Payments.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0010-access-follows-the-exam.md. Stop and report anything else.
   - `git switch feat/phase3-member-app`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 16 is present. If it's missing, stop and ask.
2. Read AGENTS.md, CONTEXT.md, CONVENTIONS.md, the ticket (every checkbox is part of your acceptance criteria), and the spec and mockup sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, forms-validation, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pass arithmetic as pure functions: grant and extend from an active or expired pass, end now, Manila display across midnight.
5. TDD the zod validation: allowed days, custom 1–365, and a required reason.
6. TDD the Admin seam against both arms (Staff Activity, Editor refused, Target Exam added or restored) and the Member seam's notices (list, dismiss, never another Member's).
7. TDD the panels and the banner.
8. Extend the e2e: an Owner grants a sample Beta Tester CE for 30 days. The tester sees the notice, opens a locked CE Topic, and dismisses the notice, which stays dismissed. The Owner ends access, and the content shows the expired state with progress kept.
9. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Owner grants a tester CE for 30 days. The tester sees "You now have CE All-Access until {date}" and opens locked CE content.
- Extending adds the days to the current end, and the notice shows the new date.
- "End access now" locks the content with the expired state, and progress stays.
- A grant for an Exam the Member doesn't have adds it to their Target Exams, or restores a removed one.
- Each action is in Staff Activity with the reason and the before and after ends.
Sad paths (each one needs a test):
- An Editor is refused grant, extend and end on the server, and doesn't see the panels.
- Days outside the allowed values (0, 366, 12 for Extend, not a number) are refused.
- An empty or whitespace-only reason is refused.
- Granting on an expired pass starts from now, not the old end.
- Extending when there's no pass is refused with a message.
- Ending an already expired pass is handled without changing the end or logging noise.
- The end date shows right across Asia/Manila midnight.
- A dismissed notice stays dismissed across visits and devices.
- One Member never sees another's notices.

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
- Authorisation stays on the server. Owner-only actions refuse Editors on the server. Every Member App read goes through the access decision.
- No email is sent. Notices are in-app only.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (when a grant-added Target Exam appears, the grant history shape for Phase 4) and follow-ups
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
