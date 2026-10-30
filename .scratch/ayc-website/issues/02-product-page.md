# 02 — Product page

**What to build:** A Visitor can open any Product at `/products/{slug}` and see everything needed to decide and buy:

- a photo gallery
- the Exam, format, size and edition
- the Subjects covered, with their full names
- prices: single, a range, or per variation
- Shopee figures with an "as of" date
- the deal badge
- store buttons that open the right Marketplace
- the Product's Reviews
- "More for the {board}"

Coming Soon Products show as announced, never as buyable, and never with "₱0". This ticket also defines the **complete Product and Review read contract** of the Catalogue seam, and ports the mockup's 15 Products (8 Live, 7 Coming Soon) and their Reviews into the seed with self-hosted photos. That way tickets 03–07 only consume it. It builds the shared ProductCard, ReviewCard, StoreButton and Marquee components, and the `/products` URL builder, so the parallel tickets after it don't collide.

**Blocked by:** 01 — Branded Website shell and Exams menu

**Status:** ready-for-agent

Spec: Phase 1 stories 19–28, 46, 48; Implementation Decisions → Phase 1 (Product model, Coming Soon rules, Store buttons, Shopee figures and Reviews, Media, SEO). Mockup: BUILD-MAP §3 Product detail, §4, §5.

- [ ] A Live Product page shows:
  - the breadcrumb (Products / {board} / {short name})
  - a keyboard-operable gallery with an "i / N" counter
  - the badges, title, and the Shopee rating, number of ratings and units sold "as of" a date
  - the price: a single price, a range, or the selected variation's price
  - the variations, with their prefix stripped, prices and no stock labels
  - the deal badge, when the Product has the deal
  - the Subjects covered, with full names
  - specs: format, size, ships from Iloilo City
  - the buy box
  - the description: What's inside, Made for, Authentic copies only (generated defaults when not set)
  - every Review, or "No written reviews yet…"
  - "More for the {board}" (up to 3 Live Products of the same Exam, by units sold), falling back to "Best sellers from other boards"
- [ ] Store buttons:
  - each uses the Product's Listing, then the Marketplace shop page, and is otherwise hidden
  - they open in a new tab and fire `marketplace_click` with the Product, Marketplace, page and link type
  - with all three hidden, the buy box shows a contact note instead
- [ ] A Coming Soon Product page shows the "Coming soon" badge and the placeholder photo. It has:
  - no price anywhere, and never "₱0"
  - no variations
  - no ratings or units sold
  - no buy buttons, except "Follow on Shopee" (the shop page) when it's set
  - no Product structured data
- [ ] The Member App band shows only when the switch is on and the Product is available in the app. The "Printed only" note also shows only when the switch is on.
- [ ] An unknown slug, or a Product with "Show on website" off, gives a branded 404 with HTTP status 404.
- [ ] Metadata: the title and description come from the SEO fields or generated defaults, plus a canonical URL and the cover as the OG image.
- [ ] JSON-LD: Product with Offers pointing at the Listings, and BreadcrumbList. There is never rating or review markup.
- [ ] Seam contract:
  - list Products with filter options (Exam, format, query, max price, available in app, state) and sort options (best selling, price up, price down, top rated)
  - get a Product by slug
  - related Products and best sellers
  - list Reviews with filters (Product, Exam, stars, query) and sorts (most helpful, highest, most critical, most detailed, the Exam page order)
  - the Home selection: the first 9 pinned
  - Exams are listed only when they have at least one Product shown on the Website
- [ ] Seed validation rejects:
  - duplicate ids or slugs
  - an unknown Exam or Subject
  - a Live Product without a price or photo
  - a Coming Soon Product with a price, Listing, figures or Reviews
  - a Listing URL on the wrong Marketplace host
  - Review stars outside 1–5
- [ ] Photos are self-hosted, optimised and never hot-linked from Shopee.
- [ ] Tests cover every rule above, both happy and sad paths. An e2e spec covers a Live Product, a Coming Soon Product and an unknown slug.
