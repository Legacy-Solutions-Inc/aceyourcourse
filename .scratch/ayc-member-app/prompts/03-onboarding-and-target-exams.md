# Executer prompt — 03 Onboarding and Target Exams

Ticket: `.scratch/ayc-member-app/issues/03-onboarding-and-target-exams.md` · Blocked by: 02 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15, TypeScript and Drizzle engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation, so this prompt is your complete brief. Follow it exactly and work test-first. Stop and ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
After consent, a new Member picks their Exam and Exam Date and starts their countdown. Members can:
- add more Target Exams
- switch between them
- edit each Exam Date
- remove one they no longer need, but never their last one

The shell shows the selected Target Exam wherever the mockup hardcodes CE.

CONTEXT
- Read first:
  - AGENTS.md and CONTEXT.md (Target Exam, Exam Date, Official Exam Date, Exam).
  - The spec, docs/specs/2026-10-29-ayc-v1.md:
    - Phase 3 → "Target Exams", and "Phase 3 planning decisions (added 2026-11-17)" → "Target Exams"
    - "The mockup's hardcoded CE labels"
    - "Time zone" (Asia/Manila)
    - stories 84–88 (the countdown only) and 133g
  - docs/mockup/member-app/BUILD-MAP.md: `newUser`, the exam switcher (§2) and `switchExam`.
  - The ticket: every checkbox is part of your acceptance criteria.
- What exists:
  - Tickets 01–02: the gate, consent, the Member seam, the /app layout and shell.
  - Exams and the Official Exam Date: exams in src/lib/db/schema.ts, and exam_pages.official_exam_date (date, nullable), edited by Staff in Admin → Exam pages (src/app/admin/(shell)/exam-pages/).
  - Which Exams are on the Website: listExams in src/services/catalogue.rules.ts (an Exam with a Product that's shown).
  - Manila time helpers: src/lib/manila-time.ts, with tests.
- Decisions for this ticket:
  - Following the Official Exam Date: a Target Exam stores the Member's own date only once they edit it. Until then, its Exam Date is read from the Exam's Official Exam Date at read time, so a Staff change moves everyone who never edited, with no fan-out job. Store a "date set by Member" value or null.
  - If the Exam has no Official Exam Date and the Member never set one, onboarding and the add form require a date.
  - Days left: Asia/Manila calendar days from today to the Exam Date.
    - 0 shows "Exam day".
    - A date in the past shows "Exam passed. Update your date in Account."
    - Make it a pure function with tests across Manila midnight.
  - Pickable Exams: those listExams would show on the Website. The pills are selectable buttons (this fixes the mockup bug).
  - Adding an Exam that's already a Target Exam:
    - if it was removed, it's restored, with its own date and progress
    - otherwise it's refused ("Already one of your exams")
  - Removing: a soft remove (a removed-at value). Refused for the Member's last active Target Exam, both in the UI and on the server. A confirmation dialog first.
  - The selected Target Exam is stored per Member. If it's removed, the selection falls back to the first remaining one, by the order added.
  - "+ Add an exam" in the switcher opens an add form in /app. Plans don't exist until Phase 4.
  - Account: create a minimal /app/account page with a "Your exams" section: each Target Exam with Edit date and Remove, plus "+ Add an exam". Ticket 18 builds the rest of Account. Give the section clear headings so it can be extended.
  - Per Target Exam: the sidebar badge, Home header and countdown label use the selected Exam's code and board. Grep the shell for any hardcoded "CE" and replace it.

SCOPE
Create or modify:
- the Member seam (both arms, one behaviour suite): addTargetExam, listTargetExams, setExamDate, removeTargetExam, selectTargetExam, and the restore on re-add
- src/lib/db/schema.ts (member_target_exams, and the selected Target Exam) and the generated migration
- the pure countdown and Exam Date resolver, with tests
- /app onboarding (shown after consent while the Member has no Target Exam), the switcher in the sidebar and drawer, the add form, /app/account "Your exams", and Home's countdown
- e2e: extend the Member App spec
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Admin's Exam pages (only read the Official Exam Date).

APPROACH
1. Pre-flight (below).
2. Read the files in CONTEXT.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure Exam Date resolver (Member date, Official date or none) and the days-left function.
5. TDD the seam operations, including the restore and the last-one refusal.
6. Add the table and migration with RLS on, and extend the deny-all test.
7. Build onboarding, the switcher, the add form and Account "Your exams", with component tests.
8. e2e:
   - onboard, see the countdown
   - add a second Exam and switch, and see the header change
   - edit a date
   - remove one, and the last one can't be removed
9. Verify, run requesting-code-review, fix the in-scope findings, and report.

ACCEPTANCE CRITERIA
Happy paths:
- A new Member picks an Exam, keeps the prefilled Official Exam Date or changes it, and sees the countdown on Home.
- Members add, switch and edit Target Exams. The sidebar badge, Home header and countdown follow the selected one.
- A Member who never edited follows a Staff change to the Official Exam Date. One who edited keeps theirs.
- Removing a Target Exam hides it from the switcher and Home. Adding it back restores its date (and, later, its progress and pass).
Sad paths (each one needs a test):
- Removing the last Target Exam is refused, in the UI and on the server.
- Adding an existing Target Exam is refused, or restores it if it was removed.
- An Exam with no Official Exam Date requires a date.
- A date in the past is refused when adding or editing.
- An Exam that isn't on the Website can't be picked, and posting it directly is refused.
- The countdown is right just before and just after Asia/Manila midnight.
- One Member can never read or change another Member's Target Exams.
- All of these actions refuse a gated Member and one who hasn't agreed to the Terms.

PRE-FLIGHT (APPROACH step 1)
- Run `git status`. The only uncommitted changes allowed are: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md, docs/adr/0010-access-follows-the-exam.md (the planner's docs), and the work of the earlier Phase 3 tickets named in "Blocked by". If anything else is uncommitted, stop and ask.
- `git switch feat/phase3-member-app`. If it's behind main, run `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a new branch.
- Check that each blocking ticket's work is present (its screens, seam functions and tables). If it's missing, stop and ask.

VERIFICATION
Run each of these and show its last lines:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked, as the e2e server has them.
- `pnpm test:coverage` (the thresholds must still pass; don't lower them).
- `pnpm test:e2e` (the Website, Admin and Member App specs, on the in-memory sample data).
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run in LIVE mode against the hosted project.
  - Never run Playwright e2e against them, and never kill them.
  - Never run `pnpm build` in the working tree while they run.
  - Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` before a full run, verify your own diff, and report the shared-tree results separately.
- Playwright silently skips the admin project when a Website spec fails. If that happens, rerun with `--project=admin --no-deps` and report both.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase3-member-app, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project or Vercel, and never change their data or settings. Write migration files only. The user applies them to hosted after merging.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency, and move none from devDependencies to dependencies, without stopping to ask first.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo. Use example.com addresses in tests and sample data.
- Authorisation stays on the server: the Staff Guard, the staff list, the Beta Tester list and the Member's own records decide. Never trust the client, hidden fields or user_metadata.
- Every Admin page and Admin Server Action still calls the Staff Guard. Every Member App page and Member App Server Action runs the Member App's server checks (the gate, and later tickets' consent and Active Device checks).
- Every new table has RLS on with no anon or authenticated policies (deny-all), and the deny-all database test covers it.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion, from this prompt and the ticket's checkboxes, marked ✅ or ❌ with the test that proves it. Mark the database-only ones "CI only, not run here".
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made, and follow-ups
6. each new migration filename, with the line "Apply <migration> to hosted after merging (the user does this)", or "No migration" if there is none
7. the line "Nothing committed or pushed."
```
