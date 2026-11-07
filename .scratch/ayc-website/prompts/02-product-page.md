# Executer prompt — 02 Product page

Ticket: `.scratch/ayc-website/issues/02-product-page.md` · Blocked by: 01 · Branch: `feat/website-02-product-page`

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 / React 19 / TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the mockup doesn't settle a product decision.

GOAL
Make /products/{slug} work end to end for every Product. In the same change:
- define the complete Product and Review read contract of the Catalogue Service Seam
- port the mockup's 15 Products (8 Live, 7 Coming Soon) and their Reviews into the seed, with self-hosted photos
- build the shared ProductCard, ReviewCard and StoreButton components
Tickets 03–07 then only consume this contract.

CONTEXT
- Ticket 01 (already on main) built:
  - the Catalogue seam (src/services/catalogue.ts, catalogue.mock.ts, catalogue.types.ts, catalogue.schema.ts, mock/catalogue.ts) with listExams, getExamByCode and getWebsiteSettings
  - the Website shell under src/app/(website)/
  - formatPeso (src/lib/money.ts), formatAsOf and manilaYear (src/lib/manila-time.ts) and trackMarketplaceClick (src/lib/analytics/events.ts)
  - the website components in src/components/website/
  - the Member App switch: settings.memberAppLive from MEMBER_APP_LIVE, default false
- AYC sells Products only on the Marketplaces. A Product has its own id and a readable slug. A Shopee item id is only part of its Shopee Listing URL, never its identity.
- Coming Soon Products are announced but not out. They have no price and aren't for sale. They show a badge and no price anywhere, never "₱0" (that's the mockup bug at Product.dc.html L162), with no buy buttons except an optional "Follow on Shopee" link to the shop page. They're excluded from counts, sorting, the price filter, the picker, best sellers, related Products and the ratings table, and appear only on their Exam page, in a "Coming soon" row on /products, and on their own Product page.
- Store buttons:
  - use the Product's Listing for that Marketplace, then the Marketplace shop page from settings; with neither, the button is hidden
  - the selected variation is not passed to the Marketplace
  - there are no stock labels, because the Marketplaces own stock
- Shopee figures (rating, number of ratings, units sold) are entered by hand and shown with an "as of" date. Reviews are curated and copied word for word. They're displayed, but NEVER emitted as Review or AggregateRating structured data.
- Money is in integer centavos (₱1,200 is 120000).
- Pages render per request (strict nonce CSP). The seam is in-memory, so no caching is needed.
- Mockup sources: docs/mockup/website/Product.dc.html, ProductCard.dc.html, ReviewCard.dc.html and docs/mockup/aycData.js. Read docs/mockup/website/BUILD-MAP.md §3 "Product detail", §4 and §5 first.

SCOPE
Types to add in src/services/catalogue.types.ts:
    type ProductFormat = "flash-cards" | "notebook" | "posters" | "bundle";   // labels: Flash cards, Notebook, Posters, Bundle
    type ProductState = "live" | "coming-soon";
    interface ProductVariation { name: string; price: number }               // centavos
    interface ProductPhoto { src: string; alt: string }                      // first = cover
    interface ShopeeFigures { rating: number; ratingCount: number; unitsSold: number; asOf: string }
    interface Product {
      id: string; slug: string; examCode: string; title: string; shortName: string;
      format: ProductFormat; size: string; edition: string | null; subjectCodes: string[];
      state: ProductState; priceFrom: number | null; priceTo: number | null;
      variations: ProductVariation[]; photos: ProductPhoto[];
      listings: Partial<Record<Marketplace, string>>; shopee: ShopeeFigures | null;
      deal: boolean; availableInApp: boolean; showOnWebsite: boolean;
      whatsInside: string | null; madeFor: string[] | null; seoTitle: string | null; seoDescription: string | null;
    }
    interface Review { id: string; productId: string; stars: 1 | 2 | 3 | 4 | 5; text: string; variation: string | null; helpful: number; marketplace: Marketplace; homePin: number | null }
    interface ReviewWithProduct extends Review { product: { slug: string; shortName: string; examCode: string } }
    type ProductSort = "best-selling" | "price-asc" | "price-desc" | "top-rated";
    interface ProductFilters { examCode?: string; format?: ProductFormat; query?: string; maxPrice?: number; availableInApp?: boolean; state?: ProductState; sort?: ProductSort }
    type ReviewSort = "most-helpful" | "highest" | "most-critical" | "most-detailed" | "exam-page";
    interface ReviewFilters { productSlug?: string; examCode?: string; stars?: "5" | "4" | "3-or-less"; query?: string; sort?: ReviewSort; limit?: number }
Seam methods to add to CatalogueService (src/services/catalogue.ts and catalogue.mock.ts):
    listProducts(filters?: ProductFilters): Promise<{ items: Product[]; total: number }>;
    getProductBySlug(slug: string): Promise<Product | null>;
    listRelatedProducts(product: Product, limit?: number): Promise<{ scope: "same-exam" | "other-exams"; items: Product[] }>;
    listBestSellers(limit: number): Promise<Product[]>;
    listReviews(filters?: ReviewFilters): Promise<{ items: ReviewWithProduct[]; total: number }>;
    listHomeReviews(): Promise<ReviewWithProduct[]>;
Seam rules (implement them and test each):
- Only Products with showOnWebsite are ever returned. getProductBySlug returns null for an unknown slug or a hidden Product.
- listProducts:
  - state defaults to "live"
  - query is case-insensitive over title, short name, Exam code, board, Exam name, format label, and Subject codes and names
  - maxPrice keeps priceFrom ≤ maxPrice
  - availableInApp filters
  - total is the count after filters
  - with state "coming-soon", sort and maxPrice are ignored and the order is Exam seed order, then title
- Sorts:
  - best-selling: unitsSold descending, Products without Shopee figures last, then title
  - price-asc and price-desc: by priceFrom, ties broken by unitsSold descending
  - top-rated: rating descending, then ratingCount descending, no figures last
- listRelatedProducts: up to limit (default 3) other Live Products of the same Exam by units sold. With none, the best sellers from other Exams, with scope "other-exams".
- listBestSellers: Live Products that have Shopee figures, by units sold.
- listReviews:
  - only Reviews of visible Live Products, filtered by Product slug, Exam, star bucket ("3-or-less" is ≤3) and query (text, Product short name, variation)
  - most-helpful (the default): helpful descending, then stars descending, then text length descending
  - highest: stars descending, then helpful
  - most-critical: stars ascending, then helpful descending
  - most-detailed: text length descending
  - exam-page: the Products' best-seller order, then seed order
  - limit applies after sorting
- listHomeReviews: Reviews with homePin set, ordered by homePin, capped at 9.
- listExams now returns only Exams with at least one visible Product, Live or Coming Soon. getExamByCode is unchanged.
Seed: src/services/mock/catalogue.ts.
- Port all 15 Products and their Reviews from aycData.js:
  - slugs: kebab-case from the short name, e.g. "ce-formula-flash-cards"
  - ids: stable strings independent of the slug and the Shopee id
  - the Shopee `url` becomes listings.shopee for Live Products; the 7 PENDING items become state "coming-soon" with no listings
  - the DIGITAL ids become availableInApp
  - priceFrom and priceTo are converted to centavos
  - shopee figures use asOf "2026-10-29"
- homePin: the Home selection the mockup hand-picks at Home_v2.dc.html L349–351, by (productId, index). Pin the first 9 in that order, and make sure the 3★ MedTech notebook Review is one of them.
- Subjects: the Products' Subject strings disagree with each Exam's Subject codes (BUILD-MAP §8 item 10). Map each one to a code of its Exam with an explicit alias table, for example ME "Power & Industrial Plant" → PIP, EE "EE PROF. SUB." → "EE PROF", CPA "AUD THEORY" → AUD. Where you're unsure (for example MT "HTMLBE"), pick the closest Subject and list every mapping in your report for client confirmation.
Seed validation (extend src/services/catalogue.schema.ts; test every rule):
- ids and slugs are unique; slugs are kebab-case
- examCode exists, and every subjectCode belongs to that Exam
- Live: priceFrom > 0; priceTo is null or ≥ priceFrom; every variation price > 0; at least 1 photo
- Coming Soon: priceFrom and priceTo are null, with no variations, no listings, no shopee figures and no Reviews
- a listing URL is https and its host matches its Marketplace (shopee.ph, lazada.com.ph, tiktok.com or vt.tiktok.com)
- Shopee rating is 0–5, counts are ≥ 0, and asOf is a valid ISO date
- Review stars are 1–5, the text is non-empty, and productId is an existing Live Product
- homePin values are unique positive integers
Pure helpers (src/lib/catalogue/, each with a test file):
- price.ts:
  - productPriceLabel(p): "₱1,200", or "from ₱600" when priceTo is set; null for Coming Soon
  - productPriceRange(p): "₱600–₱1,550" or "₱1,200"; null for Coming Soon
  - variationLabel(name): strips the "PREFIX: " part
- store-links.ts:
  - resolveStoreLink(product | null, marketplace, shopLinks): { href, link: "listing" | "shop" } | null
  - for a Coming Soon Product, every buy link is null and followLink(shopLinks) returns the Shopee shop page or null
- product-copy.ts: default whatsInside, the Made-for list and SEO title and description from the Product and its Exam (the mockup's template sentences at Product.dc.html L104–112). The SEO title is ≤ 60 characters and the description 80–160 characters, both tested.
- json-ld.ts:
  - productJsonLd(product, exam, siteUrl): name, image, brand "Ace Your Course", and one Offer per Listing (url, price in pesos, priceCurrency "PHP"), or an AggregateOffer with lowPrice and highPrice when priced as a range. Shop-page fallbacks are NOT Offers. Never aggregateRating or review. Returns null for Coming Soon.
  - breadcrumbJsonLd(items, siteUrl)
Components (src/components/website/):
- json-ld.tsx: renders <script type="application/ld+json" nonce={x-nonce}> with "<" escaped as <.
- store-button.tsx: a client component. It opens in a new tab with rel="noopener noreferrer" and an aria-label such as "Buy on Shopee (opens in a new tab)", and calls trackMarketplaceClick({ product: slug or undefined, marketplace, page: pathname, link }).
- product-card.tsx: from ProductCard.dc.html. Coming Soon variant: the badge, no price and no figures. The "In app" badge shows only when memberAppLive && availableInApp. It has an optional store-buttons row.
- review-card.tsx: from ReviewCard.dc.html. Stars with an accessible label, the text with its line breaks kept, the variation or "Variation not specified", "{n} found this helpful" only when above 0, and an optional "View product →" link.
- product-gallery.tsx: a client component. Main image (next/image; the cover gets priority), an "i / N" counter, and thumbnail buttons with aria-labels; the arrow keys move between photos. Coming Soon shows the placeholder.
- variation-picker.tsx: a client radio group (`pnpm dlx shadcn@latest add radio-group` is allowed). With nothing selected the header shows the range; selecting a variation shows its price.
- marquee.tsx: a reusable horizontal marquee for tickets 03–06 (tickers and Review rows). It duplicates its children with the copy aria-hidden, pauses on hover and focus-within, renders as a static row under prefers-reduced-motion, and takes a speed prop. Add a component test for the reduced-motion and aria-hidden behaviour. No page uses it yet.
Shared URL helper (src/lib/catalogue/product-filters.ts, with a test): productsHref(filters: { exam?: string; format?: ProductFormat; q?: string; sort?: ProductSort; max?: number; app?: boolean }) builds paths.products.list with the query keys exam (lowercase), format, q, sort, max (whole pesos) and app=1, in that fixed order. Defaults (no filter, sort "best-selling") are omitted, so productsHref({}) is "/products" and productsHref({ format: "posters" }) is "/products?format=posters". Ticket 03 adds the parser to this file. Tickets 06 and 09 use it for links.
Page: src/app/(website)/products/[slug]/page.tsx with generateMetadata.
- It follows BUILD-MAP §3 "Product detail" items 1–6, with these rules:
  - Without variations: a priceTo note "Sold per subject or as a full set. Pick your option on the store page: ₱X to ₱Y.", or "One option: the complete set."
  - Specs: format, size, and "Ships from Iloilo City" (content config).
  - Buy box: the header "Printed copy · {price} · Ships from Iloilo City", then the Shopee, Lazada and TikTok Shop StoreButtons. With all three hidden, show "Store links coming soon. Questions? {contact email}".
  - Member App: when the switch is on, the "Also available in the app… Included in {code} All-Access" band with "See plans →" (paths.memberApp.plans) if availableInApp, otherwise "Printed only · not available in the app". When the switch is off, neither.
  - Reviews: "★ {rating} · {ratingCount} ratings on Shopee · {as of}", then every Review in CSS columns, or the mockup's "No written reviews yet…" text. Coming Soon pages have no ratings or Reviews section.
  - More: "More for the {board}" or "Best sellers from other boards" with up to 3 ProductCards; hidden when there are none.
  - JSON-LD: Product (Live only) and BreadcrumbList (Products, then {board}, then the short name).
- Metadata: the SEO fields or their defaults, a canonical URL from paths, and the cover photo as the OG image.
- An unknown or hidden slug calls notFound(). Make sure the 404 renders inside the Website shell and returns HTTP 404.
- Deal text "Shopee: any 2 enjoy 4% off", the IPOPHIL "Authentic copies only" copy and "Ships from Iloilo City" go in src/content/website.ts.
Photos:
- Extract the Shopee photos into a NEW, EMPTY directory outside the repo (for example under $TMPDIR):
  - unzip -j "/Users/rafaeliiiprudente/Downloads/Ace Your Course Mockup (1).zip" "export/AceYourCourse Website.html" -d <tmp>/zip
  - python3 -I docs/mockup/tools/unbundle.py "<tmp>/zip/AceYourCourse Website.html" <tmp>/unpacked
- Match the files to the image hashes in aycData.js.
- Convert to WebP with `cwebp -q 80`, longest side ≤ 1200 px, each ≤ 200 KB, up to 8 per Product, in seed order, into public/products/{slug}/{n}.webp.
- Copy docs/mockup/assets/product-photo-soon.svg to public/products/coming-soon.svg.
- Alt text: "{title}, photo {i} of {n}".
- If any Live Product ends up with zero photos, stop and report.
Tests:
- src/services/catalogue.test.ts (extend), catalogue.schema.test.ts (extend), and the src/lib/catalogue/*.test.ts files
- component tests for StoreButton, VariationPicker, ProductGallery and ProductCard (Coming Soon)
- e2e/product.spec.ts
Leave untouched: docs/mockup/, docs/specs/, docs/adr/, the dashboard and auth code, and the other Website pages.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if src/services/catalogue.ts with getWebsiteSettings is not on main (ticket 01 isn't merged).
   - Otherwise run `git switch -c feat/website-02-product-page main`.
2. Read:
   - AGENTS.md and CONTEXT.md
   - in the spec: "Phase 1: Website" (Implementation Decisions) and "Testing Decisions"
   - BUILD-MAP §3 "Product detail", §4, §5 and §8
   - Product.dc.html, ProductCard.dc.html, ReviewCard.dc.html and aycData.js
   - the existing catalogue seam and its tests
3. Skills: test-driven-development, nextjs-app-router, shadcn-ui, tailwind-v4, testing-unit, testing-e2e and coding-standards.
4. TDD the types and schema rules, then the seed port (it must pass validation), then the seam methods, then the pure helpers.
5. Photos.
6. Components (with component tests), then the page and metadata, then the e2e.
7. Verify. Run requesting-code-review on your diff and fix in-scope findings. Report.

ACCEPTANCE CRITERIA
Happy paths:
- /products/ce-formula-flash-cards shows:
  - the breadcrumb, the gallery with "1 / N" and working thumbnails and arrow keys
  - the CE · CELE, Second Edition and format badges, and the title
  - "★ 4.8 · 197 ratings · 764 sold · as of Oct 2026"
  - "₱1,200", the deal badge, the Subjects MSTC, HPGE and PSAD with full names, the specs and the buy box
  - the description, its 5 Reviews, and "More for the CELE"
- Its Shopee button's href is that Product's Shopee Listing URL, with target _blank. Its Lazada and TikTok Shop buttons go to the shop pages from settings. Clicking one captures marketplace_click with { product: "ce-formula-flash-cards", marketplace, page: "/products/ce-formula-flash-cards", link }.
- A Product with variations shows the range until a variation is selected, then that variation's price. Variation names show without their "PREFIX: ".
- The JSON-LD has a Product with Offers only for the real Listings, plus a BreadcrumbList.
- With MEMBER_APP_LIVE=true, a Product available in the app shows the All-Access band, and one that isn't shows "Printed only".
- listProducts and listReviews return the documented results for each filter and sort. listHomeReviews returns 9 Reviews in pin order, including the 3★ one.
Sad paths (each one needs a test):
- A Coming Soon page (e.g. /products/ce-solving-notebook) shows the "Coming soon" badge and the placeholder, and the main content contains no "₱". There are no Shopee, Lazada or TikTok buy buttons and no ratings or Reviews section. "Follow on Shopee" goes to the shop page and disappears when that link is null. There's no Product JSON-LD.
- productPriceLabel and productPriceRange return null for Coming Soon. No rendered Coming Soon card or page contains "₱0".
- An unknown slug and a Product with showOnWebsite false both return HTTP 404 inside the Website shell (nav visible).
- resolveStoreLink: a Listing goes to "listing"; no Listing but a shop page goes to "shop"; neither is null and the button is hidden. With all three null, the buy box shows the contact note.
- listRelatedProducts for an Exam with no other Live Products returns scope "other-exams" and excludes Coming Soon Products.
- Seed validation rejects:
  - a duplicate slug
  - an unknown Exam
  - a Subject not on the Exam
  - a Live Product with priceFrom null or 0
  - a Live Product with no photos
  - a Coming Soon Product with a price, a Listing or a Review
  - a Lazada Listing on a shopee.ph host
  - a Review with 0 or 6 stars
  - a duplicate homePin
- With the switch off, no "In app" badge, All-Access band, "Printed only" note or /app link renders.
- The JSON-LD never contains "aggregateRating" or "review" (asserted over every Product), and a title containing "</script>" is escaped.
- A Product with no Reviews shows the "No written reviews yet…" message.
- productsHref({}) is "/products", sort "best-selling" is omitted, and an Exam code is lowercased. The Marquee under reduced motion renders a static row with no animation class, and its duplicate copy is aria-hidden.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage`
- `pnpm test:e2e`
All must pass. Follow verification-before-completion. Also report the total size of public/products/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/website-02-product-page. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/. Run the zip and unbundle extraction outside the repo, with python3 -I.
- Never hot-link Shopee's CDN (down-ph.img.susercontent.com). Every image is self-hosted.
- Never add generateStaticParams, force-static, revalidate or ISR, and never weaken the CSP.
- Pages read only through @/services/catalogue and never import the seed. Every route comes from src/paths.ts.
- Never show a price for a Coming Soon Product. Never emit Review or AggregateRating structured data.
- Light-only; no dark: utilities.
- Every Member App element is gated on memberAppLive.
- No new runtime dependencies. shadcn primitives through the CLI are fine. If you think something else is needed, stop and ask.
- Out-of-scope bugs go in the report.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion marked ✅ or ❌, with the proving test or spec
3. the happy-path and sad-path tests you added
4. the results of each verification command, and the size of public/products/
5. the Subject alias table and any photo gaps (for client confirmation), deviations and follow-ups
6. the line "Nothing committed or pushed."
```
