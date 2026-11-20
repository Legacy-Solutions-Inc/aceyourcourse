# Executer prompt — 09 Quiz import and quiz settings

Ticket: `.scratch/ayc-member-app/issues/09-quiz-import-and-settings.md` · Blocked by: 06 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
An Editor imports a Subject's quizzes from a spreadsheet (CSV) plus a zip of figures. Before anything saves, they see a preview with row-level errors. Then they confirm, and the quizzes arrive Hidden. Each quiz has its own settings: passing score, shuffling, "show answers after", Free Preview, and Visible or Hidden.

CONTEXT
- Read first:
  - AGENTS.md and CONTEXT.md (Exam, Subject, Topic, Member, Staff, Access Pass, Free Preview, Card Mark, Best Score, Study Day, Active Device)
  - .scratch/ayc-admin/CONVENTIONS.md (the Staff Guard; sample, live and closed modes; Staff Activity; the conflict check)
  - the ticket: every checkbox is part of your acceptance criteria
  - docs/specs/2026-10-29-ayc-v1.md, Phase 3: the decisions, especially "Phase 3 planning decisions (added 2026-11-17)", and the "Phase 3 seams" block in Testing Decisions
  - ADR 0010 (with its 2026-11-17 amendment), ADR 0011 and ADR 0012
  - docs/mockup/member-app/BUILD-MAP.md (the screens named below)
- Earlier Phase 3 tickets built these. Find them in the code; don't invent paths and don't rebuild them:
  - the Member App shell and the beta gate (01)
  - consent (02)
  - Target Exams (03)
  - the Active Device check (04)
  - the content tables, the Access Pass record, the pure access decision and the Member seam, plus the Admin's Member App content area and the Topics editor (05)
  - the pure import planner and the shared formula renderer (06)
- Existing patterns to copy:
  - the Admin seam: src/services/admin.ts, admin.types.ts, admin.mock.ts, admin.db.ts, admin.schema.ts, with its per-area behaviour suites (src/services/admin.*.test.ts) and src/services/admin.db.test.ts
  - Admin forms: src/lib/admin/*-form.ts (for example faq-form.ts, review-form.ts)
  - the conflict check: record_stamps in src/lib/db/schema.ts
  - private uploads: the upload seam, src/services/uploads.ts, uploads.types.ts, uploads.storage.ts and uploads.mock.ts. A Staff-checked action hands the browser a one-time signed upload URL, the browser PUTs the file, and the save records the path.
- Migrations:
  - new tables go in a new file in supabase/migrations/ in the repo's existing style, generated from src/lib/db/schema.ts with `pnpm db:generate`
  - RLS on, and no anon or authenticated policies, like every other table
  - database tests run in CI only, and you never apply a migration to the hosted project
- Ticket 06 built the card import: the pure planner, the preview screen, the confirm action (all or nothing), the template download and the private image bucket. Extend that work for quizzes. Don't write a second import system.
- The quiz template has these columns: topic, question, choice A, choice B, choice C, choice D, correct answer (A–D), explanation, figure filename.
  - Every text field uses the formula notation: plain text with maths in $...$ or $$...$$, and \$ for a literal dollar sign.
  - The figure filename is optional.
- Row errors, each naming its row and column:
  - a missing required field
  - a missing choice
  - a correct answer that isn't A–D (including empty or "E")
  - a formula that won't render
  - a figure not in the zip
  - an unsupported figure type or size
  - an over-long field
- Topics are matched by name. Missing ones are created in order of first appearance, after the existing Topics, and the preview says when a name doesn't match ("did you rename it?").
- Re-importing a Topic that already has questions: choose Replace or Add.
  - Replace keeps every Member's Best Score and attempt history. Removed questions are kept, marked removed, so old attempts can still show them as "This question has since been removed". Ticket 11 shows them.
  - Add appends.
- Settings per quiz:
  - passing score: a whole number 1–100, default 70
  - shuffle questions: on or off
  - show answers after: on or off
  - Free Preview
  - Visible or Hidden: Visible is refused while the quiz is empty
- Confirming saves everything or nothing. Figures go to the private bucket, and quizzes arrive Hidden. Staff Activity records the import (counts per Topic) and each settings change.
- Settings edits use the conflict check (record_stamps).

SCOPE
Modify or add:
- ticket 06's planner, extended for quiz rows, with its tests
- a migration for the quiz and question tables if ticket 05 didn't add them all: settings, question order, and a "removed" marker for questions. Check first.
- the Admin seam: the quiz import confirm, quiz settings and Visible/Hidden, both arms, and the behaviour suite
- the Admin import screen (a quiz mode) and the quiz settings screen, with their actions and tests
- the downloadable quiz template
- the Admin e2e spec
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Website, the question editor (ticket 10), quiz taking (ticket 11).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0010-access-follows-the-exam.md. If anything else is uncommitted, stop and report.
   - Stay on the shared branch: `git switch feat/phase3-member-app`. If it's behind main, run `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a new branch.
   - Check the blocking tickets' work is present (see "Blocked by" above and CONTEXT). If it's missing, stop and ask. Don't build it yourself.
2. Read the files in CONTEXT, and find ticket 06's planner, preview, confirm and template code.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices (if you add a migration), forms-validation, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the planner for quiz rows: one test per row-error type, Topics created after a rename, and Replace vs Add, with removed questions marked and not deleted.
5. TDD the seam (both arms):
   - confirm all or nothing
   - Hidden on arrival
   - Replace keeping Best Scores and attempts. Seed an attempt in the test.
   - settings validation, Visible refused when empty, and Staff Activity
6. TDD the screens: the quiz template downloads, and importing it unchanged succeeds. The settings form shows field errors.
7. e2e on the sample data: an Editor imports a small quiz CSV plus zip, fixes a bad row after seeing the error, confirms, changes the passing score, and makes the quiz Visible.
8. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- A valid quiz CSV plus zip previews correctly and confirms into Hidden quizzes with their figures.
- Settings save and show on the quiz's Admin screen. The passing score defaults to 70%.
- Re-importing with Replace keeps Members' Best Scores and attempts. Add appends.
- The template downloads, and importing it unchanged succeeds.
Sad paths (each one needs a test):
- A correct answer of "E" or empty is a row error naming the cell.
- A missing choice is a row error.
- A figure not in the zip is a row error.
- A formula that won't render is a row error naming the row and column, and it doesn't crash the planner.
- A passing score of 0, 101 or "abc" is refused.
- Making an empty quiz Visible is refused, in the UI and on the server.
- Confirming a preview that has errors is refused on the server.
- A failure halfway through confirming saves nothing.
- A Member (non-Staff) posting these actions directly is refused.

VERIFICATION
Run each of these and show the last lines of its output:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked, as the e2e server has them
- `pnpm test:coverage`: the thresholds must still pass. Don't lower them.
- `pnpm test:e2e`: the Website, Admin and Member App projects, on the in-memory sample data
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run in LIVE mode against the hosted project:
  - never run Playwright against them, and never kill them
  - never run `pnpm build` in the working tree while they run
  - run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` before a full run, verify your own diff, and report the shared-tree results separately.
- Playwright silently skips the admin project when a website spec fails. Rerun with `--project=admin --no-deps`.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Git:
  - Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR.
  - Leave every change uncommitted on feat/phase3-member-app, and do NOT create a branch.
  - This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project or Vercel. Never change their data, settings or environment variables, and never apply a migration.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency without stopping to ask first. Name the exact package, version and licence.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo.
- Authorization stays on the server:
  - every Admin page and action calls the Staff Guard
  - every Member App read and write goes through the gate, consent, the Active Device check and the access decision
  - never trust the client or hidden fields
- Clean images (card images, quiz figures, Reviewer PDF pages and originals) are never public. Members only ever get short-lived signed URLs, or stamped pages, after an allowed read.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it. Mark the CI-only ones "CI only, not run here".
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you had to make, and follow-ups
6. each migration filename, with the line "Apply <migration> to hosted after merging (the user does this)", or "No migration"
7. say how removed questions are marked, for tickets 10 and 11
8. the line "Nothing committed or pushed."
```
