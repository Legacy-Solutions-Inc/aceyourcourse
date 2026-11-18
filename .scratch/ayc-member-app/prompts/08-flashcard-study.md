# Executer prompt — 08 Flashcard study

Ticket: `.scratch/ayc-member-app/issues/08-flashcard-study.md` · Blocked by: 05 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, React and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
A Member studies a Topic's flashcard deck in the Member App:
- one card at a time
- flip with a tap or space
- mark with a swipe or the arrow keys: Got it or Review again
- finish on a summary with "Review the N"
- reopen the deck where they left off

Their marks are saved on the server and count as Study Days.

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
- Mockup screens: flashcards, deckDone, expired and emptyTopic in docs/mockup/member-app/BUILD-MAP.md. Follow their layout and copy; where they disagree with the spec, the spec wins. Flashcards is a focus screen: a breadcrumb on desktop and a back bar on mobile.
- Card Mark: the latest verdict per Member and card, Got it or Review again. Stored as current state, not an event log (spec, "Progress storage").
- Study Day: marking a card records the Member's Asia/Manila date. Use the repo's Manila time helper (src/lib/manila-time.ts).
- The summary reads "41 of 48 got it · 7 to review again". "Review the 7" starts a session over just those cards. There's also a way back to the Library.
- Resume: the last position in each deck is stored per Member. Opening the deck offers to continue there.
- Protection:
  - every deck read goes through ticket 05's access decision on the server
  - a locked deck's cards are never sent to the browser
  - card images are signed URLs from the private bucket, valid about 10 minutes, handed out only as part of an allowed read
  - an overlay watermark shows the Member's email and short Member ID
  - text can't be selected
- States from the access decision:
  - locked: "🔒 Unlock with {Exam} All-Access". There are no Plans before Phase 4, so explain that access comes from AYC during the beta.
  - expired: renew, progress kept
  - device-replaced: Session ended
  - no token: "Use the Member App on this device"
  - unavailable (hidden mid-session): "no longer available", progress kept
  - an empty or Hidden deck: the Topic is still being prepared
- Free Preview progress carries over when an Access Pass starts. It's the same records, so make sure nothing resets them.
- Formulas render with ticket 06's shared renderer.

SCOPE
Modify or add:
- the Member seam: the deck read (through the access decision), mark a card, record a Study Day, read and save the deck position, the sample-data and database arms, and the behaviour suite (both arms)
- a migration for the Card Mark, Study Day and resume-state tables if ticket 05 didn't add them. Check first.
- the Member App deck player, the summary and the state screens, under /app, with their Server Actions and tests
- the Member App e2e spec
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Website, the Admin card editor (ticket 07), the dashboard (ticket 15).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0010-access-follows-the-exam.md. If anything else is uncommitted, stop and report.
   - Stay on the shared branch: `git switch feat/phase3-member-app`. If it's behind main, run `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a new branch.
   - Check the blocking tickets' work is present (see "Blocked by" above and CONTEXT). If it's missing, stop and ask. Don't build it yourself.
2. Read the files in CONTEXT, and find ticket 05's access decision and Member seam and ticket 06's renderer and image storage.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, react-expert, drizzle-data, supabase-postgres-best-practices (if you add a migration), secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure session logic: the order, flip state, marking, the summary counts and "Review the N".
5. TDD the seam (both arms):
   - marks, with the latest winning
   - a Study Day recorded once per Manila day
   - the resume position
   - reads refused for locked, expired, replaced and unavailable
   - signed image URLs only on an allowed read
6. TDD the player: keyboard (space, →, ←), touch (tap, swipe), the overlay watermark, no text selection, and the state screens.
7. e2e on the sample data:
   - a Member opens a Free Preview deck, flips and marks with the keyboard, finishes, uses "Review the N", leaves and reopens at the last card
   - a locked deck shows the unlock prompt
8. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- A Member studies a deck with the keyboard and with touch, and every mark is saved.
- The summary counts are right, and "Review the N" drills only those cards.
- Reopening the deck resumes at the last card.
- Marks made on Free Preview content are still there after an Access Pass starts.
- Formulas and card images show as on the printed cards, with the watermark overlay.
Sad paths (each one needs a test):
- A locked deck's cards are never in any response to the browser.
- An expired Access Pass shows renew, and the marks stay.
- A deck hidden mid-session shows "no longer available" on the next request.
- A mark from a replaced device is refused, with no change.
- Re-marking a card keeps only the latest mark.
- A card image URL stops working after it expires. Locked content never gets one.
- One Member's marks and positions never reach another Member.
- Hidden decks never appear.
- Marking twice on the same Manila day records one Study Day. A mark just after Manila midnight records the new day.

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
7. say which tables hold Card Marks, Study Days and the deck position, for ticket 15
8. the line "Nothing committed or pushed."
```
