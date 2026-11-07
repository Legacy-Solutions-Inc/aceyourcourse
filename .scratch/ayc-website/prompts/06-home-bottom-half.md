# Executer prompt — 06 Home, bottom half

Ticket: `.scratch/ayc-website/issues/06-home-bottom-half.md` · Blocked by: 05 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 / React 19 / TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the mockup doesn't settle a product decision.

GOAL
Complete Home below Best sellers:
- "Which format fits how you study?", with computed prices and Exams and links to filtered Products
- the one-minute video section
- the hand-picked Reviews wall
- the authenticity guide
- the store band
- the dated promo strip at the top of Home, which turns itself on and off in Philippine time

CONTEXT
- Already on docs/ayc-v1-planning:
  - Home's top half (src/app/(website)/page.tsx and src/components/website/home/*), the compressed video at public/media/ayc-promo-720p.mp4 with its poster at public/media/ayc-promo-poster.webp, and src/content/home.ts
  - the Catalogue seam: listProducts, listHomeReviews (the first 9 pinned, in pin order), and getWebsiteSettings (shopLinks, shopStats, memberAppLive, and promoBanner { visible, text, buttonLabel, href, startDate, endDate }, with ISO dates)
  - ReviewCard, StoreButton, MarketplaceLink, Marquee, productsHref (src/lib/catalogue/product-filters.ts), formatPeso, formatAsOf and src/lib/manila-time.ts
- Time zone: every day boundary uses Asia/Manila (UTC+8, no DST). The promo dates are inclusive Manila calendar days: on from 00:00 Manila on startDate until 23:59:59 Manila on endDate.
- Pages render per request, so the strip changes with no redeploy. Take `now` once per request.
- Mockup fixes: format cards link to /products pre-filtered by format; "From" prices and "For" Exams are computed from Live Products (the mockup hardcoded them, and they were wrong).
- With the Member App switch off, no section mentions or links to the app.
- Mockup: docs/mockup/website/Home_v2.dc.html items 5–9 (L174–268; formats logic at L344–348; Reviews at L349–351). Read docs/mockup/website/BUILD-MAP.md §3 "Home" items 5–9 first. The Admin's banner fields are in docs/mockup/admin/BUILD-MAP.md §3.2 ("Home promo banner").

SCOPE
Create:
- src/lib/catalogue/promo.ts and its test: isPromoActive(banner: PromoBanner | null, now: Date): boolean. It's false when the banner is null, when visible is false, when endDate is before startDate, or outside the inclusive Manila window.
- src/lib/catalogue/format-cards.ts and its test: formatCardStats(liveProducts, exams) returns, per format, { examCodes (in Exam order), priceFrom, coverPhoto (the best-selling Product's cover) }, or nothing for a format with no Live Products.
- In src/content/home.ts, add:
  - the format card copy (title, size, body; for Bundle, "₱200 less than buying each separately")
  - the video section copy
  - the Reviews section labels
  - the authenticity copy and its 3 steps
  - the store band copy, with app-on and app-off variants
- src/components/website/home/:
  - formats.tsx
  - video-section.tsx
  - home-reviews.tsx
  - authenticity.tsx
  - home-store-band.tsx
  - promo-strip.tsx
  with component tests for formats, home-reviews and promo-strip.
- Extend e2e/home.spec.ts.
Modify:
- src/app/(website)/page.tsx: add the sections in mockup order, with the promo strip above the hero.
- src/services/catalogue.schema.ts and its test: add the rule that promoBanner.endDate ≥ startDate, and that both are valid ISO dates.
Leave untouched: the top-half sections (only compose them), the seam's rules (except that one schema rule), docs/mockup/, docs/specs/ and docs/adr/.

SECTION BEHAVIOUR
- Promo strip:
  - rendered only when isPromoActive(settings.promoBanner, new Date())
  - shows the text, plus a button with buttonLabel linking to href
  - an external href opens in a new tab with rel="noopener noreferrer"; a Marketplace host also fires marketplace_click (link "shop")
- #formats:
  - heading "Which format fits how you study?" and the "Most passers mix two…" line
  - one card per format that has Live Products, showing the image (the computed cover), title, size, "For {codes joined with ' · '}" and "From {formatPeso(priceFrom)}"
  - each card links to productsHref({ format })
  - the "Prefer your phone?" band with "See app plans →" (paths.memberApp.plans) shows only when the switch is on
- #video:
  - "Watch · 1 min", the H2 "See what's inside before you order." and the sub-line
  - <video controls playsInline preload="none" poster="/media/ayc-promo-poster.webp"> with the same MP4
  - if the video has spoken words, flag in the report that captions need a transcript from the client
- #reviews:
  - the labels "Copied word for word from Shopee" and "Pinned by reviewees"
  - the badge "{rating} · {ratingCount} shop ratings · {as of}"
  - listHomeReviews() split across two Marquee rows (first ceil(n/2), then the rest) of ReviewCards, with "View product →"
  - "Read every review on Shopee ↗", a MarketplaceLink to the Shopee shop page, hidden when null
  - the whole section is hidden when there are no pinned Reviews
- #authenticity: the IPOPHIL stamp, the copy, and the 3 steps from content.
- Store band:
  - the app-off copy "Physical copies from our official stores." (the mockup's "Digital in the app." part only when the switch is on)
  - StoreButtons for the 3 shop pages (product undefined, link "shop"), each hidden when null
  - "Open the app →" (paths.memberApp.home) only when the switch is on

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if Home's top half (src/components/website/home/hero-video.tsx) or listHomeReviews is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - in the spec: "Phase 1: Website" (stories 5–6, 8–9, 12; fixed copy; mockup fixes; Member App switch), "Architecture → Time zone" and "Testing Decisions"
   - BUILD-MAP §3 Home items 5–9
   - Home_v2.dc.html L174–268
   - the existing home components and content
3. Skills: test-driven-development, nextjs-app-router, tailwind-v4, shadcn-ui, testing-unit, testing-e2e and coding-standards.
4. TDD isPromoActive (boundary table), formatCardStats and the schema rule. Then the components (with tests), then the page and the e2e.
5. Verify. Run requesting-code-review on your diff and fix in-scope findings. Report.

ACCEPTANCE CRITERIA
Happy paths:
- Home shows, in order:
  - Formats, with a card for each format that has Live Products, its "For" Exams and "From" price computed
  - #video, with a player
  - #reviews, with 9 pinned Reviews across two rows, including the 3★ one
  - #authenticity
  - the store band
- Clicking the Posters format card goes to /products?format=posters.
- The links "Find your exam ↓", "▶ Watch 1 min" and "Spot a fake copy" (in the footer) scroll to #exams, #video and #authenticity on Home.
- isPromoActive is true for a visible banner at 2026-11-09T00:00+08:00 (2026-11-08T16:00:00Z) and at 2026-11-11T23:59:59+08:00 (2026-11-11T15:59:59Z), with start 2026-11-09 and end 2026-11-11. The strip then renders its text and button.
Sad paths (each one needs a test):
- isPromoActive is false:
  - at 2026-11-08T15:59:59Z (one second before the start, Manila time)
  - at 2026-11-11T16:00:00Z (one second after the end)
  - when visible is false
  - when the banner is null
  - when endDate is before startDate
  The seed's banner (visible false) renders no strip.
- Seed validation rejects a promo banner with endDate before startDate, or with an invalid date.
- formatCardStats omits a format with no Live Products, and its card isn't rendered. Coming Soon prices never affect "From".
- On a 390 px page load, no MP4 request is made even with the #video section present (preload="none").
- listHomeReviews returning [] hides #reviews. A null Shopee shop link hides "Read every review on Shopee".
- With the switch off: no "Prefer your phone?" band, no "Open the app", no "Digital in the app" copy, and no link starting with /app anywhere on Home.

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
- Read data only through @/services/catalogue, and build routes only with src/paths.ts and productsHref.
- Never emit Review or AggregateRating structured data. Gate every Member App element on memberAppLive. Light-only.
- No new dependencies. Otherwise stop and ask.
- Out-of-scope bugs go in the report.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion marked ✅ or ❌, with the proving test or spec
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. copy needing client review (format cards, the store band, captions), deviations and follow-ups
6. the line "Nothing committed or pushed."
```
