# Executer prompt — 06 Card import

Ticket: `.scratch/ayc-member-app/issues/06-card-import.md` · Blocked by: 05 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15, TypeScript and Drizzle engineer who writes careful parsers, working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation, so this prompt is your complete brief. Follow it exactly and work test-first. Stop and ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
An Editor imports a Subject's flashcards from a CSV plus a zip of images.
- A preview shows the Topics to create, the cards to add, replace or keep, and row-level errors naming the row and column, before anything saves.
- Confirming saves everything in one go, or nothing.
- New decks arrive Hidden, and missing Topics are created.
- A downloadable template is provided.

CONTEXT
- Read first:
  - AGENTS.md and CONTEXT.md (Topic, Card Mark, Staff Activity).
  - The spec, docs/specs/2026-10-29-ayc-v1.md:
    - Phase 3 → "Spreadsheet import"
    - "Phase 3 planning decisions (added 2026-11-17)" → "Formula notation in every text field", "Card back images and quiz figures", "Topics editor" (imports match Topics by name), "Corrections never cost progress"
    - Testing Decisions → "Pure modules" (the import planner)
    - stories 118, 120–124 and 133p
  - .scratch/ayc-admin/CONVENTIONS.md: the Staff Guard, Staff Activity, cache tags.
  - The ticket: every checkbox is part of your acceptance criteria.
- What exists:
  - Ticket 05: topics, decks (hidden or visible, free_preview), the access decision, and the Admin's Member App content → Topics screen.
  - The catalogue importer, src/lib/catalogue-import/ (parse.ts, rows.ts, build.ts, with tests). Prior art for reading CSV cells with csv-parse/sync and attaching sheet, row and column to errors (FieldError, SheetRow). Mirror its style.
  - The upload seam, src/services/uploads.ts / uploads.types.ts / uploads.storage.ts / uploads.mock.ts: a Staff-checked action hands the browser a one-time upload URL, and the browser PUTs the file. Today it covers public catalogue images (src/lib/catalogue-bucket.ts).
  - Vercel caps Server Action and request bodies at about 4.5 MB, so the zip must not go through a Server Action body.
- Dependencies: ask first before installing or moving any of these.
  - csv-parse is a devDependency today (used by scripts). Using it in the app at runtime means moving it to dependencies.
  - Reading a zip needs a library. Recommend fflate (MIT, small, no native code).
  - Rendering and validating formulas needs KaTeX (MIT). Recommend KaTeX, with its renderToString in throwOnError mode for validation.
  - Ask for all three in one message before you start the planner, and wait for the answer.
- Decisions for this ticket:
  - Card table: cards (deck, position, front, back, note, image path or null, front_hash for matching), with a cascade from decks.
  - Card Marks: if ticket 08 hasn't added them yet, Replace has nothing to keep yet. Design the replace so it keeps a card's id whenever its front text matches after trimming and collapsing whitespace, case-sensitive. A Card Mark keyed by card id then survives automatically. Test it by asserting that the card ids for unchanged fronts are kept.
  - The template: columns topic, front, back, note, image (filename). UTF-8 with a header row. Served as a CSV download from the import screen, with two example rows using `$...$` maths and one image filename.
  - The planner is pure. Input: the Subject's existing Topics and their cards, the parsed CSV rows, the list of zip entry names and sizes, and the mode for Topics that already have cards (Replace or Add). Output: Topics to create, per-Topic counts (add, replace, keep, remove), and errors, each with a row, column and message.
  - Row errors:
    - topic, front or back missing
    - a field over its limit: topic 120, front 500, back 2,000, note 1,000 characters
    - a formula that won't render: an unbalanced `$` or a KaTeX parse error, naming the column
    - an image filename not in the zip
    - an image that isn't JPEG, PNG or WebP, or is over 5 MB
  - File-level errors: a missing or unknown header; an empty CSV (no data rows); a file that isn't UTF-8 CSV; a zip over 200 MB; a zip entry with a path that climbs out ("..") or is absolute, which is refused rather than skipped.
  - Formula notation: plain text with maths in `$...$` (inline) or `$$...$$` (block). `\$` is a literal dollar. Write a pure splitter (text → text and maths segments) with tests, and validate each maths segment with KaTeX. The same splitter and renderer will be used by the Member App and the card editor, so put it in a shared module (for example src/lib/formula/).
  - Topic matching: by name within the Subject, after trimming and ignoring case. A new name creates a Topic after the existing ones, in order of first appearance. When a new Topic's name is close to an existing one (ignoring case and spacing, or within a small edit distance), the preview flags "did you rename it?". This is advice only, not an error.
  - Replace vs Add, per run for Topics that already have cards:
    - Replace: cards whose normalised front matches an existing card keep their id and take the new back, note and image. Unmatched existing cards are removed, and unmatched new rows are added.
    - Add: append after the existing cards.
    - Topics without cards always add.
  - Files:
    - The browser uploads the CSV and zip through new upload purposes to a private "content" bucket (not the public catalogue bucket), using one-time upload URLs. A migration creates the bucket as private, mirroring the catalogue bucket migration.
    - The plan action reads both from Storage on the server, builds the preview, and keeps nothing else.
    - Confirming re-reads and re-plans. It refuses if the plan has errors or if the existing cards changed since the preview (the conflict check).
    - It saves in one transaction, copies the images to their card paths in the content bucket, and deletes the uploaded import files afterwards.
    - Images are private, and later reads use signed URLs (ticket 08).
  - Sample mode: the mock arm keeps uploads in memory as uploads.mock.ts does, so e2e can import a small fixture CSV and zip.
  - New decks are Hidden. Staff Activity records one entry per import (Subject, mode, per-Topic counts), not one per card.
  - The screen: in Member App content, on the Subject, an "Import cards" button opens the import screen.
    - Pick the files, then "Check file". The preview shows counts per Topic, the rename hints and the errors table.
    - "Import" is disabled while there are errors.
    - Then a success summary with links to the decks.

SCOPE
Create or modify:
- the shared formula module (splitter and validation) with tests
- the pure card-import planner (src/lib/member-content-import/ or similar) with tests
- src/lib/db/schema.ts (cards) and the generated migration, plus a migration for the private content bucket
- the upload seam: new purposes for import files and card images in the private bucket (both arms)
- the Admin seam: planCardImport and confirmCardImport (both arms, one suite), with Staff Activity and cache tags
- the Admin import screen, the template download, and their tests
- e2e: an Editor imports a fixture CSV and zip into a CE Subject, sees the Topics created and the decks Hidden; a CSV with errors shows them and can't be imported
- e2e fixtures under e2e/fixtures/ (tiny CSVs, a tiny zip)
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the catalogue importer (reuse its ideas, not its code paths).

APPROACH
1. Pre-flight (below).
2. Read the files in CONTEXT. Ask about the three dependencies, and wait.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the formula splitter and validator: plain text, inline, block, `\$`, unbalanced, and a KaTeX error.
5. TDD the planner: a valid file; each row error with its row and column; each file error; a new Topic and a rename hint; Replace keeping ids for unchanged fronts; Add appending.
6. TDD the seam's confirm: all or nothing (force a failure halfway and assert nothing changed), the conflict check, Hidden decks, Staff Activity, cache tags.
7. Add the migrations: cards with RLS on, and the private bucket. Extend the deny-all test.
8. Build the screen and template download, with component tests.
9. Write the e2e.
10. Verify, run requesting-code-review, fix the in-scope findings, and report.

ACCEPTANCE CRITERIA
Happy paths:
- A valid CSV and zip preview correctly. Confirming creates the missing Topics, Hidden decks and cards, with images stored privately.
- Re-importing with Replace keeps the ids (and so the Card Marks) of cards with unchanged fronts. Add appends.
- The template downloads, and importing it unchanged with its example image succeeds.
Sad paths (each one needs a test):
- each row error type, with the row and column named
- a missing or unknown header
- an empty CSV
- a file that isn't a CSV
- a zip over the limit, or with a "../x.png" or absolute entry
- a formula like `$\frac{1}{$` reported as an error, not crashing
- a literal `\$` accepted
- confirming a plan with errors is refused on the server
- a failure halfway saves nothing
- cards changed since the preview are caught by the conflict check
- a Member, or a signed-out person, posting the import actions is refused
- the uploaded files are never publicly reachable

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
