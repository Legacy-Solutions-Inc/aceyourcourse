# Executer prompt — 03 Products page

Ticket: `.scratch/ayc-website/issues/03-products-page.md` · Blocked by: 02 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 / React 19 / TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the mockup doesn't settle a product decision.

GOAL
Build /products, the catalogue of every Live Product. It has:
- search and filters by Exam, format and maximum price
- four sort orders
- filters synced to the URL, so views can be shared and bookmarked
- a separate Coming Soon row
- a "Help me choose" two-question picker
- an empty state with Clear filters

CONTEXT
- Already on docs/ayc-v1-planning:
  - the Catalogue seam (src/services/catalogue.ts), with listProducts(filters), listExams() and getWebsiteSettings(), and the types in src/services/catalogue.types.ts
  - ProductCard (with an optional store-buttons row), StoreButton, Marquee, formatPeso and productPriceLabel
  - productsHref(filters) in src/lib/catalogue/product-filters.ts, which builds the URL with the keys exam, format, q, sort, max (whole pesos) and app=1, omitting defaults
  - the Website shell, and the Member App switch (settings.memberAppLive)
- Read the seam's rules in src/services/catalogue.mock.ts and its tests before you start. listProducts defaults to Live, query covers names, Exam and Subjects, maxPrice compares priceFrom, and state "coming-soon" ignores sort and maxPrice.
- Coming Soon Products never appear in the grid, the counts, the sort, the price filter or the picker. They appear only in their own "Coming soon" row, with no price.
- Pages render per request (nonce CSP). Filter changes update the URL with router.replace and no scroll, and the Server Component re-reads searchParams.
- With the Member App switch off, nothing on this page may mention, link to or filter by the Member App.
- Mockup: docs/mockup/website/Products_v2.dc.html (markup and the logic at L153–199). Read docs/mockup/website/BUILD-MAP.md §3 "Products" first.

SCOPE
Create:
- In src/lib/catalogue/product-filters.ts (the file exists; productsHref is already there), add:
  - parseProductSearchParams(params, { examCodes: string[]; memberAppLive: boolean; priceBounds: { min: number; max: number } }): ProductFilters & { maxPesos?: number }. It accepts:
    - exam: a lowercase code from examCodes
    - format: one of the 4 formats
    - q: trimmed, up to 100 characters
    - sort: one of the 4 sorts
    - max: an integer in pesos within the bounds; at or above the top bound it means "Any"
    - app=1: only when memberAppLive
    Anything else is ignored, never thrown.
  - priceBoundsOf(liveProducts): the minimum priceFrom rounded down to ₱50 and the maximum rounded up to ₱50.
  - facetCounts(liveProducts, selectedExam?): Exam chip counts over all Live Products; format chip counts over the Live Products of the selected Exam (or all).
  - tests for all of them
- src/lib/catalogue/picker.ts and its test: recommendProduct(liveProducts, examCode, style) returns { product, reason } or null. The styles are "on-the-go" | "on-my-wall" | "solving" | "everything" | "app". Use the mockup's preferred-format mapping at Products_v2.dc.html L153–158 and its reason sentences at L184–190:
  - the first Live Product of that Exam, in best-seller order, whose format is preferred
  - otherwise the Exam's best seller
  - "app" picks the first availableInApp Product
  - null when the Exam has no Live Products
- src/content/products-page.ts: the hero copy, the picker question and option labels, the empty-state copy and the "Physical or app?" copy.
- src/app/(website)/products/page.tsx (Server Component, with generateMetadata).
- src/components/website/products/: filter-bar.tsx (client), products-grid.tsx, coming-soon-row.tsx, product-picker.tsx (client), physical-or-app.tsx, and component tests for filter-bar and product-picker.
- e2e/products.spec.ts.
Modify: nothing else, unless a shared component needs a backwards-compatible prop. Say so in the report.
Leave untouched: the seam's behaviour (consume it; don't change its rules), docs/mockup/, docs/specs/, docs/adr/ and the other pages.

PAGE BEHAVIOUR (BUILD-MAP §3 "Products", with these rules)
- Hero:
  - the pill "All reviewers · {N} board exams", where N counts the Exams with Live Products
  - the sub-line lists those Exam codes with Intl.ListFormat
  - an app sentence only when the switch is on: "Most are also in the app." when more than half of the Live Products are availableInApp, "Some are also in the app." when at least 1 is, and nothing when none are
  - "Help me choose" scrolls to #picker and "Browse all" to #all
  - a ticker using Marquee with the Exam codes and taglines from content
- #picker:
  - Q1 shows a button for each Exam with Live Products. Q2 shows the study styles; the App option renders only when the switch is on.
  - The result shows the thumbnail, name, price label and reason, plus "View reviewer →" (to the Product page) and "See all {code} reviewers", which replaces the URL with that Exam filter and scrolls to #all.
  - With no match, it says "No {code} reviewers are out yet."
- #all:
  - the sticky filter bar: search, debounced 300 ms, with an accessible label; the sort select; Exam chips and format chips with counts and aria-pressed; the max-price slider (step ₱50, "Any" at the top) with an aria-valuetext in pesos; the "Also in app" toggle (switch on only); and "Clear filters", which goes to /products
  - the count reads "{N} of {M} reviewers", where M counts every Live Product
  - the grid of ProductCards with the store-buttons row (Shopee, Lazada, TikTok Shop), which fire marketplace_click with page "/products"
  - the empty state: "No reviewers match those filters.", "Clear filters", and "Browse Shopee ↗" (the shop link; hidden when it's null)
- Coming Soon row: listProducts({ state: "coming-soon", examCode, format, query }), with ProductCards in the Coming Soon variant (badge, no price). It is hidden when empty.
- "Physical or app?" section: only when the switch is on.
- Metadata: title "All reviewers · flash cards, notebooks & posters", a description, and canonical paths.products.list for every filtered view.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if productsHref, Marquee or the listProducts seam method is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - in the spec: "Phase 1: Website" (stories 13–20, Coming Soon rules, Routes, Member App switch) and "Testing Decisions"
   - BUILD-MAP §3 "Products" and §5
   - Products_v2.dc.html
   - the catalogue seam, its tests and the existing website components
3. Skills: test-driven-development, nextjs-app-router, shadcn-ui, tailwind-v4, testing-unit, testing-e2e and coding-standards.
4. TDD the parser, bounds, facet counts and picker. Then the components (with tests), then the page, then the e2e.
5. Verify. Run requesting-code-review on your diff and fix in-scope findings. Report.

ACCEPTANCE CRITERIA
Happy paths:
- /products shows every Live Product, best selling first, with "{M} of {M} reviewers".
- Clicking the CE chip makes the URL contain exam=ce and the grid show only CE. Adding Posters adds format=posters. Reloading the page restores the same chips, grid and count.
- Sort "Price: low to high" puts the cheapest Live Product first and puts sort=price-asc in the URL.
- Searching "MSTC" (after the debounce) shows only Products covering MSTC, with q=MSTC in the URL.
- The max-price slider at ₱500 shows only Products with priceFrom ≤ ₱500 and sets max=500.
- Clear filters returns to /products with every Live Product.
- The picker: CE + "On my wall" recommends the CE posters with the mockup's reason, and "See all CE reviewers" sets exam=ce and scrolls to the grid.
- The Coming Soon row lists the Coming Soon Products with a "Coming soon" badge.
- A grid card's Shopee button goes to that Product's Listing, or to the shop page when there's no Listing.
Sad paths (each one needs a test):
- /products?exam=zzz&format=box&max=abc&sort=bogus&q= renders the full grid with defaults and no error. parseProductSearchParams returns {} for those values.
- max above the top bound reads as "Any". app=1 is ignored while the switch is off.
- A combination with no matches (e.g. exam=cpa&format=posters) shows the empty state. Clear filters recovers.
- With no Shopee shop link in settings, "Browse Shopee" is not rendered.
- Coming Soon Products are never in the grid, the counts, the "{N} of {M}" total, the price bounds or the picker. The Coming Soon row contains no "₱".
- The Coming Soon row is hidden when no Coming Soon Product matches (e.g. exam=cpa).
- recommendProduct returns the Exam's best seller when no preferred format exists, and null for an Exam with only Coming Soon Products.
- With the switch off: no "Also in app" toggle, no App picker option, no "Physical or app?" section, no app sentence in the hero, and no link starting with /app.
- facetCounts gives a chip with zero Products a count of 0, and the chip is disabled, not hidden.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage`
- `pnpm test:e2e`
All must pass. Follow verification-before-completion.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/.
- Never add generateStaticParams, force-static, revalidate or ISR, and never weaken the CSP.
- Read data only through @/services/catalogue, and build URLs only with paths and productsHref.
- Never show a price for a Coming Soon Product. Gate every Member App element on memberAppLive. Light-only.
- No new dependencies. shadcn primitives through the CLI are fine (e.g. slider, toggle). Otherwise stop and ask.
- Out-of-scope bugs go in the report.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion marked ✅ or ❌, with the proving test or spec
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. copy needing client review (the hero, picker reasons, empty state), deviations and follow-ups
6. the line "Nothing committed or pushed."
```
