# Executer prompt — 09 Exam pages

Ticket: `.scratch/ayc-admin/issues/09-exam-pages.md` · Blocked by: 06 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Editors control each Exam page from Exam pages & promo, in the mockup's three columns.

The sections:
- Header (always on): name, long name, text, made for
- Subjects covered (can be hidden): Subject names
- Reviewers (always on, automatic)
- Bundle offer (can be hidden): a Product of that Exam, a headline, text and a button label
- Reviews (can be hidden)

Per page, also:
- SEO: title and description with counters, a Google-style preview, a Good or Check state, and a 1200 × 630 share image
- the Official Exam Date

The Website's Exam page reads all of this through the Catalogue seam. The Exam page promo banners move out of fixed code into catalogue data, and today's pages render unchanged.

CONTEXT
- Already on docs/ayc-v1-planning:
  - the save path (ticket 02)
  - the upload seam (ticket 06)
  - the Exam pages & promo screen, with its header and an empty body (ticket 01)
- The Website Exam page is src/app/(website)/exams/[code]/page.tsx. It renders, in order:
  - ExamHero (photos from the top sellers)
  - SubjectsCovered
  - ExamProducts
  - CompareTable
  - TryACard
  - ExamPromoBanner, from examPromos in src/content/exam-pages.ts: { examCode, productSlug, eyebrow, body }, shown only while that Product is Live, with the saving computed
  - ExamReviews
  - StoreBand
- Its metadata comes from examSeoTitle and examSeoDescription in src/lib/catalogue/exam-copy.ts. Its share image is paths.shareImage.
- What becomes editable, and what stays fixed (spec Phase 2 → Exam pages & promo):
  - Editable: the Exam's name, longName, blurb (TEXT) and madeFor; each Subject's name (codes are fixed); the toggles for Subjects covered, Bundle offer and Reviews; the bundle offer's Product, headline (today's eyebrow), text (today's body) and button label (today's fixed "See the bundle"); SEO title and description overrides; the share image; the Official Exam Date.
  - Fixed in code: the compare table, Try a card, the store band and every section heading.
- Data and contract:
  - Add an Exam page record to the seed and the seam: sections { subjects, bundleOffer, reviews }, bundleOffer | null, seoTitle | null, seoDescription | null, shareImage | null and officialExamDate | null.
  - Move examPromos into it, keeping today's CE copy exactly.
  - Extend validateCatalogueSeed so that a bundle Product must belong to that Exam.
  - Expose it through a new Catalogue seam read, getExamPage(code), tagged catalogue:exam-pages.
- Search & AI visibility, a pure helper src/lib/admin/seo-check.ts:
  - GOOD when the full <title> (with the site suffix the layout adds) is at most 60 characters and the description is 80–160 characters
  - otherwise CHECK
  - The Overview (ticket 11) reuses it.
- The share image is uploaded through the upload seam with purpose "share-image". Warn, but don't block, when it isn't 1200 × 630. The Website's openGraph and twitter images use it when it's set.
- The Official Exam Date is optional. It isn't shown on the Website; Phase 3's countdown uses it. Warn when it's in the past.
- The mockup:
  - BUILD-MAP §3.2 (lines 82–147 and 964–1061): PAGES lists Exam pages × 5, Home promo banner and Announcement bar. The last two are ticket 10, so list them with an empty editor for now.
  - The mockup's "In the app" section waits for Phase 3. Leave it out.

SCOPE
Create:
- The examPages area in src/services/mock/admin/exam-pages.ts:
  - getExamPageForAdmin(actor, code)
  - updateExamHeader(…, expected)
  - updateSubjectNames(…, expected)
  - setExamSection(actor, code, section, on): a toggle
  - updateBundleOffer(…, expected)
  - updateExamSeo(…, expected), including the share image
  - updateOfficialExamDate(…, expected)
- The schemas.
- src/services/admin.exam-pages.test.ts.
- src/lib/admin/seo-check.ts, plus a test.
- The three-column screen in src/components/admin/exam-pages/.
- The Server Actions.
- e2e/admin/exam-pages.spec.ts.

Modify:
- catalogue.types.ts, catalogue.schema.ts and mock/catalogue.ts (the Exam page record and the moved promos)
- catalogue.ts and catalogue.mock.ts (getExamPage)
- src/app/(website)/exams/[code]/page.tsx: hidden sections, the bundle offer from the seam, metadata overrides, the share image
- src/content/exam-pages.ts: remove examPromos
- the Exam page tests

Leave untouched: the compare table, Try a card, the store band and their copy.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 06 (the upload seam) and ticket 02 (the save path) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/09-exam-pages.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 stories 74, 75 and 77; Phase 2 decisions (Exam pages & promo); Phase 1 → Rendering and caching
   - docs/mockup/admin/BUILD-MAP.md §3.2
   - src/app/(website)/exams/[code]/page.tsx and page.test.tsx, src/content/exam-pages.ts, src/lib/catalogue/exam-copy.ts, src/components/website/exam/*
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, forms-validation, shadcn-ui, tailwind-v4.
4. Prefactor: move examPromos into the seed as Exam page records, add getExamPage, and switch the Website page to it. Prove today's Exam pages render unchanged: the existing page tests and e2e/exam.spec.ts pass before anything is editable.
5. TDD seo-check at the boundaries: titles of 59, 60 and 61 characters with the suffix; descriptions of 79, 80, 160 and 161.
6. TDD the examPages area:
   - each update and its validation
   - the section toggles
   - the bundle Product rules
   - Subject renames, which show up wherever the Website shows the Subject
   - SEO overrides and blank fallbacks
   - the share image path
   - the date
   - the conflict check
   - Staff Activity
   - tags
7. Update the Website page:
   - hidden sections aren't rendered
   - the bundle offer shows only while its Product is Live
   - the metadata and Open Graph image use the overrides
   - add page tests for each
8. Build the three columns from the mockup: the chips, View page ↗, the visibility card, the sections list, the editors, the SEO panel with its counters and search preview, and the date.
9. Write the e2e:
   - hide Reviews on the ME page and see it gone
   - set a CE SEO title and see the <title>
   - rename a Subject and see it on the Exam page and the FAQ coverage table
   - upload a share image
10. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- Before any edit, every Exam page renders as it did in Phase 1, including the CE bundle offer with its saving.
- Selecting ME shows the chips, "View page ↗" (/exams/me), the visibility card and the sections, with Header and Reviewers "ALWAYS ON" and Subjects, Bundle offer and Reviews as toggles.
- Turning Reviews off on ME removes the Reviews section from /exams/me on the next load. Turning it on restores it.
- Editing the CE header TEXT changes the Exam hero text on /exams/ce. A blank SEO description falls back to the generated one, from the new text.
- Setting the CE SEO title to "CE Board Exam Reviewer" shows it in <title> (with the suffix) and og:title, and the card says GOOD when the description is 80–160 characters.
- Renaming CE's MSTC Subject updates the Exam page, the CE Product pages and the FAQ coverage table.
- Choosing a CE bundle Product, headline and text shows the offer on /exams/ce while that Product is Live.
- Uploading a 1200 × 630 share image sets og:image for that Exam page.
- Setting the Official Exam Date to a future date saves it.
Sad paths (each one needs a test):
- An empty Exam name or text is refused with a field error.
- A 61-character title with the suffix, or a 161-character description, is refused. The visibility card shows CHECK for a 70-character description.
- A bundle Product from another Exam, or one that was deleted, is refused. A bundle whose Product is set to Coming Soon or hidden disappears from the Website without an error.
- An invalid date (2026-02-30) is refused, and a past date shows a warning but saves.
- A share image that isn't 1200 × 630 shows a warning but saves. A .gif is refused by the upload seam.
- A stale save gets the conflict message. A Subject code can't be changed, and a submitted code change is refused.
- An unknown ?exam=xx shows the first Exam.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage` (the thresholds in vitest.config.ts must still pass; don't lower them)
- `pnpm test:e2e` (the Website and admin projects)
All must pass. Follow verification-before-completion.
Repo gotchas:
- `pnpm build` breaks a dev server running on :3000. If :3000 answers 200, run e2e against it (PLAYWRIGHT_PORT=3000), and run the build in a scratchpad copy: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in (Turbopack refuses a symlinked node_modules).
- Never kill the user's server.
- Another executer may share the working tree. Verify your own diff, and report the shared-tree results separately.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/. Don't edit CONTEXT.md unless this prompt says so.
- Use the names in .scratch/ayc-admin/CONVENTIONS.md. If the code already differs (an earlier ticket chose otherwise), follow the code and say so in your report.
- Add no dependency unless this prompt names it. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo beyond the mockup samples in CONVENTIONS §5.
- Every Admin page and Server Action calls the Staff Guard. Authorisation never comes from the client, from hidden fields, or from user metadata.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. mockup deviations (with the BUILD-MAP or mockup line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
