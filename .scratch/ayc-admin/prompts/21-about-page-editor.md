# Executer prompt — 21 About page editor

Ticket: `.scratch/ayc-admin/issues/21-about-page-editor.md` · Blocked by: 20 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Drizzle engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Editors edit the About page's text and its four photos in Pages & promo → Site pages → ABOUT.
- About gets six sections in the SECTIONS list, each opening in the editor column, as an Exam page's sections do.
- A blank field shows today's text.
- With nothing saved, the About page is exactly what it is today.

CONTEXT
- Why: the client contract's Milestone 2 names the About Us page as content the client edits themselves. Ticket 20 (on docs/ayc-v1-planning, uncommitted or committed) built the Site pages entry, the ABOUT chip with its SEO panel, the `sitePages` area, the `catalogue:site-pages` tag, and the `site-pages/{page}/share-…` upload path. Extend that work. Don't duplicate it.
- Today's About:
  - src/app/(website)/about/page.tsx
  - in src/components/website/about/: about-hero.tsx, our-story.tsx, mission-tabs.tsx, iloilo-roots.tsx, about-cta.tsx
  - the copy in src/content/about.ts: aboutCopy, teamPhoto, storyPhotos and missionTabs, which stay as the defaults
  - src/content/about.test.ts
  - The photos are in public/about/, and sit in 4:3 frames (object-cover). The largest frame shows at 560 px wide.
- The sections and their fields (spec, Phase 2 → "Site pages (added 2026-11-05)"):
  - header: intro text (aboutCopy.hero.intro); team photo and its alt text
  - story: heading; paragraphs 1–3; Before card title and text; After card title and spec chips (up to 5, each at most 20 characters); the three story photos and their alt text
  - growth: the First item's title; the Now text, which is the lead sentence only (the "We now make reviewers for {Exams}" list is still added after it automatically, as aboutCopy.story.now.body does today); the Today text; the closing line ("And this is only the beginning.")
  - mission: heading; intro; four tabs, each with a title and text. Always four, numbered by the component.
  - roots: heading; text; the shipping label's "To" line (aboutCopy.roots.label.recipient)
  - closing: heading (aboutCopy.cta.heading)
- Stays in code: the small labels above headings, the buttons and links, the pill, the stat labels, the shipping label's other words, and the hero headline (it's shared with the footer through websiteCopy). About's shape is fixed.
- Blank means default:
  - Each field is nullable and starts null, and the editor shows the default as its placeholder.
  - Saving a blank (or whitespace-only) field stores null, which restores the default.
  - The paragraph and chip lists store null when every item is blank.
  - A photo never replaced is today's photo with today's alt text.
- Rules:
  - Plain text only. React escapes it, and nothing uses dangerouslySetInnerHTML.
  - Each field's limit is about 1.5× its default's length, rounded up to the next multiple of 10. Compute the limits from the defaults in one place, and test that each default fits its own limit.
  - Each field has a counter, red when over. Over the limit is refused with a message that names the limit.
  - Photos use the upload seam, with a new purpose and the path `site-pages/about/{slot}-{uuid}.{ext}`, where slot is team, story-1, story-2 or story-3. Same types and 10 MB as other photos.
  - Warnings, not refusals: "This photo isn't 4:3, so its edges will be cropped." when the width ÷ height is outside 1.27–1.40, and "This photo is smaller than 1200 × 900, so it may look soft." when it's under either side. Follow shareImageWarning in src/lib/admin/exam-pages-view.ts.
  - A replaced photo needs alt text of 1–150 characters. A blank one gets "Describe the photo for screen readers."
  - Mission tab 03 shows the fixed note "This text names prices. Update it when prices change."
- Saves: one save per section, through adminAction with requiresStamp: true. Each save goes live on the next load, clears only `catalogue:site-pages`, records Staff Activity with before and after, and runs the after-commit clean-up for replaced photos. Keep Site pages in the catalogue, as ticket 20 did, so imagesRemoved and validateCatalogueSeed cover the photos.
- URL: `?page=site&site=about&section=<header|story|growth|mission|roots|closing>`. An unknown section opens header. Under ABOUT, the SECTIONS list sits beside the SEO panel, as for an Exam page. Follow exam-page-panel.tsx and exam-page-editors.tsx.
- The hosted database has no About record. Your migration adds storage only, and reads give every default when no row exists. You never apply anything to the hosted project.
- The About copy test that checks mission tab 03's prices against the catalogue now checks only the default text. Rename it to say so. The repo-photo test (self-hosted WebP of at most 250 KB) stays, for the default photos only.

SCOPE
Modify, adding new files beside them where the pattern does:
- the `sitePages` area in the Admin seam (types, schema, mock arm, database arm, rows) and in the Catalogue seam (types, schema, mock, database, rows), the sample store, the seed shape
- src/lib/db/schema.ts, and a new migration from `pnpm db:generate`
- the upload seam's purposes and paths
- the Pages & promo screen: exam-pages-view.ts, page.tsx and actions.ts, and the ABOUT panel with its SECTIONS list and editors (new components in src/components/admin/exam-pages/ or a site-pages folder, following the existing names)
- the About page and its components: take the copy as a prop resolved from the saved values plus the defaults, and keep them as Server Components where they are today
- src/content/about.test.ts as above
- the tests and the e2e spec for the screen (a new e2e/admin/about.spec.ts is fine)
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, and the default texts in src/content/about.ts (they stay as they are).

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if ticket 20's Site pages work is missing, or if there are uncommitted changes other than ticket 20's.
   - Stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Before you change anything, render the About page's sections with today's data, and save the output as a test snapshot. "Nothing saved" must match it at the end.
3. Read:
   - AGENTS.md and CONTEXT.md (Site page)
   - .scratch/ayc-admin/CONVENTIONS.md
   - the ticket, .scratch/ayc-admin/issues/21-about-page-editor.md: every checkbox is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md, Phase 2 → "Site pages (added 2026-11-05)", the Phase 1 About decisions, and story 80b
   - docs/mockup/admin/BUILD-MAP.md §3.2: the editor's field types and the unreachable About definition
   - the files in CONTEXT
4. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, forms-validation, drizzle-data, supabase-postgres-best-practices, coding-standards, verification-before-completion, requesting-code-review.
5. TDD the pure parts:
   - the merge of the saved values over the defaults, field by field, including the lists and the photos
   - the limits computed from the defaults
   - the photo warnings
6. TDD the seam, in the sample and database arms: each section's save, the stamp conflict, Staff Activity, the tag and the clean-up.
7. TDD the About page with saved values, partial values and none (the snapshot).
8. TDD the screen: the URL, the SECTIONS list, each section's editor, the counters and the messages. Then write the e2e.
9. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- With nothing saved, the About page matches the snapshot from step 2.
- Saving the story heading "We passed the boards. Then we built the reviewers." shows it on the About page's next load. Every other field still shows its default.
- Saving the Now text keeps the automatic "We now make reviewers for …" list after it.
- Saving mission tab 02's title and text changes only tab 02. Tab 03 shows the price note in the editor.
- Replacing story photo 2 with a 1600 × 1200 JPEG and its alt text shows it, through next/image with that alt text. The old Storage object (when there was one) is deleted after the commit.
- Clearing a field restores its default.
- Editors and Owners can both save. Staff Activity records each section's before and after.
- e2e (sample data): an Editor edits the roots heading, saves, and the About page shows it.
Sad paths (each one needs a test):
- A field one character over its limit is refused with its message, and the typed text is kept.
- A 21-character spec chip is refused. A sixth chip and a fourth paragraph can't be added.
- A replaced photo with blank alt text is refused with "Describe the photo for screen readers.", and a 151-character alt text is refused.
- A 1000 × 1000 photo saves with the 4:3 warning. An 800 × 600 photo saves with the size warning.
- A GIF or an 11 MB file is refused with the upload seam's messages.
- A stale save shows the conflict message, and keeps the typed values.
- Text like `<b>hi</b>` or `<script>` shows as plain text on the About page.
- An unknown section (`section=team`) opens header.
- The save actions called signed out, or by a non-Staff User, are refused by the Staff Guard.
- An About read that throws on the database falls back to every default and logs once. The page still renders.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked as the e2e server has them.
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm test:e2e` (the Website and Admin projects, on the in-memory sample data)
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
- Show the new migration's SQL, and the table of each field's default length and limit.
Follow verification-before-completion.
Repo gotchas:
- `pnpm build` breaks a dev server running on :3000. If :3000 answers 200, run e2e against it only if it runs in sample mode (otherwise ask the user), and run the build in a scratchpad copy: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Never kill the user's server.
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` before a full run, verify your own diff, and report the shared-tree results separately.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, and never apply a migration to it. Don't run Docker or local Supabase on this machine.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Use the names in .scratch/ayc-admin/CONVENTIONS.md and the ones ticket 20 settled on. Where they differ, follow the code and say so.
- Add no dependency, and no rich-text editor. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo beyond the mockup samples.
- Every Admin page and Server Action calls the Staff Guard. Authorisation never comes from the client, from hidden fields, or from user metadata.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command, the migration's file name and SQL, and the limits table
5. mockup deviations (with the BUILD-MAP line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed." and the reminder "Before `pnpm dev` saves About on the hosted project, run runbook step 3 (supabase db push)."
```
