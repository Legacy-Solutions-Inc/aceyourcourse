# Executer prompt — 23 Add Exams and Subjects

Ticket: `.scratch/ayc-admin/issues/23-add-exams-and-subjects.md` · Blocked by: none (20–22 done) · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Drizzle engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Owners add a new Exam, with its Subjects, in Pages & promo → Exam pages. They add Subjects to any Exam, and delete an Exam or a Subject that nothing uses yet.
- A new Exam reaches the Website once one of its Products is on the Website.
- Every Website list of Exams fits 1–12 Exams.

CONTEXT
- Why: the client contract's Milestone 2 says the client edits all the content themselves. Today the five Exams (CE, ME, EE, MT, CPA) can only be added by a developer through the catalogue spreadsheet. The spec planned "+ Add exam" for Phase 3. On 2026-11-05 it moved into Phase 2, for Owners only.
- What the code already supports (verify each before relying on it):
  - An Exam's code is a text primary key, not an enum (src/lib/db/schema.ts, `exams`). Subjects and Exam pages reference it with cascade. Products reference it with no onDelete (schema.ts:92), so Postgres refuses to delete an Exam that has Products. No migration is needed. If you find you need one, stop and ask.
  - The Website reads the Exam list from listExams() in src/services/catalogue.rules.ts: only Exams with a Product on the Website, Live or Coming Soon. `/exams/[code]` answers 404 for any other Exam (src/app/(website)/exams/[code]/page.tsx:18).
  - An Exam with no Exam page record gets examPageDefaults (src/services/catalogue.schema.ts:287): every section shown, nothing else set.
  - The Admin's database arm syncs every catalogue table by key, Exams and Subjects included (CATALOGUE_TABLES in src/services/admin.db.ts:204). Check that it inserts and deletes rows, not only updates them.
  - The sample arm re-validates the whole catalogue with validateCatalogueSeed before committing a write.
  - The Product editor's Exam picker reads listExamsForAdmin (src/services/mock/admin/products.ts:271).
- Today's Exam page editing, which you extend:
  - The seam is src/services/mock/admin/exam-pages.ts: updateExamHeader, updateSubjectNames (with its "codes fixed" refusal), setExamSection and the rest. Staff Activity entity "exam", for example action "rename-subjects". Tags: CATALOGUE_TAGS.exams.
  - The screen is src/app/admin/(shell)/exam-pages/page.tsx and actions.ts, src/lib/admin/exam-pages-view.ts, and src/components/admin/exam-pages/: exam-pages-columns.tsx (the Exam chips, and "Exam pages × N"), exam-page-panel.tsx and exam-page-editors.tsx.
  - The rules are in src/services/admin.schema.ts: HEADER_FIELDS (name 60, long name 120, text 600, made for 160) and SUBJECT_NAME (120).
  - Owner-only actions use adminAction({ role: "owner", schema }) from src/lib/admin/action.ts, as Settings does. The seam checks the role too.
- Where the Website lists Exams. Each one must fit 1–12 Exams on desktop and mobile:
  - src/components/website/exams-menu.tsx:85 and mobile-nav.tsx:65 are fixed `grid-cols-5` today
  - site-nav.tsx and site-footer.tsx
  - home/: find-your-exam.tsx, hero.tsx and formats.tsx
  - products/filter-bar.tsx
  - reviews/review-wall-filters.tsx
  - faq/coverage-table.tsx
  - about/about-cta.tsx
  - exam/: exam-switcher.tsx and exam-hero.tsx
  - Search for any others.
- Decisions (spec, Phase 2 → "Adding Exams and Subjects (added 2026-11-05)"):
  - Who: Owners only. Editors see no add or delete controls, and keep editing everything else.
  - Where:
    - a "+ Add exam" chip after the last Exam chip, opening the form in the editor column at `?page=exam&add=exam`. Saving opens the new Exam's Header (`?exam=<code in lower case>&section=header`).
    - "+ Add subject", and a remove button on each Subject, in the Subjects covered editor
    - "Delete exam" at the foot of the Header editor
  - The form: the code, the board acronym, the name, the long name, the text, the "made for" line, and at least one Subject (code and name), with room to add more before saving.
  - Rules:
    - Exam code: 2–6 letters A–Z, trimmed and saved in capitals, unique among the Exams.
      - Messages: "USE 2–6 LETTERS" and "<CODE> IS ALREADY AN EXAM".
      - It's fixed once saved.
      - The address is paths.exams.details(code), `/exams/<lower case>`.
    - Board acronym: 2–10 letters A–Z, saved in capitals, fixed once saved. Use the code's message pattern ("USE 2–10 LETTERS").
    - Name, long name, text and made for: required, with HEADER_FIELDS' limits and messages.
    - Subject code: 1–20 characters of A–Z, 0–9, spaces and "&", trimmed and saved in capitals, unique within its Exam, fixed once saved. Today's codes include "EE PROF" and "CLIN MIC & PARA".
    - Subject name: SUBJECT_NAME's rule.
    - At most 12 Exams. A 13th is refused with "UP TO 12 EXAMS. Ask the developer to raise the limit." Define the 12 once.
  - A new Exam:
    - goes last: position = the largest + 1, with no reordering
    - starts with every Exam page section shown, no bundle offer and no Official Exam Date
    - In the Admin, while it has no Product on the Website:
      - its chip shows "NOT ON SITE"
      - "View page ↗" is replaced by "<CODE> isn't on the Website yet. It shows once one of its Products is on the Website."
    - "Exam pages × N" counts it
  - Deleting:
    - An Exam only while no Product of any state or visibility belongs to it. Its Subjects and Exam page record go with it.
    - A Subject only while no Product is tagged with it.
    - Otherwise the reason replaces the button, for example "2 Products belong to CHE. Move or delete them first." or "1 Product uses MSTC. Remove it from that Product first."
    - The confirmation is in the page (follow the Admin's existing in-page confirms), never window.confirm.
  - Staff Activity: entity "exam" with the Exam's code as entityId, and actions add, delete, add-subject and delete-subject, each with before and after.
  - Tags: adding an Exam or a Subject clears CATALOGUE_TAGS.exams. Deleting an Exam also clears examPages. Check which other tags a deleted Exam touches.
- Vocabulary: CONTEXT.md says Exam, never "course". The mockup's Uploads screen says "+ Add course" (docs/mockup/admin/BUILD-MAP.md, around line 244). Don't copy that word.

SCOPE
Modify, adding new files beside them where the pattern does:
- the Exam pages area of the Admin seam: admin.ts, admin.types.ts, admin.schema.ts, admin.mock.ts, mock/admin/exam-pages.ts, and admin.db.ts only if its sync needs it
- the Pages & promo screen: exam-pages-view.ts, page.tsx, actions.ts, and the components in src/components/admin/exam-pages/ (a new add-exam form component is fine)
- the Website's Exam lists named in CONTEXT, for 1–12 Exams
- the tests, and e2e/admin/exam-pages.spec.ts (or a new e2e/admin/add-exam.spec.ts)
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, supabase/migrations/, src/lib/db/schema.ts.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are uncommitted changes outside .scratch/.
   - Stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md (Exam, Subject, Staff Role)
   - .scratch/ayc-admin/CONVENTIONS.md
   - the ticket, .scratch/ayc-admin/issues/23-add-exams-and-subjects.md: every checkbox is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: stories 80d and 80e, and Phase 2 → "Adding Exams and Subjects (added 2026-11-05)"
   - docs/mockup/admin/BUILD-MAP.md §3.2
   - the files in CONTEXT
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, forms-validation, drizzle-data, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the rules: the add-exam form schema, the add-subject schema, the 12 limit and the delete checks, as pure functions with their messages.
5. TDD the seam, in the sample arm, then the database arm's tests. Cover:
   - add, add-subject, delete and delete-subject
   - the Owner check
   - a duplicate code that arrives between load and save
   - the fixed codes
   - Staff Activity and the tags
   - that validateCatalogueSeed still passes after each write
6. TDD the screen:
   - the chip and form, shown to Owners only
   - the URL
   - "NOT ON SITE" and the note
   - the counters and messages
   - the delete reasons and the in-page confirm
7. Make every Website Exam list fit 1–12 Exams. Test with a catalogue of 6 and of 12 Exams. Check desktop and mobile in the e2e with screenshots you inspect yourself; don't commit them.
8. Write the e2e on sample data:
   - an Owner adds CHE with one Subject
   - it shows "NOT ON SITE" and `/exams/che` is 404
   - an Editor adds a Product under CHE and shows it on the Website
   - CHE appears last in the Exams menu, and its page answers 200
9. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Owner adds CHE ("Chemical Engineering", board CHELE, all four Header fields, Subjects "PCHEM" and "CHE PROF"). Saving opens `?exam=che&section=header`, in the lower case the screen uses today.
  - The chip sits after CPA with "NOT ON SITE", and "Exam pages × 6" counts it.
  - Staff Activity records "add" with the new values.
- The Product editor's Exam picker lists CHE at once. Once a CHE Product is shown on the Website:
  - CHE appears last in the menus, footer, Home, Products filters, Reviews filters, FAQ coverage table and About
  - it appears in the sitemap and /llms.txt
  - /exams/che answers 200 with its Header text and Subjects
- An Owner adds Subject "THERMO" to CE. It shows in the Subjects covered editor, the Product editor's Subject chips and CE's page.
- An Owner deletes an unused Exam and an unused Subject after the in-page confirm. Each is recorded in Staff Activity.
- Editors still rename Subjects and edit the new Exam's Header, sections and SEO.
- With 12 Exams, every Website Exam list lays out cleanly on desktop and mobile.
Sad paths (each one needs a test):
- An Editor sees no "+ Add exam", "+ Add subject", Subject remove or "Delete exam". The actions called as an Editor are refused (owners-only). Called signed out or as a non-Staff User, the Staff Guard refuses them.
- A code like "C", "CHEMENG" (7 letters), "CH3" or "C E" is refused with "USE 2–6 LETTERS". "ce" is refused with "CE IS ALREADY AN EXAM".
- A duplicate code that lands between two Owners' saves is refused with "CHE IS ALREADY AN EXAM", and the typed values are kept.
- No Subject, a blank Subject name, a 21-character Subject code, or two Subjects with the same code: each is refused with its message.
- A Header field one character over its limit is refused with the Header editor's message.
- A 13th Exam is refused with "UP TO 12 EXAMS. Ask the developer to raise the limit."
- Deleting an Exam that has only a hidden Product is refused with the reason. In the database arm, the database refusing the delete leaves everything unchanged.
- Deleting a Subject that a Product is tagged with is refused with the reason.
- A request that changes an existing Exam's code or a Subject's code is refused, and nothing changes.
- `<b>CHE</b>` typed as a name shows as plain text on the Website.
- A new Exam with no Product on the Website is absent from every Website list, the sitemap and /llms.txt, and /exams/<code> is 404.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked as the e2e server has them.
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm test:e2e` (the Website and Admin projects, on the in-memory sample data)
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
- Show that `git diff --stat` touches nothing in supabase/migrations/ or src/lib/db/schema.ts.
Follow verification-before-completion.
Repo gotchas:
- The user's dev server may be running on :3000 against the hosted project. Playwright reuses a server on :3000, so never run e2e against it. Run e2e and the build in a scratchpad copy on another port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in. If you can't, stop and ask the user to stop their server.
- `pnpm build` in the working tree breaks a running dev server. Never kill the user's server.
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` before a full run, verify your own diff, and report the shared-tree results separately.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, and never add an Exam to it. Don't run Docker or local Supabase on this machine.
- Don't edit docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, supabase/migrations/ or src/lib/db/schema.ts.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo beyond the mockup samples.
- Every Admin page and Server Action calls the Staff Guard. The Owner check runs in the action and in the seam, never only in the UI. Authorisation never comes from the client, from hidden fields, or from user metadata.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command, and the Website Exam lists you changed for 1–12 Exams
5. mockup deviations (with the BUILD-MAP line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
