# Executer prompt — 05 Product editor

Ticket: `.scratch/ayc-admin/issues/05-product-editor.md` · Blocked by: 04 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Editors add and edit Products in the mockup's editor panel, and every save is live on the Website.

The fields:
- full name, short name, edition
- Exam, format, size and paper
- Subjects, from that Exam
- price from, price up to, and variations
- the Shopee rating, number of ratings and units sold, with their "as of" date
- What's inside and Made for
- a Listing per Marketplace
- SEO title and description
- Coming Soon, Deal, Available in app and Show on website

Delete needs a typed DELETE, with exact counts of what goes with the Product. Photos are shown, but editing them is ticket 06.

CONTEXT
- Already on docs/ayc-v1-planning:
  - the list and its selection (ticket 04)
  - the save path (ticket 02): adminAction, save-state, the conflict notice, the toast, Staff Activity, tags
- Product rules live in src/services/catalogue.schema.ts and must be reused, not copied:
  - A Coming Soon Product has no price, variations, Listings, Shopee figures or Reviews.
  - A Live Product needs a price and at least one photo.
  - Each Listing must be on its Marketplace's domain.
  - Subject codes must belong to the Product's Exam.
- The sample arm re-validates the whole catalogue before committing a write (CONVENTIONS §3).
- Generated defaults already exist in src/lib/catalogue/product-copy.ts: What's inside, Made for, and the SEO title and description. Show them as placeholders when a field is blank.
- The page address (slug):
  - Generate it from the full name with a pure src/lib/admin/slug.ts: lowercase ASCII and hyphens, unique with -2 or -3.
  - It's fixed after creation. The mockup's SEO panel shows the address read-only.
- Money is in integer centavos. The form takes pesos, with or without ₱ and commas, at most 2 decimals.
- The mockup: BUILD-MAP §3.3, Editor panel (lines 181–229 and 1080–1130), and §2 deleteProduct.
  - Mockup validation only checks the name. Ours checks every rule.
  - The admin strips the variation prefix only for display (line 1095).
- Delete cascade:
  - The Product's Reviews and photos go with it.
  - FAQ quotes from those Reviews are removed.
  - The dialog says: "N Reviews and N photos are deleted with it. N FAQ quotes from its Reviews are removed. Store listings on Shopee, Lazada, and TikTok Shop are not affected."
  - The confirm needs "DELETE" typed exactly.

SCOPE
Create:
- Products area functions in src/services/mock/admin/products.ts:
  - getProductForAdmin(actor, id)
  - createProduct(actor, input)
  - updateProduct(actor, id, input, expected)
  - previewProductDelete(actor, id), returning { reviews, photos, faqQuotes }
  - deleteProduct(actor, id)
- Their zod schemas.
- src/lib/admin/slug.ts, plus a test.
- The editor panel components in src/components/admin/products/.
- The typed-DELETE dialog, as a reusable src/components/admin/typed-delete-dialog.tsx.
- The Server Actions.
- Tests in src/services/admin.products.test.ts, and e2e in e2e/admin/product-editor.spec.ts.

Modify: the Products screen (the panel).

Leave untouched: the photo editing (ticket 06) and the Catalogue seam's contract.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 04 (listProductsForAdmin, the Products list and ?product= selection) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/05-product-editor.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 stories 64–69; Phase 2 decisions (Products, Deleting, Conflict check, Live on save)
   - docs/mockup/admin/BUILD-MAP.md §3.3 (Editor panel) and §2 (deleteProduct)
   - src/services/catalogue.schema.ts (the Product rules) and src/lib/catalogue/product-copy.ts
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, forms-validation, shadcn-ui, tailwind-v4.
4. TDD slug.ts: accents, symbols, collisions, and a long name.
5. TDD the products area through the seam:
   - create, Live and Coming Soon
   - update with every validation rule
   - the Subjects dropped on an Exam change
   - the Shopee figures: all-or-nothing, and the "as of" date
   - the conflict check
   - the delete preview counts and the cascade
   - Staff Activity
   - the tags
6. Build the panel and the dialog from the mockup, with the save-state line, the toast and the conflict notice.
7. Write the e2e:
   - change a price and see it on the Product page and /products
   - add a Coming Soon Product and see it in the Website's Coming Soon list
   - delete a Product with Reviews, see the counts, type DELETE, and its page answers 404
8. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- Editing the CE Formula Flash Cards price from to ₱1,250 shows "✓ SAVED · LIVE ON THE SITE". The Product page, its card on /products, the CE Exam page and the Home best sellers show ₱1,250 on the next load.
- Adding a variation "MSTC ONLY" at ₱400, then removing another, saves the list in order. The Product page's variation picker shows the change.
- Saving the Shopee figures 4.9, 120 and 800 sets their "as of" date to today in Manila time. A units-sold change re-ranks the Home best sellers.
- A new Coming Soon Product, "MT Notebook" with Exam MT, saves with no price, gets the address /products/mt-notebook shown read-only, and appears in the Website's Coming Soon section.
- Blank SEO fields show the generated title and description as placeholders, with the counters at n/60 and n/160.
- Delete on a Product with 3 Reviews (1 of them quoted by an FAQ) and 4 photos shows "3 Reviews and 4 photos are deleted with it. 1 FAQ quote from its Reviews is removed." After DELETE, its page answers 404 and the FAQ has no quote.
Sad paths (each one needs a test):
- A Live Product with an empty name or no price gets "ADD A NAME AND PRICE TO SAVE". Nothing changes.
- Prices "abc", "-5" and "12.345", and a price up to below price from, each get a field error.
- A Lazada Listing on shopee.ph gets the domain error for that Marketplace.
- A rating with no number of ratings or units sold gets "Fill in all three Shopee figures, or none."
- Changing the Exam from CE to ME drops CE-only Subjects from the selection. A submitted Subject code that isn't on the Exam is refused by the server.
- Switching a Live Product to Coming Soon while it has Reviews is refused: "Coming Soon Products can't have Reviews. Delete or move its N Reviews first." That follows the seed rule.
- A new Live Product with no photos gets "Add at least one photo to make it Live".
- Conflict: two Editors edit the same Product, and the second save gets the conflict message, keeping the form.
- Saving or deleting a Product deleted elsewhere returns not-found. In the delete dialog, "delete" (lowercase) keeps the button disabled.
- An SEO title of 61 characters is refused.

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
