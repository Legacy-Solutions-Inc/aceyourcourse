# 11 — Sitemap, robots, Organization data and site-wide checks

**What to build:** Search engines find every Website page. The sitemap lists every Exam and Product page plus the static pages. Robots keeps the signed-in areas out. Organization structured data links AYC's Marketplaces and socials. Then the whole public Website is checked end to end:

- accessibility on every page
- mobile layout without horizontal scroll
- the main buying journey
- that no Member App link leaks while the switch is off

**Blocked by:**

- 02 — Product page
- 03 — Products page
- 04 — Exam pages
- 06 — Home, bottom half
- 07 — Reviews page
- 08 — FAQ page
- 09 — About page
- 10 — Legal pages

**Status:** ready-for-agent

Spec: Phase 1 stories 44, 46–49; Implementation Decisions → SEO; Testing Decisions → Seam 5 (Website journeys), existing helpers (SEO helper tests). Prior art: `e2e/a11y.spec.ts`, the seo helper tests.

- [ ] The sitemap:
  - is built from the Catalogue seam and the site-URL setting
  - lists the static pages, every Exam page and every Product page shown on the Website
  - leaves out hidden Products and any auth, Member App or Admin route
- [ ] Robots allows the Website and disallows `/app/`, `/admin/` and `/auth/` (plus `/dashboard/` while it exists), and points at the sitemap.
- [ ] Organization JSON-LD (name, URL, logo, contact email, `sameAs` with the non-empty Marketplace shop and social links) appears on every Website page.
- [ ] No JSON-LD anywhere on the Website contains rating or review markup. A test scans every builder's output.
- [ ] Accessibility: axe finds no serious or critical issues on every public page: Home, Products, a Live Product, a Coming Soon Product, an Exam, Reviews, FAQ, About, both Legal pages and the 404. No rule exceptions.
- [ ] Mobile: at 390 px wide there's no horizontal scroll on any public page, and the mobile menu opens and navigates.
- [ ] Journey: Home → Exam → Product → the Shopee button's href equals that Product's Listing and opens in a new tab. A Product without a Lazada Listing has its Lazada button go to the shop page.
- [ ] With the switch off, no public page contains a link into the Member App.
- [ ] Every internal link on every public page resolves (no 404s), apart from links to the Member App.
- [ ] Tests: the seo helper unit tests (happy: everything included, absolute URLs; sad: hidden Product excluded, no auth routes, empty `sameAs` links dropped) plus the Playwright suites above.
