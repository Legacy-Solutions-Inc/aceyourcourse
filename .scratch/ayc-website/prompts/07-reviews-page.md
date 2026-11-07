# Executer prompt — 07 Reviews page

Ticket: `.scratch/ayc-website/issues/07-reviews-page.md` · Blocked by: 02 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 / React 19 / TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the mockup doesn't settle a product decision.

GOAL
Build /reviews, where a Visitor reads every curated Review. It has:
- ratings by Product
- a searchable wall with Exam and star filters and four sort orders
- a per-Product filter set from the ratings table
- URL-synced filters
- a "Passed with our cards?" email invitation

CONTEXT
- Already on docs/ayc-v1-planning:
  - the Catalogue seam (src/services/catalogue.ts) with listReviews({ productSlug, examCode, stars: "5" | "4" | "3-or-less", query, sort: "most-helpful" | "highest" | "most-critical" | "most-detailed", limit }), listProducts(), listExams() and getWebsiteSettings() (shopStats with asOf, contactEmail)
  - ReviewCard (with the optional "View product →"), formatAsOf and paths.reviews
- Reviews are curated by AYC and copied word for word from Shopee, including the critical ones. They're displayed, but NEVER emitted as Review or AggregateRating structured data.
- Shop-level figures (4.8, 874 ratings, 3.7K followers) and Product-level figures are separate numbers. Always show an "as of" date.
- Coming Soon Products have no Reviews and are excluded from the ratings table (the mockup listed them at 0.0; that was a bug).
- The contact email comes from settings (aceyourcourseinc@gmail.com), never hardcoded.
- Pages render per request (nonce CSP). Filter changes call router.replace with no scroll.
- Mockup: docs/mockup/website/Reviews_v2.dc.html (logic at L117–130). Read docs/mockup/website/BUILD-MAP.md §3 "Reviews" first.

SCOPE
Create:
- src/lib/catalogue/review-filters.ts and its test:
  - parseReviewSearchParams(params, { productSlugs, examCodes }): accepts product (a known slug), exam (a lowercase known code), stars ("5" | "4" | "3-or-less"), q (trimmed, ≤ 100 characters) and sort (one of the 4). Anything else is ignored.
  - reviewsHref(filters): fixed key order product, exam, stars, q, sort; defaults omitted; base paths.reviews.
  - reviewFacetCounts(allReviews): counts by Exam and by star bucket.
- src/content/reviews-page.ts: hero copy, wall labels, the empty-state text, and the "Passed with our cards?" copy.
- src/app/(website)/reviews/page.tsx (with generateMetadata).
- src/components/website/reviews/: ratings-table.tsx, review-wall-filters.tsx (client), review-wall.tsx and passed-with-our-cards.tsx, with component tests for review-wall-filters and ratings-table.
- e2e/reviews.spec.ts.
Leave untouched: the seam's rules, the shared components' behaviour, docs/mockup/, docs/specs/, docs/adr/ and the other pages.

PAGE BEHAVIOUR (BUILD-MAP §3 "Reviews", with these rules)
- Hero:
  - the H1 "What reviewees say after using them."
  - the sub-line about verified Shopee buyers, word for word, critical ones included
  - stat tiles from settings: "{rating} shop rating on Shopee", "{ratingCount} ratings", "{followers} followers", with the as-of date
- "Ratings by reviewer":
  - a row per Live Product that has Shopee figures, in best-seller order
  - each row shows the Exam code, short name, a rating bar (aria-hidden, with the rating as text) and "{ratingCount} ratings"
  - each row is a link to reviewsHref({ product: slug }) + "#wall"
- #wall:
  - search (an accessible label, the placeholder "font size, delivery, paper…", debounced 300 ms)
  - a sort select, defaulting to Most helpful
  - Exam chips and star chips (All, 5★, 4★, ≤3★) with counts and aria-pressed
  - a removable Product chip when a product filter is set
  - "Clear filters" (goes to paths.reviews)
  - "{N} of {M} written reviews", where M counts all written Reviews
  - ReviewCards with "View product →"
  - the empty state: the mockup's message plus "Clear filters"
- "Passed with our cards?":
  - "Send us a message! We would like to feature you and your story."
  - "Email us": mailto:{contactEmail}, with a subject "My board exam story"
  - "Browse reviewers": paths.products.list
- Metadata: title "Reviews from board passers", a description, and canonical paths.reviews for every filtered view. No Review or AggregateRating JSON-LD.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if listReviews or ReviewCard is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - in the spec: "Phase 1: Website" (stories 36–37, 10, 42; Shopee figures and Reviews) and "Testing Decisions"
   - BUILD-MAP §3 "Reviews"
   - Reviews_v2.dc.html
   - the seam's review rules and tests
3. Skills: test-driven-development, nextjs-app-router, shadcn-ui, tailwind-v4, testing-unit, testing-e2e and coding-standards.
4. TDD the parser, href and facets. Then the components, then the page, then the e2e.
5. Verify. Run requesting-code-review on your diff and fix in-scope findings. Report.

ACCEPTANCE CRITERIA
Happy paths:
- /reviews shows the hero with the shop figures and as-of date, a ratings row for every Live Product with figures, and every written Review sorted by most helpful, with "{M} of {M} written reviews".
- Clicking the "CE Formula Flash Cards" ratings row updates the URL to ?product=ce-formula-flash-cards#wall, shows only that Product's Reviews and a removable chip, and removing the chip restores all Reviews.
- The ≤3★ chip shows only Reviews with 3 stars or fewer, including the MedTech notebook Review. The count matches the chip's number.
- Sorting by "Most critical" puts the lowest-star Review first; "Most detailed" puts the longest text first.
- Searching "delivery" shows only Reviews whose text, Product short name or variation contains it.
- "Email us" is mailto:aceyourcourseinc@gmail.com (from settings).
- A Review's line breaks render as line breaks. A null variation shows "Variation not specified".
Sad paths (each one needs a test):
- /reviews?product=nope&exam=zz&stars=2&sort=bogus renders every Review with the defaults and no Product chip. The parser returns {} for those values.
- A combination with no matches (e.g. stars=3-or-less&exam=cpa, if CPA has no ≤3★ Reviews; pick a combination the seed really lacks) shows the empty state. Clear filters recovers.
- Coming Soon Products never appear in the ratings table, and the table has no "0.0" rows.
- helpful 0 shows no "found this helpful" text.
- Sort ties are stable: equal keys keep the seam's order (test with a fixture).
- The page's HTML contains no "aggregateRating", "@type":"Review" or "ratingValue".

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
- Read data only through @/services/catalogue, and build routes only with src/paths.ts and reviewsHref.
- Never emit Review or AggregateRating structured data. Never alter a Review's text. Light-only.
- No new dependencies. Otherwise stop and ask.
- Out-of-scope bugs go in the report.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion marked ✅ or ❌, with the proving test or spec
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. copy needing client review, deviations and follow-ups
6. the line "Nothing committed or pushed."
```
