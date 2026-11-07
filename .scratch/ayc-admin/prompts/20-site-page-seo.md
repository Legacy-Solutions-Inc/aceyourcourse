# Executer prompt — 20 Site page SEO

Ticket: `.scratch/ayc-admin/issues/20-site-page-seo.md` · Blocked by: none (16 and 17 are done) · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Drizzle engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Editors set the search title, description and share image of the five Site pages (Home, Products, Reviews, About, FAQ) in the Admin, with the same editor Exam pages already use.
- The menu item "Exam pages & promo" becomes "Pages & promo".
- Its PAGES column gains "Site pages × 5", with chips HOME · ABOUT · PRODUCTS · FAQ · REVIEWS.
- Each chip opens that page's "Search & AI visibility" panel.
- The Website reads the saved values, and falls back to today's text and the site's share image.

CONTEXT
- Why: the client contract's Milestone 2 promises "allowing you to edit all content yourself". This ticket covers the Site pages' SEO. Ticket 21 adds About's text and photos, and ticket 22 adds /llms.txt.
- CONTEXT.md now defines Site page: "one of the Website's five standalone pages: Home, Products, Reviews, About and FAQ", set apart from an Exam page and from the Legal pages. Use that name in code, UI and tests.
- Already on docs/ayc-v1-planning:
  - The Pages & promo screen:
    - src/app/admin/(shell)/exam-pages/page.tsx and actions.ts
    - in src/components/admin/exam-pages/: exam-pages-columns.tsx (the PAGES entries and the fixed note), exam-page-panel.tsx, and exam-seo-editor.tsx (the SEO panel, its counters, preview, share image and SET_UP_AUTOMATICALLY list)
    - src/lib/admin/exam-pages-view.ts (parseExamPagesParams, examPagesHref)
    - src/lib/admin/seo-check.ts (GOOD or CHECK)
  - The menu label is in src/components/admin/admin-menu.ts. The Overview's text naming the screen is in src/lib/admin/needs-attention.ts, and other mentions are in comments and tests (grep "Exam pages & promo").
  - The Admin seam:
    - src/services/admin.ts, admin.types.ts, admin.schema.ts, admin.mock.ts
    - the area files in src/services/mock/admin/; exam-pages.ts is your closest pattern
    - admin.db.ts and admin.rows.ts (ticket 15)
    - adminAction with requiresStamp: true for editor saves
  - The Catalogue seam:
    - src/services/catalogue.ts (reads wrapped with unstable_cache and area tags), catalogue.types.ts, catalogue.schema.ts (validateCatalogueSeed)
    - catalogue.mock.ts and catalogue.db.ts, catalogue.rows.ts, catalogue.tags.ts (CATALOGUE_TAGS)
    - the sample store, src/services/mock/sample-store.ts
  - The database:
    - src/lib/db/schema.ts. exam_pages already has seo_title, seo_description and share_image, all nullable: your pattern.
    - Migrations come from `pnpm db:generate` (drizzle-kit) into supabase/migrations.
    - Every table has RLS on (.enableRLS()), with no browser policies, and the revoke-default-privileges migration covers new tables.
    - src/lib/db/deny-all.db.test.ts and src/lib/db/check.ts must still pass with the new table.
  - The upload seam:
    - src/services/uploads.ts, uploads.types.ts (UPLOAD_PURPOSES: product-photo, share-image), uploads.storage.ts (the path patterns), uploads.mock.ts
    - the after-commit clean-up: imagesRemoved(before, after) and uploadPathsIn walk the catalogue. If Site pages live in the catalogue (CatalogueSeed gains them), the clean-up and validateCatalogueSeed cover them for free. Do it that way unless the code shows a reason not to, and say what you chose.
  - The Website pages:
    - src/app/(website)/page.tsx, products/page.tsx, reviews/page.tsx, about/page.tsx, faq/page.tsx
    - Each one's generateMetadata reads metaTitle and metaDescription from src/content/<page>.ts, and uses paths.shareImage.
    - Those values stay in code as the defaults.
- The rules, from the spec (Phase 2 → "Site pages (added 2026-11-05)"):
  - Title and description are overrides: blank uses today's text, shown as the placeholder.
  - The counters, the preview and GOOD or CHECK follow what the page will show, exactly as for Exam pages: GOOD when the title is at most 60 characters and the description is 80–160.
  - The share image is 1200 × 630. Another size is warned about, never refused. Blank uses the site's image.
  - The page address is shown read-only. Home's is the site root.
  - Editors and Owners may edit.
  - A save goes live on the Website's next load, clears only the new tag `catalogue:site-pages`, records Staff Activity with before and after, and requires the stamp.
- URL: `/admin/exam-pages?page=site&site=<home|about|products|faq|reviews>`. Any other site value falls back to home. Keep `/admin/exam-pages` and every existing address working, and update CONVENTIONS §2's names only where the code already uses them.
- Storage path: `site-pages/{page}/share-{uuid}.{ext}`, with a new upload purpose. Add it to the path patterns and the mock arm.
- The hosted database is today's state: the 4 existing migrations and no Site page rows. Your migration adds the new storage and inserts nothing. Reads must give the defaults when no row exists. You never apply anything to the hosted project: the user runs `supabase db push` (runbook step 3) after review.
- The "Set up automatically" list on the Site page panel shows the same items as the Exam page's (Breadcrumbs only where the page has them, Sitemap AUTO). Ticket 22 adds "Summary for AI assistants".
- The fixed note under PAGES becomes "Menu, footer, and legal pages are fixed. Changes to those go through the developer." This overrides the mockup's note, by the spec's decision.

SCOPE
Create:
- the Site page area: its types, schema, mock arm file under src/services/mock/admin/, database arm and rows, and tests
- the Site page panel component, if the Exam SEO editor can't simply be reused (prefer reuse: give the existing editor what differs as props)
- a migration from `pnpm db:generate`
Modify:
- the Catalogue seam files, the sample store and the seed shape
- the Admin seam files, admin-menu.ts, needs-attention.ts, and exam-pages-columns.tsx, exam-pages-view.ts and the screen's page.tsx and actions.ts
- the five Website pages' generateMetadata
- the upload seam's purposes and paths
- src/lib/db/schema.ts, and check.ts if it counts tables by name
- the tests and e2e specs these touch (e2e/admin/exam-pages.spec.ts and promo.spec.ts if they name the menu)
- .scratch/ayc-admin/CONVENTIONS.md only to match names the code settled on
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, the src/content/* default texts (they stay the defaults), .env.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if tickets 15–17 (admin.db.ts, uploads.storage.ts) are missing.
   - Stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md
   - the ticket, .scratch/ayc-admin/issues/20-site-page-seo.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md, Phase 2: Menu, Staff Role permissions, Exam pages & promo (SEO per Exam page) and "Site pages (added 2026-11-05)", plus story 80a
   - docs/mockup/admin/BUILD-MAP.md §3.2
   - the files in CONTEXT
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, forms-validation, drizzle-data, supabase-postgres-best-practices, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the seam:
   - the default fallback, the save, the stamp conflict, Staff Activity and the tag, in the sample arm
   - the same behaviour suite on the database arm (it runs in CI)
5. TDD the Website metadata for each Site page: saved values, blanks, and the share image.
6. TDD the screen: the URL parsing, the PAGES entry and chips, the panel, the rename, the note.
7. Add the upload purpose and its Storage path test. Run the e2e for the screen.
8. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- The menu and the screen say "Pages & promo". "Site pages × 5" is listed, and HOME is selected by default.
- Saving ABOUT's title "About Ace Your Course · Iloilo board passers" and a 120-character description shows GOOD. The About page's <title>, description, og:title and twitter:title then use them on the next load.
- Clearing them restores today's text on the Website and in the placeholders.
- Uploading a 1200 × 630 share image for FAQ saves it. The FAQ page's og:image is that image. Replacing it deletes the old object after the commit.
- An Editor can save. Staff Activity lists the change with before and after.
- On a database with no Site page rows, every page shows today's metadata (database test, CI).
- e2e (sample data): an Editor opens Pages & promo → Site pages → PRODUCTS, saves a title, and the Products page's title changes.
Sad paths (each one needs a test):
- A 61-character title or a 70-character description shows CHECK, and still saves.
- A stale save (another Editor saved first) shows the conflict message, and keeps the typed values.
- `?page=site&site=legal` opens HOME.
- A GIF, or an 11 MB file, is refused with the upload seam's messages.
- A 1000 × 500 share image saves, with the size warning.
- The save action called signed out, or by a non-Staff User, is refused by the Staff Guard, and nothing is saved.
- A Site page read that throws on the database falls back to the defaults and logs once. The Website page still renders.
- An old address (`?exam=ce&section=header`, `?page=promo`, `?page=announcement`) still opens what it did.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked as the e2e server has them, so the build never reaches the hosted project.
- `pnpm test:coverage` (the thresholds in vitest.config.ts must still pass; don't lower them)
- `pnpm test:e2e` (the Website and Admin projects, on the in-memory sample data)
- `pnpm test:db`: show that the database suites, yours included, skip locally because TEST_DATABASE_URL isn't set. They run in CI.
- Show the new migration's SQL in the report.
Follow verification-before-completion.
Repo gotchas:
- `pnpm build` breaks a dev server running on :3000. If :3000 answers 200, run e2e against it only if it runs in sample mode (otherwise ask the user), and run the build in a scratchpad copy: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in (Turbopack refuses a symlinked node_modules).
- Never kill the user's server.
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` for another vitest or playwright before a full run. Verify your own diff, and report the shared-tree results separately.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, and never apply a migration to it: that's runbook step 3, for the user. Don't run Docker or local Supabase on this machine.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Use the names in .scratch/ayc-admin/CONVENTIONS.md. If the code already differs, follow the code and say so in your report.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo beyond the mockup samples in CONVENTIONS §5.
- Every Admin page and Server Action calls the Staff Guard. Authorisation never comes from the client, from hidden fields, or from user metadata.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command, and the migration's file name and SQL
5. where Site pages live in the data (in the catalogue or beside it, and why), mockup deviations (with the BUILD-MAP line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed." and the reminder "Before `pnpm dev` saves Site pages on the hosted project, run runbook step 3 (supabase db push)."
```
