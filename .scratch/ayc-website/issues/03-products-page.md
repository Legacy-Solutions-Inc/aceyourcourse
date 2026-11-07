# 03 — Products page

**What to build:** A Visitor can browse every Live Product at `/products`. They can search by name, Exam or Subject; filter by Exam, format and maximum price; and sort by best selling, price (both ways) or top rated. Every filter is reflected in the URL, so a view can be shared or bookmarked. Coming Soon Products sit in their own row. A "Help me choose" two-question picker recommends one Product with a reason. An empty result offers "Clear filters".

**Blocked by:** 02 — Product page

**Status:** ready-for-agent

Spec: Phase 1 stories 13–20; Implementation Decisions → Routes (`exam`, `format`, `q`, `sort`, `max`), Coming Soon rules, Member App switch. Mockup: BUILD-MAP §3 Products.

- [ ] Hero:
  - the pill and the Exam list are computed from the catalogue
  - "Most are also in the app"-style copy is computed and shows only when the switch is on
  - "Help me choose" and "Browse all" scroll to their sections
- [ ] The filter bar has search, sort, Exam chips with counts, format chips with counts, a max-price slider (bounds computed from Live prices) and "Clear filters". The "Also in app" toggle shows only when the switch is on.
- [ ] Every filter change updates the URL without a full reload, and loading a filtered URL restores the same view.
- [ ] Invalid query values (an unknown Exam or format, a non-numeric max, an unknown sort) fall back to the defaults without an error.
- [ ] The count reads "N of M reviewers". M counts Live Products only.
- [ ] The grid uses ProductCard with the three store buttons, which fire `marketplace_click` with page `/products`.
- [ ] The Coming Soon row:
  - shows Coming Soon Products that match the Exam, format and search filters
  - ignores price and sort
  - shows no prices
  - is hidden when empty
- [ ] Coming Soon Products never appear in the grid, the counts, the sort, the price filter or the picker.
- [ ] The "Help me choose" picker:
  - takes the Exam (only Exams with Live Products) and a study style
  - recommends one Live Product, with a reason, using the mockup's format preferences
  - falls back to the Exam's best seller
  - offers "View reviewer" and "See all {Exam} reviewers", which sets the Exam filter and scrolls to the grid
  - hides its App option when the switch is off
- [ ] The empty state shows "No reviewers match those filters", "Clear filters", and "Browse Shopee" (hidden when there's no shop link).
- [ ] The "Physical or app?" section is hidden while the switch is off.
- [ ] Metadata: title, description and canonical. Filtered views are canonicalised to `/products`.
- [ ] Tests:
  - the filter parser and serializer (round trip; invalid values)
  - the picker (a match, the fallback, an Exam with only Coming Soon Products, App hidden)
  - an e2e spec: filtering updates the URL, a reload keeps it, an invalid parameter is ignored, the empty state, and Clear filters
