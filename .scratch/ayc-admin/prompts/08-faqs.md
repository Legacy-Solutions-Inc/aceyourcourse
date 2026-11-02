# Executer prompt — 08 FAQs

Ticket: `.scratch/ayc-admin/issues/08-faqs.md` · Blocked by: 07 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Editors manage the FAQ page under Reviews & FAQs → FAQS.

The screen:
- the 5 fixed groups, with counts
- search across groups
- ▲▼ within a group
- "+ Add question to {group}"

The editor:
- question, and an answer of at most 400 characters
- group
- a supporting quote picked from a real Review and checked word for word, with an automatic credit line
- Show on FAQ page
- Popular question, with a chip label
- Only while the Member App is live
- Show the Subjects table

Every change is live on /faq and in its FAQPage structured data.

CONTEXT
- Already on docs/ayc-v1-planning:
  - the tabs and the reviews area (ticket 07)
  - the save path (ticket 02)
  - the Website FAQ page (Phase 1), which reads listFaqs()
- The Faq type: id, slug, group, order, question, answer, reviewQuote { reviewId, text } | null, popularLabel, requiresMemberApp, showOnFaqPage, showCoverageTable.
  - FAQ_GROUPS, the order and titles, is in catalogue.schema.ts.
  - The hand-kept FAQ seed is in src/services/mock/catalogue.ts. It now lives in the sample store.
- Page rules that already exist and must keep working:
  - hidden and app-only FAQs
  - a quote whose Review isn't shown is dropped
  - the deep links #faq-{slug}
  - the popular chips, from popularLabel
  - the coverage table
  - JSON-LD only for visible FAQs
- The deep-link slug:
  - Generate it from the question with src/lib/admin/slug.ts (ticket 05), at most 40 characters, made unique.
  - It's fixed after creation, and shown read-only as "aceyourcourse.ph/faq#faq-{slug}".
- The quote picker:
  - Choose a Review (search by text or Product), then paste or select an excerpt.
  - The server checks it appears in that Review word for word, with exact characters, as the seed rule does.
  - The credit line is computed ("★★★★★ · {Product short name}"), never typed.
- Moving an FAQ to another group puts it last there, and closes the gap in the old group's order. Delete closes the gap too.
- The mockup:
  - BUILD-MAP §3.4, FAQS tab (lines 279–314 and 1171–1211)
  - §2 deleteFaq
  - The mockup's validation checks only the question. Ours checks both fields.
  - Add the four toggles in the mockup's VISIBILITY style.

SCOPE
Create:
- The faqs area in src/services/mock/admin/faqs.ts:
  - listFaqsForAdmin(actor, { group, q })
  - getFaqForAdmin
  - createFaq
  - updateFaq(…, expected)
  - moveFaq(actor, id, "up" | "down")
  - deleteFaq
- The schemas.
- src/services/admin.faqs.test.ts.
- The FAQS tab's three columns, the editor and the quote picker in src/components/admin/faqs/.
- The Server Actions.
- e2e/admin/faqs.spec.ts.

Modify: the Reviews & FAQs screen's FAQS tab.

Leave untouched: the Website FAQ page and its components.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 07 (the Reviews & FAQs tabs, the reviews area) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/08-faqs.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 story 73; Phase 2 decisions (FAQ, Deleting, Conflict check); Phase 1 decisions on the FAQ page
   - docs/mockup/admin/BUILD-MAP.md §3.4 (FAQS tab) and §2 (deleteFaq)
   - src/services/catalogue.schema.ts (FAQ_GROUPS and the quote rule), src/services/mock/catalogue.ts (the FAQ seed) and src/app/(website)/faq/
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, forms-validation, shadcn-ui.
4. TDD the faqs area:
   - the list and search
   - create, update and delete
   - move up and down, including the boundaries
   - moving groups
   - the slug: generation, uniqueness, fixed after creation
   - the 400-character limit, at 400 and at 401
   - the quote check
   - popular with no label
   - the conflict check
   - Staff Activity
   - tags
5. Build the columns, the editor and the quote picker from the mockup.
6. Write the e2e:
   - add an FAQ to Buying with a quote, and see it on /faq with its credit and in the JSON-LD
   - hide one, and see it gone
   - reorder, and see the new order
   - delete one
7. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- GROUPS shows the 5 groups with counts. Selecting Shipping lists its questions with "SHIPPING · 3 QUESTIONS · ▲▼ TO REORDER" and the meta line for each.
- "+ Add question to Buying", with a question, a 120-character answer and a quote pasted from rev-014's text, saves with "✓ SAVED · LIVE ON THE FAQ PAGE". /faq shows it last in Buying with the credit "★★★★★ · {short name}". The FAQPage JSON-LD includes it, and #faq-{slug} deep-links to it.
- Turning "Popular question" on with the label "Shipping time?" adds that chip to /faq.
- Turning "Show on FAQ page" off hides the FAQ from /faq and the JSON-LD, and the row shows "· HIDDEN".
- ▼ on the first Shipping question swaps it with the second on /faq.
- Moving an FAQ from Paper to Coverage puts it last in Coverage, and Paper's order has no gap.
Sad paths (each one needs a test):
- An empty question or answer gets "WRITE A QUESTION AND ANSWER TO SAVE". The counter goes red at 401 characters, and the server refuses 401.
- A quote that isn't in the chosen Review word for word (one character changed) gets "This text isn't in the Review word for word."
- A quote from a Review whose Product is hidden or Coming Soon is refused.
- Popular on with an empty or 41-character label is refused.
- While searching, ▲▼ is disabled. ▲ on the first and ▼ on the last are refused by the server.
- A stale save gets the conflict message. Moving or deleting an FAQ that was already deleted returns not-found.
- Saving an FAQ never changes its slug, even after the question changes.

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
