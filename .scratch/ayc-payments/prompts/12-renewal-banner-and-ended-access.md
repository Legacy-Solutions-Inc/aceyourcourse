# Executer prompt — 12 Renewal banner and ended access

Ticket: `.scratch/ayc-payments/issues/12-renewal-banner-and-ended-access.md` · Blocked by: 02 · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
In the week before an Access Pass ends, Members see a banner nudging them to renew, framed around their Exam Date. Ended access shows the progress they've kept and a way to renew. No email.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 4 → "Renewal nudges"
  - "Phase 4 planning decisions (added 2026-11-24)" → "Renewal reminders"
  - Testing Decisions → "Phase 4 seams" (Member seam: the renewal banner and its dismissal until the next Manila day)
  - Stories 141 and 142
- Read:
  - CONTEXT.md: Access Pass, Exam Date, Official Exam Date, Target Exam, Staff
  - .scratch/ayc-payments/grilling-notes.md, decision 12
  - docs/mockup/member-app/BUILD-MAP.md §3 "Dashboard" and "Expired (L532–544)"
- Ticket 02 added the Plans page and a helper for Plans for an Exam (e.g. paths.memberApp.plansFor). Find it in the code, and don't invent paths.
- Existing pieces:
  - src/app/app/(shell)/(home)/page.tsx and the dashboard (src/components/member-app/dashboard.tsx, dashboard-view.ts)
  - the study screens: src/app/app/(shell)/library/page.tsx and library/[kind]/[id]/page.tsx
  - src/components/member-app/content-state.tsx ("Your access ended" with a kept-progress note)
  - src/components/member-app/member-notices.tsx: a dismissible banner to copy
  - src/lib/member-app/access.ts and access-check.ts (the access decision)
  - src/lib/member-app/progress.ts and the Member seam's getProgress
  - src/lib/member-app/exam-date.ts
  - src/lib/manila-time.ts (manilaDate, addCalendarDays)
- **The banner:**
  - Shown on Home and on that Exam's study screens, one per Exam, for any Access Pass (paid or granted) ending within 7 days. "Within 7 days" means the end falls within the next 7 Manila days: exactly 7 shows, 8 doesn't. Already ended doesn't show.
  - Ends before the Exam Date: "Your CE All-Access ends 25 Oct, 27 days before your exam", with "Renew to cover your exam" → Plans for that Exam.
  - Ends on or after the Exam Date, or no Exam Date: "Your CE All-Access ends 25 Oct", with "Renew access" → Plans for that Exam.
  - Dismissing hides that Exam's banner until the next Manila day. Store it per Member, Exam and Manila date on the server, so it holds across devices.
  - Never shown to Staff.
  - Day counts use Manila calendar days.
- **Ended access:**
  - Today's locked state adds the saved progress for that Exam ("312 cards marked, 14 quizzes taken"; drop a zero part, and keep it short when there's no progress at all).
  - It adds "Renew access" → Plans for that Exam, or keeps the "contact us" note when the Exam has nothing on sale (same rule as ticket 02).
- No email (it waits for a sending domain).

SCOPE
Modify or add:
- a pure module, e.g. src/lib/member-app/renewal.ts (+ test): which banners show, their wording, the day counts, the dismissal day
- the Member seam (member.types.ts, member.ts, member.mock.ts, member.db.ts): the banners for the signed-in Member, and dismiss for an Exam and today; src/services/member.renewal.test.ts, added to MEMBER_SUITES in vitest.config.ts
- src/lib/db/schema.ts (a dismissals table, RLS on, no anon or authenticated policies, cascading with the Member); `pnpm db:generate`; keep deny-all.db.test.ts passing
- a banner component (+ test) on Home and the study screens
- content-state.tsx's ended state with progress counts and "Renew access" (+ test)
- e2e: e2e/member-app/renewal.spec.ts on the in-memory sample data (a sample Member whose CE pass ends in 5 days, 27 days before their exam)
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, Orders and payments.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 02 is present (/app/plans with ?exam=). If it's missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), and the spec and mockup sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, shadcn-ui, tailwind-v4, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure module:
   - 8 days → none, 7 → shows, already ended → none
   - before the Exam Date with the day gap, on or after it, no Exam Date
   - two Exams → two banners
   - dismissed today → hidden, tomorrow → back
   - Manila midnight on both the end and the dismissal
5. TDD the Member seam over both arms: Staff get none, and a dismissal by one Member never hides another's.
6. TDD the banner component and the ended state (progress text, Renew link, contact note when nothing is on sale).
7. e2e:
   - The sample Member sees the "before your exam" banner on Home and on a CE study screen, and dismisses it; it stays hidden on reload.
   - A Member with an ended pass sees their progress and "Renew access" on locked CE content.
   - Simulate "next day" in a unit test, not in e2e.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- A Member whose CE pass ends in 5 days, 27 days before their exam, sees the "before your exam" banner on Home and on CE study screens.
- Dismissing hides it for the rest of the Manila day, and it's back the next day.
- A Member whose pass has ended sees their progress and "Renew access" → Plans for that Exam.
Sad paths (each one needs a test):
- A pass ending in 8 days shows no banner. One ending in exactly 7 days does.
- A pass ending after the Exam Date, or with no Exam Date, shows the plain wording.
- Staff never see the banner.
- Two Exams ending soon show two banners, each dismissed separately.
- An already ended pass shows the ended state, not the banner.
- A dismissal by one Member never hides another Member's banner.
- Day counts are right across Manila midnight.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables, SUPABASE_SECRET_KEY and both PAYMONGO_* variables blanked
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.
- A new src/services/member.*.test.ts must be added to MEMBER_SUITES in vitest.config.ts.
- Sample data dated relative to "now" must use the run's clock.
- Inline "use server" handlers must be async.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Banners and dismissals are scoped to the signed-in Member, and every content read still goes through the access decision.
- No email is sent.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the 7-day boundary, the progress wording) and follow-ups
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
