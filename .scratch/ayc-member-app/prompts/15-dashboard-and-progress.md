# Executer prompt — 15 Dashboard and progress

Ticket: `.scratch/ayc-member-app/issues/15-dashboard-and-progress.md` · Blocked by: 08, 11, 14 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Home becomes the dashboard for the selected Target Exam. It shows the days left, "Continue where you left off", the Study Streak (current, best, last 7 days), progress per Subject, and the 3 weakest Topics with "Review cards" and "Retake quiz". The Library shows the Member's % per Topic. All the numbers come from one pure progress calculator.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 3 → "Progress calculator" (Topic %, Subject %, quiz average, Weak Topic, Study Day, Study Streak), "Resume state", "The mockup's hardcoded CE labels"
  - "Phase 3 planning decisions (added 2026-11-17)" → "Progress storage" (current-state records, not an event log), "Resume", "Corrections never cost progress" (Hidden or Draft content never counts in denominators)
  - Testing Decisions → "Seam 3, Progress calculator" and "Phase 3 seams"
  - Stories 88–93.
- Read CONTEXT.md (Study Streak, Study Day, Card Mark, Best Score, Weak Topic, Target Exam) and docs/mockup/member-app/BUILD-MAP.md §3 "Dashboard (L155–226)", "Loading (L493–501)" and "Library (L228–261)".
- Earlier Phase 3 tickets created the records you read. Find them in the code, and don't invent paths:
  - Card Marks, deck resume and Study Days (08)
  - Quiz Attempts and Best Scores (11)
  - Reviewer pages viewed and Reviewer PDF resume (14)
  - Target Exams and the countdown (03)
  - the content tables, Visible or Published status and the Library (05)
  - the Member seam (sample and database arms)
- **The calculator** is pure and takes the current-state records and the content (counts of Visible cards, Visible quizzes and their passing scores, Published page counts):
  - **Topic %:** the mean of the components present: share of cards marked Got it, Best Score %, share of pages viewed. A missing component isn't counted as 0.
  - **Subject %:** the mean of its Topic % over Topics with any Visible or Published content.
  - **Quiz average:** the mean of Best Scores across quizzes taken.
  - **Weak Topic:** Best Score below the quiz's passing score, or 5 or more cards marked Review again. Show the 3 lowest by Topic %, lowest first.
  - **Study Streak:** consecutive Asia/Manila Study Days, current (ending today or yesterday) and best, plus the last 7 days as on or off. Use src/lib/manila-time.ts.
  - Hidden or Draft content is left out everywhere.
- **The dashboard:**
  - the countdown (from 03)
  - "Continue where you left off": the last deck and the last Reviewer PDF page, each a link
  - the streak card, and the sidebar streak button "▲ N-DAY STREAK … STUDY TODAY"
  - per Subject: %, cards marked, quiz average. "Lessons done" is hidden until Phase 5.
  - weak Topics linking to their deck ("Review cards") or quiz ("Retake quiz")
  - a starter state for a Member with no study yet
  - the mockup's loading skeleton while it loads
- **Expired access** keeps progress visible (the spec: progress is never deleted).
- Expose the per-Member summary through the Member seam in a shape ticket 16's Member detail page can reuse.

SCOPE
Modify or add:
- the pure progress calculator and its tests
- the Member seam (both arms): a dashboard read and a per-Topic % read for the Library, with tests
- the Home or dashboard screen and the Library's % display, with component tests
- e2e: extend the Member App journey on the in-memory sample data
No migration is expected. If one seems needed, stop and ask.
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Admin, the Website.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0010-access-follows-the-exam.md. Stop and report anything else.
   - `git switch feat/phase3-member-app`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that tickets 08, 11 and 14 are present. If they're missing, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), the spec sections and the mockup screens above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the calculator over small fixtures, one rule per test (see the sad paths).
5. TDD the Member seam reads against both arms, including another Member's records never being counted.
6. TDD the dashboard and Library %, including the starter and loading states.
7. Extend the e2e: a sample Member with marks, a quiz attempt and pages viewed sees the expected %, streak and weak Topics, and "Continue" opens the last deck.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- The dashboard shows the right countdown, streak, Subject %, quiz average and weak Topics for a sample Member with cards, quizzes and pages in progress.
- "Continue where you left off" opens the last deck position and the last Reviewer PDF page.
- The Library shows each Topic's %.
- Switching Target Exam switches the dashboard. The streak is account-wide.
Sad paths (each one needs a test, pure over fixtures where possible):
- Re-marking a card counts only the latest mark.
- The Best Score is used, not the latest attempt.
- A Topic missing a deck, quiz or Reviewer PDF averages only what's present.
- Exactly the passing score is not weak. Exactly 5 Review again marks is weak.
- A streak across Asia/Manila midnight. A gap day breaks it. The best streak is kept.
- An empty history gives the starter state, not NaN or zeros.
- Hidden or Draft content is left out of every denominator.
- Fewer than 3 weak Topics shows only those, and none hides the section or shows "No weak Topics".
- Expired access keeps progress visible.
- One Member's records never count for another.

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
- Never connect to the hosted Supabase project or Vercel.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Every Member App read goes through the gate, consent and Active Device checks. One Member's data never reaches another.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (for example the weak-Topic ordering and the empty states), the summary shape you exposed for ticket 16, and follow-ups
6. "No migration" (or why one was needed, after asking)
7. the line "Nothing committed or pushed."
```
