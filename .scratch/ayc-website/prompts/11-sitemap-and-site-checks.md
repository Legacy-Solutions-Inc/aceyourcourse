# Executer prompt — 11 Sitemap, robots, Organization data and site-wide checks

Ticket: `.scratch/ayc-website/issues/11-sitemap-and-site-checks.md` · Blocked by: 02, 03, 04, 06, 07, 08, 09, 10 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 / React 19 / TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the mockup doesn't settle a product decision.

GOAL
Make every Website page findable, then prove the whole public Website works:
- a sitemap built from the catalogue
- robots that keeps the signed-in areas out
- Organization structured data on every page
- site-wide Playwright checks: accessibility on every page, no horizontal scroll on mobile, the main buying journey, every internal link resolving, and no Member App link leaking while the switch is off

CONTEXT
- Already on docs/ayc-v1-planning:
  - every Website page: /, /products, /products/[slug], /exams/[code], /reviews, /faq, /about, /legal/privacy and /legal/terms
  - the Catalogue seam (listExams, listProducts with state "live" and "coming-soon", getWebsiteSettings with shopLinks, socialLinks, contactEmail and memberAppLive)
  - the JSON-LD builders in src/lib/catalogue/json-ld.ts (productJsonLd, breadcrumbJsonLd) and src/lib/faq/faq-json-ld.ts (faqPageJsonLd), and the JsonLd component
- The existing SEO helper is src/lib/seo.ts (SITEMAP_ROUTES, buildSitemap and buildRobots, all pure) with src/lib/seo.test.ts. src/app/sitemap.ts and src/app/robots.ts call them. SITEMAP_ROUTES still lists /auth/sign-in and /auth/sign-up; remove them.
- The site URL comes from config.site.url (getSiteURL). The domain hasn't moved yet, so never hardcode a domain.
- Structured data rule: copied Marketplace reviews and ratings are NEVER emitted as Review or AggregateRating (Google's self-serving and third-party review policies). Product names contain the word "Review" (e.g. "CE Review Bundle 3-in-1"), so check JSON-LD KEYS and @type values, not text.
- The a11y suite is e2e/a11y.spec.ts (axe; it fails on serious and critical issues). Remove any remaining disableRules. Brand tokens were designed to pass color-contrast.
- The e2e web server runs `pnpm dev` with placeholder Supabase env vars and MEMBER_APP_LIVE unset (switch off).
- Read the spec's "Implementation Decisions → SEO" and "Testing Decisions → Seam 5 (Website)" first.

SCOPE
Modify:
- src/lib/seo.ts and src/lib/seo.test.ts:
  - STATIC_ROUTES = ["/", "/products", "/reviews", "/faq", "/about", "/legal/privacy", "/legal/terms"], via paths
  - buildSitemap(baseUrl, lastModified, { examCodes, productSlugs }) adds paths.exams.details(code) and paths.products.details(slug), with sensible priority and changeFrequency
  - buildRobots(baseUrl, { hasDashboard }) allows "/" and disallows "/app/", "/admin/", "/auth/" and "/relay/", plus "/dashboard/" only when hasDashboard. It keeps the sitemap URL and host.
- src/app/sitemap.ts: async. Read listExams(), and listProducts() for both states, then call buildSitemap. Add `export const dynamic = "force-dynamic"` so it always reflects the catalogue. This is the one place force-dynamic is wanted; force-static stays banned.
- src/app/robots.ts: pass hasDashboard depending on whether the src/app/dashboard route still exists (a constant you set by checking the tree now; ticket 13 removes it).
- src/lib/catalogue/json-ld.ts and its test: add organizationJsonLd(settings, siteUrl) with @type Organization, name "Ace Your Course", url, logo (an absolute URL to a raster brand image at least 112 × 112; use an existing PNG route or file, or add one under public/brand/), email, and sameAs (the non-null shopLinks and socialLinks only).
- src/app/(website)/layout.tsx: render the Organization JsonLd on every Website page.
- e2e/a11y.spec.ts: cover "/", "/products", "/products/ce-formula-flash-cards", "/products/ce-solving-notebook", "/exams/ce", "/exams/me", "/reviews", "/faq", "/about", "/legal/privacy", "/legal/terms" and "/this-page-does-not-exist", with NO disableRules. Leave /auth/sign-in only if that page still exists.
Create:
- src/lib/structured-data.test.ts: build every JSON-LD the Website emits (productJsonLd for every seeded Live Product, breadcrumbs, faqPageJsonLd for the visible FAQs, organizationJsonLd). Walk each object recursively and assert that no key is aggregateRating, review, reviews or ratingValue, and that no @type is Review or AggregateRating.
- e2e/website-journey.spec.ts:
  - Home → "All CE reviewers" (or the Exams menu → CE) → /exams/ce → a CE Formula Flash Cards card → its Product page
  - its Shopee button's href starts with "https://shopee.ph/" and contains "24292303887", and has target="_blank"
  - on a Product with no Lazada Listing, the Lazada button's href equals the Lazada shop page "https://www.lazada.com.ph/shop/aceyourcourse"
- e2e/website-sitewide.spec.ts. For every public page above:
  - (a) at 390 × 844, document.documentElement.scrollWidth ≤ window.innerWidth
  - (b) no a[href^="/app"] and no a[href*="/app/"] on the site origin
  - (c) collect every same-origin a[href] (strip the hash; skip /app and /relay), dedupe across pages, request each with Playwright's request API, and expect status < 400
  - (d) at 390 px, the mobile menu opens, and choosing "Products" lands on /products
  - (e) GET /sitemap.xml returns 200, contains every Exam and Product URL, and contains no "/auth/"; GET /robots.txt contains "Disallow: /app/"
Leave untouched: page features (fix only what these checks reveal, and list each fix in the report), docs/mockup/, docs/specs/ and docs/adr/.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if any of the pages listed in CONTEXT is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - in the spec: "Phase 1: Website" (SEO; Analytics; Member App switch) and "Testing Decisions"
   - src/lib/seo.ts and its test, the JSON-LD builders and the existing e2e specs
3. Skills: test-driven-development, nextjs-app-router, testing-unit, testing-e2e and coding-standards. Use systematic-debugging for any failing check.
4. TDD buildSitemap, buildRobots, organizationJsonLd and the structured-data walker. Then wire sitemap, robots and the layout. Then the Playwright suites.
5. When a site-wide check fails, fix the root cause in the page or component only when the fix is small and clearly within the Website's existing rules (a missing alt, a contrast issue, an overflowing element, a broken link). Otherwise stop and report it. List every fix.
6. Verify. Run requesting-code-review on your diff and fix in-scope findings. Report.

ACCEPTANCE CRITERIA
Happy paths:
- /sitemap.xml lists the 7 static pages, every Exam (/exams/ce … /exams/cpa) and every visible Product, Live and Coming Soon, as absolute URLs on config.site.url.
- /robots.txt allows "/", disallows "/app/", "/admin/", "/auth/" and "/relay/" (plus "/dashboard/" while it exists) and links the sitemap.
- Every Website page has one Organization JSON-LD with the Marketplace and social links in sameAs.
- Axe finds no serious or critical issues on any page in the list, including the 404 and a Coming Soon Product.
- The journey test passes: Home → Exam → Product → the correct Shopee Listing in a new tab.
- Every internal link on every public page returns < 400.
Sad paths (each one needs a test):
- buildSitemap leaves out a Product with showOnWebsite false (use a fixture), and never includes /auth/, /app or /admin. Every URL is absolute with no double slash after the host, on any baseUrl with or without a trailing slash.
- buildRobots without the dashboard has no "/dashboard/" rule.
- organizationJsonLd drops null links from sameAs. With every link null, sameAs is omitted, not an empty array.
- The structured-data walker test fails if a fixture JSON-LD contains an aggregateRating (prove the guard works with a negative case), and passes on the real outputs.
- With the switch off, no public page has a Member App link.
- At 390 px, no public page scrolls horizontally.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage`
- `pnpm test:e2e`
All must pass. Follow verification-before-completion.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/.
- Never add generateStaticParams, force-static, revalidate or ISR to pages, and never weaken the CSP. force-dynamic is allowed only on sitemap.ts.
- Never emit Review or AggregateRating structured data. Never hardcode the domain.
- Don't silence a check (no axe rule exceptions, no skipped tests) to make it pass. Fix the cause or report it.
- No new dependencies. Otherwise stop and ask.
- Out-of-scope bugs go in the report.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion marked ✅ or ❌, with the proving test or spec
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. every page or component fix the checks forced, anything you stopped on, and follow-ups
6. the line "Nothing committed or pushed."
```
