# 07 — Reviews page

**What to build:** A Visitor can read every curated Review at `/reviews`. The page has:

- ratings by Product
- a searchable wall with Exam and star filters and four sort orders (most helpful, highest, most critical, most detailed)
- a per-Product filter, set from the ratings table
- a "Passed with our cards?" email invitation

Every Review is labelled as copied word for word from Shopee.

**Blocked by:** 02 — Product page

**Status:** ready-for-agent

Spec: Phase 1 stories 36–37, 10, 42; Implementation Decisions → Phase 1 (Shopee figures and Reviews; no review structured data). Mockup: BUILD-MAP §3 Reviews.

- [ ] The hero shows the shop rating, number of ratings and followers, "as of" a date, all from Website settings.
- [ ] "Ratings by reviewer" lists one row per Live Product with Shopee figures, in best-seller order, with a rating bar and "{n} ratings". Coming Soon Products are excluded. Selecting a row filters the wall to that Product and scrolls to it.
- [ ] The wall:
  - searches Review text, Product and variation
  - sorts by most helpful (the default), highest rated, most critical or most detailed
  - has Exam chips and star chips (All, 5★, 4★, ≤3★), each with counts
  - shows a removable Product chip, "Clear filters", and "N of M written reviews"
- [ ] The wall's filters live in the URL (`product`, `exam`, `stars`, `q`, `sort`). Invalid values fall back to the defaults. An unknown Product slug is ignored, and the chip is not shown.
- [ ] ReviewCard shows the stars, the text with its line breaks, the variation ("not specified" when missing), helpful votes when above 0, and "View product".
- [ ] The empty state has the mockup's message and "Clear filters".
- [ ] "Passed with our cards?" has "Email us" (a mailto to the contact email from settings) and "Browse reviewers".
- [ ] Metadata: title, description and canonical. No Review or AggregateRating structured data.
- [ ] Tests cover:
  - each sort order, and ties
  - the star buckets, including ≤3
  - search across the three fields
  - the facet counts
  - the parser for invalid parameters
  - an e2e spec: a ratings row filters the wall, the URL updates, Clear filters, and the empty state
