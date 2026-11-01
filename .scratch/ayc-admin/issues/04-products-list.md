# 04 — Products list

**What to build:** Editors see every Product, including Coming Soon and hidden ones, in the mockup's Products & store links list.

- **Each row shows:**
  - the thumbnail
  - the short name
  - the format and units sold
  - the Exam
  - the price label
  - S/L/T badges with "n/3"
  - inline App and Site toggles
- **Filters:** search, Exam chips and "Missing product links".
- **Order:** sorted by units sold.
- **Toggles.** Turning "Show on website" or "Available in app" on or off saves at once and updates the Website.

**Blocked by:** 02 — Settings, and the shared save path

**Status:** ready-for-agent

Spec: Phase 2 stories 63, 66 (the toggles), 68; Implementation Decisions → Phase 2 (Products: the list; Live on save; Conflict check, where single toggles always save). Mockup: BUILD-MAP §3.3 (List). Conventions: §2 (`?product=`), §3.

- [ ] **The rows** follow the mockup:
  - "PRODUCT · N"
  - "FLASH CARDS · 764 SOLD"
  - "₱400+" for a price range, and "COMING SOON" with no price for a Coming Soon Product
  - the "GREEN = PRODUCT LINK · AMBER = OPENS THE SHOP PAGE" legend

  Rows hidden from the Website are dimmed.

- [ ] **Sorting.** Live Products are sorted by units sold, then by title. Coming Soon Products come after them.
- [ ] **Filters.** Search (title and short name, case-insensitive), the Exam chips ALL/CE/ME/EE/MT/CPA and "Missing product links" combine.
  - "Missing product links" shows Live Products without their own Listing on a Marketplace whose shop link is set in Settings.
  - The filters live in the URL, so a refresh keeps them.
- [ ] **Empty states.** No match shows a "No products match" state with "Clear filters". An empty catalogue shows its own empty state.
- [ ] **The App and Site toggles** save immediately with no conflict check, and the Website changes on the next load:
  - Site off: the Product disappears from Products, its Exam page, Home and its own page, which then answers 404.
  - App on: shows the "ALSO IN APP" badge only while the Member App switch is on.

  A failed toggle reverts and shows the "Couldn't save" toast. Each toggle appends Staff Activity.

- [ ] **Opening a Product.** Clicking a row selects it (`?product=<id>`). The editor panel is ticket 05; until then, the panel shows "Select a product". "+ Add product" goes to `?product=new`.
- [ ] **Sad paths:**
  - toggling a Product that was deleted elsewhere returns not-found and shows a message
  - a signed-out toggle is refused
- [ ] **Tests:** seam tests for the list query (sorting, each filter, combinations, missing links with an empty shop link), the toggles, an e2e that hides a Product and sees the Website 404, and axe.
