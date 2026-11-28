# Executer prompt — 04 Resume and progress

Ticket: `.scratch/ayc-video/issues/04-resume-and-progress.md` · Blocked by: 03 · Branch: `feat/phase5-video` (shared by every Phase 5 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
A Lesson picks up where the Member stopped, on whichever device they use. Lessons are marked done at 90% or by "Mark complete", the Member sees their Lessons on Home, and signing in elsewhere stops the video with "Session ended".

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 5 → "Phase 5 planning decisions (added 2026-11-28)": Watching a Lesson, Progress
  - Phase 3 → "Progress calculator", "Resume state", "Active Device"
  - Testing Decisions → "Seam 3, Progress calculator" and "Phase 5 seams" (Progress calculator; Member seam, extended)
  - Stories 89, 91, 152, 155, 158, 160, 161, 162, 166
- Read:
  - CONTEXT.md: Lesson, Study Day, Study Streak, Course Ownership, Access Pass
  - docs/adr/0011-one-active-device-member-app-only.md, docs/adr/0013-video-on-vdocipher.md
  - .scratch/ayc-video/grilling-notes.md, decisions 6 and 12
  - docs/mockup/member-app/BUILD-MAP.md "Dashboard" (the resume card and summary) and "Course player"
  - VdoCipher's player API docs (public, read only) for the player's time, pause and end events, and the script host it needs
- Tickets 01–03 added Courses, Modules, Lessons with lengths, the video service and sample player, the access decision for Lessons, Course Ownership, the playback pass, the Courses screen, a Course's page and the Lesson screen. Find them in the code, and don't invent paths.
- Existing pieces to follow:
  - The progress calculator: src/lib/member-app/progress.ts (+ test; ResumePlaces, DeckResume, ReaderResume) and src/services/progress.core.ts
  - Study Days: the study_days table in src/lib/db/schema.ts and how card marks and Reviewer page views record one
  - The device check: src/lib/member-app/device.ts, device-token.ts; "Session ended": src/components/member-app/device-screens.tsx
  - Home: src/components/member-app/dashboard.tsx, dashboard-view.ts (progressSummary, the "Continue where you left off" items, the Subject captions)
  - The Admin's Member detail: src/components/admin/users/member-detail.tsx (the progress summary)
  - The Lesson delete dialog's saved-position count from ticket 01 (it returns 0 until now)
  - The Member seam and MEMBER_SUITES in vitest.config.ts
- **Lesson progress** per Member and Lesson: saved position (seconds), furthest point reached, done (with when), last watched. RLS on, no anon or authenticated policies, cascading with the Member and the Lesson.
- **Saving:**
  - every 10 seconds while playing, and on pause, at the end and on leaving the page
  - each save runs the access decision (including the device check); on device-replaced the player stops and shows "Session ended"
  - each save makes the day a Study Day in Manila time
  - refused for a Lesson the Member can't open, and for a position below 0 or beyond the Lesson's length
  - one player adapter emits the same time, pause and end events for VdoCipher's player and the sample player, so the saving logic is shared and e2e can drive the sample player
  - if VdoCipher's player API needs its script, allow only that host in script-src
- **Done:** once the furthest point reaches 90% of the length, skipping ahead included, or by "Mark complete". Done stays done.
  - "Mark complete · next lesson →", and on the last Lesson "Mark complete · finish course" (back to Courses). Replace ticket 03's plain "Next lesson →".
- **Resume:** reopening starts at the saved position: "You stopped here 2 days ago. The video picks up at 12:40." A done Lesson starts from 0: "You finished this lesson. Watch it again anytime."
- **Where it shows:**
  - the side panel: ▶ now, ✓ done, ○ to do
  - Course cards: "9 / 32" and "Continue: {Lesson} →" (otherwise "Start course")
  - Home: "Continue where you left off" includes the last Lesson ("VIDEO LESSON · PSAD · Balanced steel ratio · 12:40 OF 24:10", Resume); each Subject's caption adds "9 lessons"; the summary adds "9 / 32 LESSONS", where the total is the Published Lessons in Courses the Member can open for that Exam
  - the Admin's Member detail: Lesson counts in the progress summary
- **Lessons stay out of the progress %.**
- **Kept and removed:** progress is kept when access ends and when a Lesson is unpublished. Deleting a Lesson removes its progress, and the delete dialog now counts real saved positions.
- **Sample data:** Bea Tester has watched some of "Surveying & Curves Lectures", with one Lesson done and a "Continue" spot (dated relative to the run's clock).

SCOPE
Modify or add:
- src/lib/db/schema.ts: the Lesson progress table; `pnpm db:generate`; keep deny-all.db.test.ts passing
- src/lib/member-app/progress.ts (+ test): done at 90%, resume rules, Lesson counts and totals, the Continue item
- the Member seam: save position, Mark complete, Lesson progress reads, the Continue item, Home's counts; src/services/member.lesson-progress.test.ts, added to MEMBER_SUITES in vitest.config.ts
- the Admin seam: real saved-position counts for the delete dialog, Lesson counts on the Member detail (+ the matching admin suite)
- the player adapter and the Lesson screen's saving, Mark complete and side-panel marks; the Courses cards; dashboard.tsx and dashboard-view.ts; member-detail.tsx (+ component tests)
- src/lib/csp.ts (+ test), only if VdoCipher's player API script needs a host
- sample data
- e2e: extend e2e/member-app/courses.spec.ts (or add e2e/member-app/lesson-progress.spec.ts) on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, Orders and payments.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md, docs/adr/0013-video-on-vdocipher.md, and earlier Phase 5 tickets' uncommitted work if the user says so. Stop and report anything else.
   - `git switch feat/phase5-video`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 03 is present (the Lesson screen, the playback pass, the access decision for Lessons). If it's missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), the ADRs, and the spec and mockup sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, shadcn-ui, tailwind-v4, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure rules (Seam 3): 89.9% not done, exactly 90% done, skipping to 95% done; Mark complete; done stays done after rewatching; resume position vs from 0 when done; the resume message's "2 days ago"; Lesson counts per Subject and the total over Courses the Member can open (not a locked Course, not an Unpublished Lesson); the Continue item picks the latest of deck, Reviewer page and Lesson; a save at 23:59 and 00:01 Manila on different Study Days.
5. TDD the Member seam over both arms: save, refused for a locked Lesson, a position out of range and a replaced device; Mark complete; another Member's progress never readable; progress kept after the pass ends; deleting a Lesson removes its progress.
6. TDD the screens: the Lesson screen's saving through the adapter (with the sample player), "Session ended" on device-replaced, Mark complete and next, the side-panel marks, the Course card's progress and Continue, Home's resume card and counts, the Member detail's counts, the delete dialog's real count.
7. e2e: Bea plays a Lesson in the sample player, stops at a known time, reloads and sees "You stopped here…" at that time; marks it complete and lands on the next Lesson; Home shows the Lesson in "Continue where you left off" and the Lesson counts.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- Bea plays a Lesson, leaves at 12:40, reloads, and it picks up at 12:40 with "You stopped here…".
- Reaching 90% marks the Lesson done (✓), and "Mark complete · next lesson →" marks done and opens the next Lesson.
- Home shows the Lesson in "Continue where you left off", "N lessons" on its Subject and "N / M LESSONS" in the summary.
- Watching on a day with no other studying makes it a Study Day.
Sad paths (each one needs a test):
- 89.9% isn't done; exactly 90% is; skipping ahead to 95% is.
- Done stays done after rewatching from the start, and a done Lesson resumes from 0.
- A save from a replaced device is refused, and the player stops with "Session ended".
- A save for a locked Lesson, or with a position out of range, is refused and stores nothing.
- Another Member's Lesson progress is never readable.
- The "M" in "N / M LESSONS" counts only Published Lessons in Courses the Member can open.
- Saves just before and just after Manila midnight land on the right Study Days.
- Progress is kept after the Access Pass ends and shows again on renewal.
- Deleting a Lesson removes its progress, and the delete dialog counted it.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables, SUPABASE_SECRET_KEY, both PAYMONGO_* variables and VDOCIPHER_API_SECRET blanked
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data, the video fake). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in. Make sure the copy has no leftover coverage/ or build output.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/. Drive time in the sample player, not with real waits.
- A new src/services/member.*.test.ts must be added to MEMBER_SUITES in vitest.config.ts.
- Sample data dated relative to "now" must use the run's clock.
- Inline "use server" handlers must be async.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.
- Known failures on HEAD (check they fail without your change too, and report rather than fix): the sharp beforeAll timeouts (page-images.sharp, reviewer-reader), products-list.spec:173, the e2e overview promo-banner spec, and the database-arm member.payments / member.billing suites on PGlite.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase5-video, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo, VdoCipher or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Every save goes through the access decision, and progress is scoped to the signed-in Member.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the player adapter, the save cadence and leave handling, the Continue ordering, any CSP host added) and follow-ups
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
