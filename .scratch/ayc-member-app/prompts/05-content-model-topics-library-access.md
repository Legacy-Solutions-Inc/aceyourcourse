# Executer prompt — 05 Content model, Topics editor, Library and the access decision

Ticket: `.scratch/ayc-member-app/issues/05-content-model-topics-library-access.md` · Blocked by: 03, 04 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15, TypeScript and Drizzle engineer with strong domain-modelling habits, working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation, so this prompt is your complete brief. Follow it exactly and work test-first. Stop and ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
- The Library lists every Subject and Topic of the selected Target Exam. Each Topic's deck, quiz and Reviewer PDF shows as open, Free Preview, or locked "🔒 Unlock with {Exam} All-Access".
- Editors manage each Subject's Topics in the Admin.
- One server-side access decision, built here, decides every protected read from now on.

CONTEXT
- Read first:
  - AGENTS.md and CONTEXT.md: Exam, Subject, Topic, Reviewer PDF, Access Pass, Free Preview, Active Device, Staff, Beta Tester.
  - ADRs 0010 (access follows the Exam, and its 2026-11-17 amendment: active Staff see Visible content without a pass) and 0011.
  - The spec, docs/specs/2026-10-29-ayc-v1.md:
    - Phase 3 → "Content model", "Access decision seam" (the rule and its outcomes), "Phase 3 planning decisions (added 2026-11-17)" → "Topics editor", "Staff in the Member App", "Corrections never cost progress"
    - Testing Decisions → "Seam 2, Access decision" and "Phase 3 seams"
    - stories 93, 94, 103, 133i, 133m and 133n
  - docs/mockup/member-app/BUILD-MAP.md: `library`, `emptyTopic`, `expired`.
  - .scratch/ayc-admin/CONVENTIONS.md: the Staff Guard, Staff Activity, the conflict check, cache tags.
  - The ticket: every checkbox is part of your acceptance criteria.
- What exists:
  - Tickets 01–04:
    - the gate, consent and the Member seam
    - Target Exams and the selected Target Exam
    - deviceStatus ("active" | "no-token" | "replaced")
  - Exams and Subjects: exams and subjects in src/lib/db/schema.ts, managed in Admin → Exam pages (ticket 23 of Phase 2: exam-manage, MAX_EXAMS in catalogue.schema).
  - Ticket 23's delete rules: an Exam or Subject can be deleted only when no Product uses it. Its spec note says "In Phase 3, Reviewers, decks and quizzes also block a delete." Find that rule in the Admin seam and extend it.
  - Admin seam conventions: src/services/admin.ts (contract), admin.mock.ts and admin.db.ts, and the per-area test suites (admin.exams.test.ts and friends).
  - Asia/Manila helpers: src/lib/manila-time.ts.
- Decisions for this ticket:
  - Tables:
    - topics (Subject, name, position; name unique within its Subject, case-insensitive)
    - decks, quizzes and reviewer_pdfs, each at most one per Topic, with a visibility or status column and free_preview
      - decks and quizzes: hidden or visible; the default is hidden
      - reviewer_pdfs: processing, draft, published, unpublished or failed; add only the record and status here, and ticket 12 adds the job fields
    - access_passes: one per Member per Exam, with ends_at (timestamptz)
    - access_pass_grants: the history (Member, Exam, days, starts and ends, reason, granted by). Add the table now, empty; ticket 17 writes it.
    - Card and question tables come in tickets 06 and 09. Don't add them here.
  - The access decision is a pure function. Its inputs:
    - gate open?
    - device status
    - content: Exam, visible or published, free preview
    - Member: active Staff?, Access Pass ends_at for that Exam or none
    - now

    Its outcomes are allowed, locked, expired, device-replaced, no-token, unavailable and not-open-yet. Order:
    1. not-open-yet (gate)
    2. device (no-token / device-replaced)
    3. unavailable (Hidden or not Published)
    4. allowed if Free Preview, active Staff, or a pass with ends_at later than now
    5. otherwise expired if a pass exists, or locked if not

    Add a server function that gathers the inputs for the signed-in Member and the content. Every protected read from ticket 06 on calls it. Nothing may read content around it.
  - "Active Staff" comes from the staff list on every call, as the Staff Guard does. A removed Staff User is a Member.
  - The Library (/app/library, nav item 02):
    - Subjects of the selected Target Exam, in Subject order, each with its Topics in position order
    - each Topic shows the content types it has (Visible decks and quizzes, Published Reviewer PDFs only), each with open, Free Preview or 🔒 "Unlock with {Exam} All-Access"
    - a Topic with nothing visible reads "Content for this Topic is still being prepared" (mockup `emptyTopic`)
    - no Plans exist before Phase 4, so the lock links to a short explanation: "During the beta, access comes from AYC. Ask us at {contact email}."
    - leave a placeholder for per-Topic %, filled by ticket 15
    - the heading uses the selected Exam
  - Opening a content item: for now, a placeholder "Opening soon" screen that already runs the access decision and shows the right state:
    - locked: the unlock prompt
    - expired: "Your access ended. Your progress is kept." (mockup `expired`)
    - unavailable: "This is no longer available. Your progress is kept."
    - the device and gate screens from earlier tickets

    Tickets 08, 11 and 14 replace the placeholder.
  - The Topics editor (Admin, Editors and Owners): a "Member App content" area in the Admin menu, with an Exam → Subject picker and that Subject's Topics list.
    - Add (name 1–120 characters), rename, move up or down (reuse move-buttons.tsx), and delete.
    - Delete is enabled only when the Topic has no deck, quiz or Reviewer PDF. Otherwise the reason replaces the button, in the same way ticket 23 handles deletes.
    - Every change writes Staff Activity and returns the right cache tags. Rename uses the conflict check.
  - Delete blockers: an Exam or Subject with any Topic content (deck, quiz or Reviewer PDF) can't be deleted, and the reason names what blocks it.
  - Sample data: add Topics for at least CE (two Subjects, a few Topics each) with a mix of Visible, Hidden, Free Preview and empty items, and sample Access Passes:
    - the Beta Tester has an active CE pass
    - the stranger has none
    - an expired-pass Member

    Keep it small. Later tickets add cards, questions and pages.

SCOPE
Create or modify:
- src/lib/db/schema.ts (topics, decks, quizzes, reviewer_pdfs, access_passes, access_pass_grants) and the generated migration
- the pure access decision and its server wrapper, with tests
- the Member seam: the Library read, the content-item state read, and the Access Pass read (both arms, one suite)
- the Admin seam: Topics CRUD and reorder, and the extended Exam/Subject delete blockers (both arms, one suite each)
- /app/library and the placeholder content-item route
- the Admin's Member App content → Topics screen, and the menu entry
- the sample data (mock store and seed) for Topics, content records and passes
- e2e: Member App Library (tester sees CE open, stranger sees locked plus Free Preview), and Admin Topics (add, rename, reorder, delete when empty)
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Website.

APPROACH
1. Pre-flight (below).
2. Read the files in CONTEXT.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the access decision as one table covering every outcome and its order.
5. TDD the seams.
6. Add the tables and migration with RLS on, and extend the deny-all test. Add a foreign key from each content table to topics (ON DELETE RESTRICT), so the database also blocks deleting a non-empty Topic.
7. Build the Library and placeholder screens, and the Admin Topics screen, with component tests.
8. Write the e2e.
9. Verify, run requesting-code-review, fix the in-scope findings, and report.

ACCEPTANCE CRITERIA
Happy paths:
- A Member with no pass sees Free Preview open and the rest locked. One with an active CE pass sees CE content open.
- Active Staff with no pass see every Visible or Published item open.
- Editors add, rename, reorder and delete empty Topics, and the Library follows the order and names.
- Opening any item shows the state the access decision gives.
Sad paths (each one needs a test). In the access decision table:
- a pass for another Exam
- a pass ending today, just before and just after its ends_at, and across Asia/Manila midnight for display
- an expired pass (expired, not locked)
- Hidden or unpublished content for a Member and for Staff (unavailable)
- a replaced device
- no token
- the gate closed for a non-tester
- a removed Staff User treated as a Member
Also:
- deleting a non-empty Topic is refused in the UI, on the server and in the database
- a duplicate Topic name in the same Subject is refused, ignoring case
- an Exam or Subject with Topic content can't be deleted, and the reason says why
- Editors can manage Topics. A Member or a signed-out person posting the Topics actions is refused.
- Hidden items never appear in the Library

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
