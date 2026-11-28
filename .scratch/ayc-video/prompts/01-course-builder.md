# Executer prompt — 01 Course builder

Ticket: `.scratch/ayc-video/issues/01-course-builder.md` · Blocked by: none · Branch: `feat/phase5-video` (this ticket creates it from the tip of `feat/phase4-payments`; every Phase 5 ticket shares it)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Editors and Owners build video Courses in the Admin: Courses, their Modules and their Lessons, in the right order, before any video exists. Nothing shows in the Member App yet.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 5 → "Phase 5 planning decisions (added 2026-11-28)": A Course, Who does what, The Course builder, Hiding, unpublishing and deleting, Sample data
  - Testing Decisions → "Phase 5 seams" (Admin seam, extended)
  - Stories 156, 174, 175, 177, 179
- Read:
  - CONTEXT.md: Course, Module, Lesson, Course Ownership, Exam, Subject, Topic, Staff Role
  - docs/adr/0013-video-on-vdocipher.md
  - .scratch/ayc-video/grilling-notes.md, decisions 3, 5, 8, 14 and 15
  - .scratch/ayc-admin/CONVENTIONS.md
  - docs/mockup/admin/BUILD-MAP.md §3.7 "Courses & videos" (a reference; the spec wins where they differ)
- Existing pieces to follow:
  - The Admin seam: src/services/admin.types.ts, admin.ts, admin.mock.ts, admin.db.ts, admin.schema.ts, admin.rows.ts. Suites named src/services/admin.*.test.ts run over both arms (test/admin-arms.ts).
  - The content editors as the pattern: src/services/deck-editor.core.ts, quiz-editor.core.ts and content-editor.core.ts (activityRecord); src/lib/db/record-stamps.ts and src/components/admin/conflict-notice.tsx (the conflict check)
  - src/components/admin/move-buttons.tsx (▲▼), src/components/admin/typed-delete-dialog.tsx (typed DELETE), src/components/admin/content/topics-editor.tsx
  - Covers: the uploads seam (src/services/uploads.types.ts with UPLOAD_PURPOSES, uploads.ts, uploads.mock.ts, uploads.storage.ts) and src/components/admin/products/photo-strip.tsx
  - The Admin menu: src/components/admin/admin-menu.ts ("Member App content"); src/paths.ts
  - src/lib/admin/staff-activity-view.ts (the area labels)
  - The Exam and Subject delete rules (Phase 2 "unused" check) in the Admin seam
  - src/lib/db/schema.ts (the subjects table's key is exam_code + code) and src/lib/db/deny-all.db.test.ts
  - Sample data: src/services/mock/sample-store.ts, content.ts, catalogue.generated.ts (CE's Subjects are MSTC, HPGE, PSAD)
- **Where:** a "Courses & videos" screen in the Admin's content area (e.g. /admin/content/courses, with its menu item), for Editors and Owners.
- **The list:** "COURSES · N", each with its Exam, Lesson count and HIDDEN or VISIBLE, and "+ New course".
- **Course settings:**
  - title, description, an optional 16:9 cover (a new upload purpose on the uploads seam, same types and limits as photos)
  - the Exam, and one of that Exam's Subjects picked from a list (never typed, never a Topic)
  - "How members get it", shown read-only: "Included in {Exam} All-Access" (the default for a new Course) or "Sold separately · ₱{price}". Store the choice, a price (centavos, whole pesos) and On sale on the Course now. The Owner's switch and price editing come in ticket 06; this ticket offers no control for them to anyone.
  - Hidden by default
- **Modules:** "+ Module", the title edited in place, ▲▼ to reorder. A Module with Lessons can't be deleted until they're moved or deleted.
- **Lessons:** "+ Lesson", title, notes (plain text with line breaks), a Free Preview flag, ▲▼ within a Module, "Move to Module…".
  - Lesson state: every Lesson is "no video" in this ticket. Publish is refused with "ADD A VIDEO BEFORE PUBLISHING" (ticket 02 adds videos and the other states).
  - Deleting a Lesson needs typing DELETE: "{N} members lose their saved position in this lesson". Read N through a seam function that returns 0 until ticket 04 stores positions.
- **Visibility:** making a Course Visible needs at least one Published Lesson ("Needs at least one published lesson"), so every Course stays Hidden here.
- **Deleting a Course** removes its Modules and Lessons. (Ticket 06 adds the guard for owned or ordered Courses.)
- **Moving a Course to another Exam** needs a Subject of the new Exam.
- **An Exam or Subject with a Course** counts as used, so it can't be deleted.
- **Records:** every change is logged in Staff Activity under a readable "Courses" area (add the labels to the area map), with the conflict check used for decks and quizzes.
- **Sample data** (sample mode), no videos yet:
  - "Surveying & Curves Lectures" (CE · MSTC): included, 2 Modules, 5 Lessons, 1 Free Preview
  - "PSAD Masterclass" (CE · PSAD): sold separately at ₱1,499, on sale
  - "HPGE Crash Course" (CE · HPGE): sold separately, not on sale

SCOPE
Modify or add:
- src/lib/db/schema.ts: tables for Courses, Modules and Lessons (RLS on, no anon or authenticated policies, cascading from Course to Module to Lesson, Exam and Subject references that block deleting a used Exam or Subject); `pnpm db:generate`; keep deny-all.db.test.ts passing
- the Admin seam (types, arms, schema, rows) for Courses, Modules and Lessons; src/services/admin.courses.test.ts
- a pure view or rules module for the builder (e.g. src/lib/admin/courses-view.ts + test): ordering, the visibility and publish refusals, the move rules
- the uploads seam: a "course-cover" purpose (+ tests)
- src/app/admin/(shell)/content/courses/** (page and actions); components under src/components/admin/courses/ (+ component tests); the Admin menu item; src/paths.ts; the Staff Activity area labels (+ test)
- sample data for the three Courses (+ the sample-store test)
- e2e: e2e/admin/courses.spec.ts on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Member App, Orders and payments.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0013-video-on-vdocipher.md. Stop and report anything else.
   - `git switch feat/phase4-payments`, then `git switch -c feat/phase5-video`. If feat/phase5-video already exists, switch to it and confirm it contains the tip of feat/phase4-payments; otherwise stop and ask. Create no other branch.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), the spec sections and the mockup section above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, forms-validation, shadcn-ui, tailwind-v4, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure rules: Module and Lesson ordering after reorder and move, the Subject-belongs-to-Exam check, the visibility refusal, the publish refusal without a video, the Module delete refusal.
5. TDD the Admin seam over both arms: create, edit, reorder, move and delete Courses, Modules and Lessons; Staff Activity entries; the conflict check; the used Exam and Subject refusals; non-Staff refused; the cover upload purpose.
6. TDD the screens: the list, Course settings (with "How members get it" read-only), the Module and Lesson rows, the Lesson editor, the typed-DELETE dialog.
7. e2e: an Editor creates a Course for CE · PSAD, adds 2 Modules and 3 Lessons, reorders, moves a Lesson, renames a Module, reloads and sees the order; tries to make it Visible and sees "Needs at least one published lesson".
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Editor builds a Course with Modules and Lessons, in an order that holds after a reload.
- An Owner can do the same, and every change shows in Staff Activity under "Courses".
- The three sample Courses appear in sample mode with their Modules, Lessons and how Members get them.
Sad paths (each one needs a test):
- A Subject that isn't one of the Exam's Subjects is refused, on create and when moving the Course to another Exam.
- An empty or over-long title is refused (Course, Module, Lesson).
- Deleting a Module with Lessons is refused.
- Making a Course Visible without a Published Lesson is refused with "Needs at least one published lesson".
- Publishing a Lesson without a video is refused with "ADD A VIDEO BEFORE PUBLISHING".
- Deleting a Lesson without typing DELETE does nothing.
- A stale edit shows the conflict notice and changes nothing.
- An Exam or Subject with a Course can't be deleted.
- A cover of the wrong type or size is refused.
- Nobody can change "How members get it" in this ticket (no control is rendered, and the seam offers no write for it).
- Non-Staff are refused every builder action on the server.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables, SUPABASE_SECRET_KEY, both PAYMONGO_* variables and any VDOCIPHER_* variable blanked
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in. Make sure the copy has no leftover coverage/ or build output.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.
- A new route can leave stale .next/types. Run `pnpm exec next typegen`.
- Inline "use server" handlers must be async.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.
- Known failures on HEAD (check they fail without your change too, and report rather than fix): the sharp beforeAll timeouts (page-images.sharp, reviewer-reader), products-list.spec:173, the e2e overview promo-banner spec, and the database-arm member.payments / member.billing suites on PGlite.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase5-video. Create only that branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo, VdoCipher or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Only Staff build Courses; nothing about price or how Members get a Course is writable yet.
- Use the domain terms: Course, Module, Lesson (not "video" for the Lesson), Exam (not course).
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch (confirm it was created from the tip of feat/phase4-payments) and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the table shapes, the route, how "How members get it" is stored, the saved-position count seam) and follow-ups for tickets 02, 04 and 06
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
