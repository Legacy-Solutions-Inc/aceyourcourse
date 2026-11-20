# Executer prompt — 11 Quiz taking

Ticket: `.scratch/ayc-member-app/issues/11-quiz-taking.md` · Blocked by: 05 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, React and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
A Member takes a Topic's practice quiz in the Member App:
- one question at a time, going back before submitting, with no time limit
- the server marks it
- they see their score; the missed questions with the right answers and explanations, when the quiz allows it; their Best Score; and their previous attempts

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
- Mockup screens: quizStart, quiz, score, expired and emptyTopic in docs/mockup/member-app/BUILD-MAP.md. The spec wins where they disagree.
- Marking on the server (spec, "Quizzes are graded on the server"):
  - question reads never include the correct choice or the explanation
  - Submit sends the answers. The server scores them, saves the Quiz Attempt (score and answers), updates the Best Score only if it's higher, and records a Study Day (Asia/Manila; use src/lib/manila-time.ts).
- Decisions, already settled:
  - a submit with a missing answer scores that question as wrong
  - a submit that names a question ID not in the quiz refuses the whole submit, with no attempt saved
  - a double submit (the same attempt posted twice) saves one attempt; use an attempt token or idempotency key
- The score screen:
  - the score, and pass or fail against the quiz's passing score
  - "show answers after" on: each missed question with the Member's answer, the correct answer and the explanation
  - "show answers after" off: only the score and which questions were missed, with no correct answers or explanations anywhere in the response
  - "Retake" and back to the Library
- Shuffle: when the quiz says so, the question order is shuffled per attempt.
- Previous attempts: listed with date and score, and each can be reviewed under the same "show answers after" rule. A question removed since (ticket 09/10's marker) shows "This question has since been removed". Retakes use the current questions.
- Protection and states, the same as the flashcard player (ticket 08):
  - every read and submit goes through the access decision
  - figures are signed URLs (about 10 minutes) on allowed reads only
  - overlay watermark and no text selection
  - locked, expired, device-replaced, no token, unavailable and empty states
- Ticket 09 builds quiz import and settings, and may land before or after you. If quiz content and settings are missing, use the content tables and sample data from ticket 05, and stop and ask if the quiz settings columns don't exist yet.

SCOPE
Modify or add:
- the Member seam: the quiz read (without answers), submit and grade, attempts list and review, Best Score, and Study Day. Sample-data and database arms, and the behaviour suite (both arms).
- a migration for the Quiz Attempt table if ticket 05 didn't add it. Check first.
- the Member App quizStart, quiz and score screens and the attempt review, with their Server Actions and tests
- the Member App e2e spec
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Website, the Admin quiz screens (tickets 09 and 10), the dashboard (ticket 15).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0010-access-follows-the-exam.md. If anything else is uncommitted, stop and report.
   - Stay on the shared branch: `git switch feat/phase3-member-app`. If it's behind main, run `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a new branch.
   - Check the blocking tickets' work is present (see "Blocked by" above and CONTEXT). If it's missing, stop and ask. Don't build it yourself.
2. Read the files in CONTEXT, and find ticket 05's access decision, Member seam and content tables.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, react-expert, drizzle-data, supabase-postgres-best-practices (if you add a migration), secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure grader:
   - score from answers
   - missing answers count as wrong, and an unknown question ID refuses the submit
   - pass or fail at exactly the passing score
   - Best Score only rises
   - the review payload with "show answers after" on and off
   - removed questions in old attempts
5. TDD the seam (both arms):
   - the question read never contains the correct choice or explanation (assert on the serialised payload)
   - submit saves one attempt even when posted twice
   - a Study Day is recorded
   - refusals for locked, expired, replaced and unavailable
   - one Member's attempts never reach another
6. TDD the screens: Back and Next, unanswered questions flagged before Submit, shuffle per attempt, the score screen in both modes, the attempts list.
7. e2e on the sample data: a Member starts a Free Preview quiz, answers, goes back to change an answer, submits, sees the score and review, retakes with a lower score, and still sees the higher Best Score.
8. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- A Member takes a quiz, goes back to change an answer, submits, and sees the score and review.
- A lower retake keeps the higher Best Score. Attempts are listed and each can be reviewed.
- A shuffled quiz shows a different order per attempt and still scores correctly.
Sad paths (each one needs a test):
- No question payload ever contains the correct choice or the explanation.
- A forged submit for a locked quiz is refused, with no attempt saved.
- A submit with a missing answer scores it as wrong. A submit with an unknown question ID is refused, with no attempt saved.
- A double submit saves one attempt.
- With "show answers after" off, no response contains the correct answers or explanations.
- A removed question in an old attempt shows "This question has since been removed".
- A submit from a replaced device is refused.
- One Member's attempts never reach another Member.
- Exactly the passing score counts as a pass.

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
7. say which tables hold Quiz Attempts and Best Scores, for ticket 15
8. the line "Nothing committed or pushed."
```
