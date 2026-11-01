# Executer prompt — 04 Products list

Ticket: `.scratch/ayc-admin/issues/04-products-list.md` · Blocked by: 02 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Editors see every Product, including Coming Soon and hidden ones, in the mockup's Products & store links list.
- Each row shows the thumbnail, the short name, the format and units sold, the Exam, the price label, S/L/T badges with n/3, and inline App and Site toggles.
- The filters are search, Exam chips and "Missing product links", all kept in the URL.
- The toggles save at once and change the Website.

CONTEXT
- Already on docs/ayc-v1-planning:
  - the store-backed Catalogue seam and its tags (ticket 02)
  - adminAction, the toast and the Staff Activity pattern
  - the Products screen, with its header and an empty body (ticket 01)
- The Product type (src/services/catalogue.types.ts) has:
  - state: live or coming-soon
  - listings: a partial record per Marketplace
  - shopee figures, with unitsSold
  - showOnWebsite and availableInApp
- Price labels and store-link logic already exist: src/lib/catalogue/price.ts, store-links.ts and format.ts. Reuse them.
- Store link status per Marketplace:
  - "product": the Product has its own Listing
  - "shop": no Listing, but Settings has that Marketplace's shop link, so the button opens the shop page
  - "none": no Listing and no shop link, so the button is hidden
  - Badges: green for product, amber for shop, a muted dash for none. "n/3" counts the product links.
- "Missing product links" shows Live Products with at least one Marketplace in the "shop" state. Coming Soon Products never count.
- The mockup: BUILD-MAP §3.3, List (lines 149–229 and 1064–1130).
  - No bulk actions, and no column sorting.
  - The header's primary action is "+ Add product", which goes to ?product=new.
  - The editor panel is ticket 05. Until then, the right panel shows "Select a product" or an empty state.

SCOPE
Create:
- The products area read listProductsForAdmin(actor, { q, exam, missing }) in src/services/mock/admin/products.ts. It returns rows with the derived link status, the stamp and the flags.
- setProductFlags(actor, id, { showOnWebsite? , availableInApp? }): a single toggle, with no conflict check, appending Staff Activity and returning the product tags.
- src/services/admin.products.test.ts.
- The list components in src/components/admin/products/, the URL search-param handling, and src/app/admin/(shell)/products/actions.ts.
- e2e/admin/products-list.spec.ts.

Modify: the Products screen.

Leave untouched: the Catalogue seam's contract.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 02 (the sample store with the catalogue, adminAction, catalogue tags) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/04-products-list.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 stories 63, 66 and 68; Phase 2 decisions (Products: the list; Live on save; Conflict check)
   - docs/mockup/admin/BUILD-MAP.md §3.3 (List)
   - src/lib/catalogue/price.ts, store-links.ts and format.ts
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, data-tables, shadcn-ui, tailwind-v4.
4. TDD listProductsForAdmin:
   - the sort order
   - each filter and their combinations
   - search, case-insensitive, over the title and short name
   - the link status, including a cleared shop link becoming "none"
   - Coming Soon placement
5. TDD setProductFlags:
   - the flag change
   - Staff Activity
   - tags
   - not-found
   - the Website seam results changing (listProducts or getProductBySlug after hiding)
6. Build the list from the mockup, at 1280 px and 375 px. Keep the filters in the URL, with the empty states.
7. Write the e2e: filter by Exam and search; Missing product links; hide a Product and see its Website page answer 404; show it again.
8. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- The list shows every Product, Live ones by units sold and then Coming Soon, with "PRODUCT · N", the format and units-sold line, the price label ("₱400+" for a range) and the S/L/T badges with n/3.
- Typing "poster" in search narrows the rows. CE plus Missing product links shows only CE Live Products with an amber badge. The URL keeps the filters across a reload.
- Turning Site off on a Live Product dims its row. Its Website page then answers 404, and it leaves /products, its Exam page and Home. Turning it back on restores everything.
- Turning App on, with MEMBER_APP_LIVE=true, shows the "ALSO IN APP" badge on the Website. With the switch off, nothing changes on the Website.
- Clicking a row sets ?product=<id>, and "+ Add product" sets ?product=new. The panel shows its placeholder until ticket 05.
Sad paths (each one needs a test):
- No match shows "No products match" with "Clear filters", which resets the URL.
- An unknown ?exam=xx is ignored, and the list shows ALL.
- Toggling a Product deleted elsewhere (removed from the store in a test) returns not-found. The UI shows a message and refreshes.
- A toggle that fails (forced) reverts the switch and shows the "Couldn't save" toast.
- A signed-out call to the toggle action is refused.
- With a Marketplace's shop link cleared in Settings, that badge shows "none" and doesn't count as missing.

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
