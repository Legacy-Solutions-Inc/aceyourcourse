# Executer prompt — 03 Watching

Ticket: `.scratch/ayc-video/issues/03-watching.md` · Blocked by: 02 · Branch: `feat/phase5-video` (shared by every Phase 5 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Members find their Exam's Courses on the Courses screen and watch the Lessons they're allowed to, in a DRM player with their email and Member ID drifting across the video. Locked Courses say exactly how to unlock them.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 3 → "Access decision seam" (the rule, amended on 2026-11-28)
  - Phase 5 → "Phase 5 planning decisions (added 2026-11-28)": Access and playback, The Courses screen, The VdoCipher key decides
  - Testing Decisions → "Seam 2, Access decision" and "Phase 5 seams" (Access decision; Member seam, extended)
  - Stories 152, 154, 157, 159, 163, 164, 165, 167, 168
- Read:
  - CONTEXT.md: Course, Module, Lesson, Course Ownership, Access Pass, Free Preview, Target Exam, Staff
  - docs/adr/0010-access-follows-the-exam.md, docs/adr/0011-one-active-device-member-app-only.md, docs/adr/0013-video-on-vdocipher.md
  - .scratch/ayc-video/grilling-notes.md, decisions 4, 8, 12, 13 and 14
  - docs/mockup/member-app/BUILD-MAP.md "Courses (L575–593…)" and "Course player (L372–410…)" (a reference; the spec wins)
- Tickets 01 and 02 added Courses, Modules, Lessons, how Members get a Course (with price and On sale), the video service (with its fake and the key's modes), the playback pass, the sample player component and the security headers for VdoCipher's player. Find them in the code, and don't invent paths.
- Existing pieces to follow:
  - The access decision: src/lib/member-app/access.ts (+ test), access-check.ts (gathers inputs on the server), src/services/study-access.ts
  - Locked, expired and unavailable screens: src/components/member-app/content-state.tsx, study-states.tsx, device-screens.tsx; src/lib/member-app/unlock.ts and unlock-read.ts ("See plans", "Renew access", paths.memberApp.plansFor)
  - The Library as the screen pattern: src/app/app/(shell)/library/**, src/components/member-app/library.tsx, library-view.ts, exam-switcher.tsx, focus-screen.tsx
  - The Courses placeholder: src/app/app/(shell)/[screen]/page.tsx and src/components/member-app/member-menu.ts (the "courses" item; paths.memberApp.courses)
  - The Member seam: src/services/member.types.ts, member.ts, member.mock.ts, member.db.ts, member.schema.ts; suites over MEMBER_ARMS (test/member-arms.ts), each listed in MEMBER_SUITES in vitest.config.ts
  - src/lib/member-app/member-id.ts (memberWatermark)
  - src/lib/db/schema.ts and src/lib/db/deny-all.db.test.ts
- **The access decision covers Lessons** (the amended rule):
  - gate and Active Device checks first, as for all content
  - available: the Lesson is Published and its Course is Visible; a Hidden Course stays available to the Members who own it; an Unpublished Lesson is unavailable to everyone
  - allowed: a Free Preview Lesson; active Staff; an included Course's Lesson with an active Access Pass for the Course's Exam; a separately sold Course's Lesson with Course Ownership
  - an Access Pass never opens a separately sold Course: "locked"
  - an included Course with an ended Access Pass: "expired" (Renew access, progress kept); with none: "locked"
- **Course Ownership** records (Member, Course, since, and a source: an Order or a gift; tickets 06 and 07 create them). RLS on, no anon or authenticated policies, cascading with the Member. Tests use fixtures; add no way to create one from the UI.
- **The playback pass** (Member App): issued only after the access decision allows the Lesson, only to the Active Device, through the video service, with the watermark "{email} · {short Member ID}" drifting across the video. A locked or unavailable Lesson gets no pass, even by its address.
- **The Courses screen** (replace the placeholder for "courses"): the selected Target Exam's Visible Courses plus any Hidden ones the Member owns, grouped by Subject in the Exam's Subject order. Each card: title, "3 MODULES · 32 LESSONS", the cover or the Subject block, and its state:
  - Owned → OWNED, "Start course"
  - Included, active Access Pass → IN YOUR PLAN, "Start course"
  - Included, no Access Pass → locked, "See plans"
  - Included, Access Pass ended → locked, "Renew access" (progress kept)
  - Sold separately, not owned, on sale → locked, "Unlock for ₱1,499" (to that Exam's Plans page for now; ticket 06 points it at the Course)
  - Sold separately, not owned, not on sale → locked, "Not on sale right now"
  - A locked Course with Free Preview Lessons adds "2 FREE LESSONS · Watch free".
  - Empty: "Courses for CE are on the way. Your flashcards, quizzes and Reviewer PDFs are ready now."
- **A Course's page:** Modules and Lessons with their lengths. A locked Course's list opens too, and only its Free Preview Lessons play.
- **The Lesson screen:** the player (VdoCipher's embed with the pass, or the sample player with the fake), the crumb "PSAD MASTERCLASS · MODULE 2 · LESSON 3", the title, the notes, a side panel listing the Modules and Lessons, "← {previous Lesson}" and "Next lesson →". Any Lesson can be opened in any order. (Ticket 04 adds saving positions, Mark complete and the ✓ / ▶ / ○ marks.)
- **No key:** "This video isn't available yet" in place of the player; no pass is requested.

SCOPE
Modify or add:
- src/lib/member-app/access.ts (+ test) and the input gathering for Lessons (access-check.ts or alongside)
- src/lib/db/schema.ts: the Course Ownership table; `pnpm db:generate`; keep deny-all.db.test.ts passing
- the Member seam: the Courses for an Exam with card states, a Course with its Lessons, a Lesson with its access outcome, the playback pass; src/services/member.courses.test.ts, added to MEMBER_SUITES in vitest.config.ts
- a pure view module (e.g. src/lib/member-app/courses-view.ts + test): card states, grouping, counts, labels
- routes under src/app/app/(shell)/courses/** (the screen, a Course, a Lesson); components under src/components/member-app/ (+ component tests); src/paths.ts; the placeholder no longer handles "courses"
- e2e: e2e/member-app/courses.spec.ts on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, Orders and payments, the Admin builder (beyond fixing a bug you must report).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md, docs/adr/0013-video-on-vdocipher.md, and earlier Phase 5 tickets' uncommitted work if the user says so. Stop and report anything else.
   - `git switch feat/phase5-video`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 02 is present (the video service, its fake, the sample player). If it's missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), the ADRs, and the spec and mockup sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, shadcn-ui, tailwind-v4, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the access decision for Lessons (Seam 2): Free Preview with no pass; included with a pass for the same Exam, another Exam, an ended pass; sold separately with a pass and no ownership (locked), with ownership; a Hidden Course for an owner and a non-owner; an Unpublished Lesson for an owner; active Staff; a replaced device; no device token; the gate. Keep every existing deck, quiz and Reviewer PDF test passing.
5. TDD the view: each card state, the Free Preview count, grouping by Subject, the empty state.
6. TDD the Member seam over both arms: Courses for an Exam with the right states, a Hidden Course listed only for its owner, the playback pass refused for locked, unavailable, replaced-device and no-token cases, the watermark carrying the requesting Member's email and short Member ID, another Member's ownership never readable.
7. TDD the screens: the Courses screen, a Course's page, the Lesson screen with the sample player, "This video isn't available yet" with no key.
8. e2e:
   - Bea (CE All-Access) opens Courses, sees "Surveying & Curves Lectures" IN YOUR PLAN, opens a Lesson and the sample player shows her watermark.
   - A Member with no pass sees it locked with "See plans", opens its list and plays the Free Preview Lesson.
   - "PSAD Masterclass" shows "Unlock for ₱1,499" and "HPGE Crash Course" shows "Not on sale right now".
9. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- Bea watches an included Lesson in the sample player with her email and Member ID moving across it.
- A Member with no Access Pass plays a Free Preview Lesson and sees the rest locked with "See plans".
- The sold-separately sample Courses show "Unlock for ₱1,499" and "Not on sale right now".
- A Member who owns a Course (fixture) watches it, including after Staff hide it.
Sad paths (each one needs a test):
- An Access Pass never opens a separately sold Course's Lessons ("locked").
- An ended Access Pass gives "expired" with "Renew access", progress kept.
- An Access Pass for another Exam doesn't open the Course.
- A Hidden Course is unavailable to non-owners, and an Unpublished Lesson to everyone, owners included.
- A playback pass is refused for a locked Lesson, a replaced device and no device token.
- The watermark always carries the requesting Member's own email and short Member ID.
- An Exam with no Visible Courses shows the empty state.
- With no key, Members see "This video isn't available yet" and no pass is requested.

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
- Don't add throwaway probe specs to e2e/.
- A new src/services/member.*.test.ts must be added to MEMBER_SUITES in vitest.config.ts.
- A new route can leave stale .next/types. Run `pnpm exec next typegen`.
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
- Authorisation stays on the server. Every Lesson read and every playback pass goes through the access decision; nothing on the client decides access.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (how the access decision takes Course facts, the routes, the Course Ownership shape) and follow-ups for tickets 04, 06 and 07
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
