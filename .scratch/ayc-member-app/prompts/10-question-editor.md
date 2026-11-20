# Executer prompt — 10 Question editor

Ticket: `.scratch/ayc-member-app/issues/10-question-editor.md` · Blocked by: 07, 09 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Editors and Owners add, edit, reorder and delete single quiz questions in the Admin, with a live formula preview and "Save & add next". It works the way ticket 07's card editor does.

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
- Ticket 07 built the card editor: the form, the live preview, "Save & add next", reorder, delete, and the rule that deleting the last card of a Visible deck makes it Hidden. Reuse its patterns and that rule. Don't copy and paste. Ticket 09 built the quiz tables, settings and the "removed" marker for questions.
- The question form:
  - fields: question, choices A–D, the correct choice, explanation, an optional figure (private bucket, through the upload seam's pattern)
  - every text field uses the formula notation
  - the live preview uses the shared renderer
- Deleting a question marks it removed rather than erasing it:
  - Members' old attempts still show it as "This question has since been removed" (ticket 11 shows them)
  - Best Scores aren't recalculated
  - the question no longer appears in the quiz
- Decision, already settled: deleting the last question of a Visible quiz makes the quiz Hidden automatically and says so, using ticket 07's rule.
- Every change goes in Staff Activity. Edits use the conflict check (record_stamps).

SCOPE
Modify or add:
- the Admin seam: question add, edit, reorder and delete (marked removed), both arms, and the behaviour suite
- the Admin quiz screen's question list and question form, with their actions and tests
- the Admin e2e spec
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Website, quiz import (ticket 09, apart from shared code you reuse), quiz taking (ticket 11). Add no migration unless a needed column is missing. Say why in your report.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0010-access-follows-the-exam.md. If anything else is uncommitted, stop and report.
   - Stay on the shared branch: `git switch feat/phase3-member-app`. If it's behind main, run `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a new branch.
   - Check the blocking tickets' work is present (see "Blocked by" above and CONTEXT). If it's missing, stop and ask. Don't build it yourself.
2. Read the files in CONTEXT, and find ticket 07's card editor and ticket 09's quiz tables.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, forms-validation, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the question rules as pure functions: required fields, exactly one correct choice A–D, formula validity, length limits, figure type and size.
5. TDD the seam (both arms):
   - add, edit and reorder
   - delete marks the question removed, keeps old attempts and Best Scores, and drops it from the quiz
   - deleting the last question makes the quiz Hidden
   - Staff Activity and the conflict check
6. TDD the screen: the live preview, "Save & add next", errors next to their fields.
7. e2e on the sample data: an Editor adds a question with maths, uses "Save & add next", reorders, and deletes one.
8. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Editor adds, edits, reorders and deletes questions with the live preview and "Save & add next".
- A deleted question no longer appears in the quiz, but is still there, marked removed, for a Member's old attempt.
- An Owner can do everything an Editor can here.
Sad paths (each one needs a test):
- Saving with no correct choice selected is refused.
- An empty choice is refused.
- A formula that won't render shows in the preview and is refused on save.
- A stale edit is stopped by the conflict check.
- Deleting the last question of a Visible quiz makes it Hidden and says so.
- Deleting a question doesn't change any Member's Best Score.
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
7. say how you reused the card editor's rules and form
8. the line "Nothing committed or pushed."
```
