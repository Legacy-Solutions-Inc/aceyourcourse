# 04 — Exam pages

**What to build:** Every Exam with Products on the Website gets its own page at `/exams/{code}`. A Visitor searching for their board's reviewer lands on AYC's coverage:

- the board, long name, blurb and Subjects
- computed stats
- every Product, best selling first, with format chips and a comparison table
- three sample formula cards
- the CE bundle offer
- Reviews from that Exam's reviewees
- a store band

Switching Exam changes the URL.

**Blocked by:** 02 — Product page

**Status:** ready-for-agent

Spec: Phase 1 stories 29–35; Implementation Decisions → Phase 1 (fixed copy in typed content config, Coming Soon rules, mockup fixes, SEO). Mockup: BUILD-MAP §3 Exam.

- [ ] `/exams/ce` renders the CE page. `/exams/CE` permanently redirects to the lowercase URL. An unknown code, or an Exam with no Products shown on the Website, gives a branded 404 with HTTP status 404.
- [ ] Hero:
  - the breadcrumb and an Exam switcher made of real links, so the URL changes
  - the code, board, long name, name and blurb
  - "See N reviewers" (scrolls to the list)
  - "Review {code} in the app", only when the switch is on and a Product is in the app
- [ ] Computed stats, all from Live Products only:
  - the number of Products
  - units sold
  - average rating, weighted by number of ratings, showing "New" when there are no ratings
  - the starting price, hidden when there's none
- [ ] An image stack of the top 3 Live Products, and a Subject ticker.
- [ ] "What's covered" shows numbered Subject cards with full names.
- [ ] "Every {code} reviewer":
  - Live Products by units sold, with "#1 in {code}" on the top seller, followed by Coming Soon Products (badge, no price)
  - format chips only when there's more than one format
  - cards link to Product pages, with no buy buttons
- [ ] "Which one should I get?" comparison table:
  - only when there are 2 or more Live Products
  - a "Best for" column from content config
  - an "In the app" column only when the switch is on
  - Coming Soon Products excluded
- [ ] "Try a {code} card": 3 sample formula cards from content config, which flip on click or keyboard. The section is hidden for an Exam with no sample cards. "Get the printed set" links to the top seller, and is hidden when there's no Live Product.
- [ ] The CE bundle banner comes from content config and references the bundle Product. Its price is read from the catalogue. It is hidden if that Product is missing or not Live.
- [ ] "From {code} reviewees": the first 7 Reviews across the Exam's Products, in best-seller order. With 4 or more they show as a marquee that pauses on hover and stops under reduced motion; with 1–3 as a grid; with none, the "No written reviews yet" message.
- [ ] The store band has the Marketplace shop buttons (hidden when empty), which fire `marketplace_click` with no Product.
- [ ] Metadata (title, description, canonical) and BreadcrumbList JSON-LD.
- [ ] Tests cover:
  - the stats (Coming Soon excluded, no ratings, only Coming Soon)
  - the Exam Review selection and its display mode
  - the redirect, 404 and switcher in e2e
