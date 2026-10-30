# Executer prompt — 04 Exam pages

Ticket: `.scratch/ayc-website/issues/04-exam-pages.md` · Blocked by: 02 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 / React 19 / TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the mockup doesn't settle a product decision.

GOAL
Build /exams/{code}, the landing page for each Exam AYC sells for. It has:
- a hero with computed stats and an Exam switcher that changes the URL
- the Subjects covered
- every Product, best selling first, with format chips
- a "Which one should I get?" comparison table
- three sample formula cards
- the CE bundle offer
- Reviews from that Exam's reviewees
- a store band

CONTEXT
- Already on docs/ayc-v1-planning:
  - the Catalogue seam (src/services/catalogue.ts) with listExams() (only Exams with at least one visible Product), getExamByCode(code), listProducts(filters, including state "coming-soon"), listReviews({ examCode, sort: "exam-page", limit }) and getWebsiteSettings()
  - ProductCard, ReviewCard, StoreButton, Marquee and JsonLd
  - breadcrumbJsonLd in src/lib/catalogue/json-ld.ts, formatPeso and productPriceLabel
  - paths.exams.details(code), which lowercases the code
  - the Member App switch (settings.memberAppLive)
- Visitors search by board acronym ("CELE reviewer"), so these pages are the main SEO targets.
- Coming Soon Products appear on their Exam page, after the Live ones, with a badge and no price. They're excluded from every stat, the top-3 image stack, "#1", the comparison table and "Get the printed set".
- Fixed copy lives in typed content config: the BEST FOR map, 3 sample formula cards per Exam, and the CE bundle banner text. Prices are always read from the catalogue, never hardcoded.
- Mockup fix: the mockup's switcher changes state only (Exam_v2.dc.html L245). Here it must navigate to the other Exam's URL.
- Pages render per request (nonce CSP).
- Mockup: docs/mockup/website/Exam_v2.dc.html (the BEST map is at L220, the sample cards at L213–219, the stats logic at L252–263). Read docs/mockup/website/BUILD-MAP.md §3 "Exam" first.

SCOPE
Create:
- src/lib/catalogue/exam-stats.ts and its test: examStats(products) over Live Products only returns { productCount, unitsSold, averageRating: number | null, priceFrom: number | null }.
  - averageRating is weighted by ratingCount, rounded to 1 decimal, and null when the total ratingCount is 0
  - priceFrom is the minimum Live priceFrom, or null
  - Products without Shopee figures count toward productCount and priceFrom only
- src/lib/catalogue/review-display.ts and its test: reviewDisplayMode(count) returns "marquee" for 4 or more, "grid" for 1–3 and "empty" for 0.
- src/content/exam-pages.ts:
  - bestFor: Record<ProductFormat, string> from L220
  - sampleCards: Record<examCode, { front: string; back: string }[]> with the 3 cards per Exam from L213–219
  - examPromos: an array of { examCode: "CE", productSlug: the CE Review Bundle 3-in-1's seed slug, eyebrow: "CE Review Bundle 3-in-1 · save ₱200", body: "Cards, notebook, and posters for MSTC, HPGE, and PSAD in one order." }
- src/app/(website)/exams/[code]/page.tsx (with generateMetadata).
- src/components/website/exam/: exam-hero.tsx, exam-switcher.tsx, subjects-covered.tsx, exam-products.tsx (a client component for the format chips), compare-table.tsx, formula-card.tsx (client, flips), exam-promo-banner.tsx, exam-reviews.tsx and store-band.tsx, with component tests for formula-card and exam-products.
- e2e/exam.spec.ts.
Leave untouched: the seam's rules, the shared components' behaviour (backwards-compatible props are fine; report them), docs/mockup/, docs/specs/, docs/adr/ and the other pages.

PAGE BEHAVIOUR (BUILD-MAP §3 "Exam", with these rules)
- Routing:
  - if params.code isn't lowercase, permanentRedirect to paths.exams.details(code)
  - if getExamByCode returns null, or the Exam isn't in listExams(), call notFound(); it renders the Website-shell 404 with HTTP 404
- Hero:
  - the breadcrumb: "Exams" goes to "/#exams", then the Exam name
  - the switcher is real links for every Exam in listExams(), with aria-current on the current one
  - the code block, board · long name, H1 name and blurb
  - "See {N} reviewers ↓" goes to #reviewers
  - "Review {code} in the app" goes to paths.memberApp.home, only when memberAppLive and a Live Product of the Exam is availableInApp
  - stats from examStats: Reviewers, Units sold (en-PH), Avg rating ("New" when null) and From (formatPeso; the tile is hidden when null)
  - the image stack of the top 3 Live Products by units sold, linking to their Product pages
  - a Marquee ticker of "{code} · {Subject name}"
- What's covered: "{n} subjects on the {board}" with numbered Subject cards, code and full name.
- #reviewers:
  - Live Products by units sold, then Coming Soon Products, as ProductCards with no buy buttons
  - "#1 in {code}" on the top Live seller only
  - format chips (with aria-pressed) only when the Live Products span more than one format
- Comparison table: only with 2 or more Live Products. Columns: reviewer (link), format · size, best for (content), an In-the-app column (shown only when the switch is on: "Yes" or "Physical only") and the price label. Coming Soon is excluded.
- Try a {code} card:
  - the sample cards from content, which flip on click, Enter or Space, using aria-pressed and the label "Flip card"
  - the section is hidden when the Exam has no sample cards
  - "Get the printed set" goes to the top Live seller's Product page, and is hidden when there's none
  - "See {code} app plans →" only when the switch is on and a Product is in the app
- Promo banner: render each examPromos entry for this Exam only when its Product exists and is Live. Its price is productPriceLabel or formatPeso(priceTo or priceFrom) of that Product; if you can't tell which price is the bundle price from the seed, stop and ask. It links to the Product page.
- From {code} reviewees: listReviews({ examCode, sort: "exam-page", limit: 7 }) with ReviewCard (including "View product →"), shown as a Marquee, a grid, or the mockup's "No written reviews yet. Buyers have left star ratings on Shopee but no comments so far." text, by reviewDisplayMode.
- Store band: "Get your {code} reviewer from our official stores." with StoreButtons for the shop pages (product undefined, link "shop"), each hidden when null.
- Metadata: title "{board} Reviewer · {name}" (assert ≤ 60 characters in the test), a description from the blurb (≤ 160 characters), and canonical paths.exams.details(code). Add BreadcrumbList JSON-LD (Home, then the Exam).

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if listReviews, Marquee or breadcrumbJsonLd is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - in the spec: "Phase 1: Website" (stories 29–35, Coming Soon rules, mockup fixes, SEO) and "Testing Decisions"
   - BUILD-MAP §3 "Exam" and §5
   - Exam_v2.dc.html
   - the catalogue seam and the shared components
3. Skills: test-driven-development, nextjs-app-router, shadcn-ui, tailwind-v4, testing-unit, testing-e2e and coding-standards.
4. TDD examStats, reviewDisplayMode and the content shapes. Then the components (with tests), then the page, then the e2e.
5. Verify. Run requesting-code-review on your diff and fix in-scope findings. Report.

ACCEPTANCE CRITERIA
Happy paths:
- /exams/ce shows:
  - the CE hero with the stats computed from the seed (Reviewers = the number of Live CE Products, units sold summed, a weighted average rating, From = the lowest Live CE price)
  - 3 Subject cards
  - the CE Products best selling first, with "#1 in CE" on the top seller
  - the comparison table and 3 flippable sample cards
  - the CE bundle banner with the bundle's catalogue price
  - up to 7 CE Reviews and the store band
- Clicking "ME" in the switcher navigates to /exams/me, and the browser's back button returns to /exams/ce.
- Format chips on the CE page filter the list in place, and aria-pressed reflects the selection.
- The JSON-LD has a BreadcrumbList. The page title is "CELE Reviewer · Civil Engineering".
Sad paths (each one needs a test):
- /exams/CE permanently redirects (308) to /exams/ce.
- /exams/zz returns 404 inside the Website shell. So does an Exam with no visible Products (test this with a seam fixture or mock).
- examStats ignores Coming Soon Products entirely. With no ratings, averageRating is null and the tile shows "New". With only Coming Soon Products, productCount is 0 and priceFrom is null, so the From tile is hidden.
- On an Exam with one Live Product (e.g. ME): no comparison table and no format chips. Its Coming Soon Products render after the Live one with a "Coming soon" badge and no "₱".
- The CE bundle banner is hidden on every other Exam. It is also hidden when its Product is missing or Coming Soon (a fixture test).
- An Exam with no sample cards in content hides "Try a {code} card".
- reviewDisplayMode gives 0 → "empty" (with the message), 3 → "grid" and 4 → "marquee".
- With the switch off: no "Review {code} in the app", no "app plans" link, no In-the-app column, and no link starting with /app.
- A null shop link hides its store-band button.

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
- Read data only through @/services/catalogue, and build routes only with src/paths.ts.
- Never show a price for a Coming Soon Product. Never emit Review or AggregateRating structured data. Gate every Member App element on memberAppLive. Light-only.
- No new dependencies. shadcn primitives through the CLI are fine. Otherwise stop and ask.
- Out-of-scope bugs go in the report.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion marked ✅ or ❌, with the proving test or spec
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. copy needing client review (the sample cards, best-for, the bundle banner), deviations and follow-ups
6. the line "Nothing committed or pushed."
```
