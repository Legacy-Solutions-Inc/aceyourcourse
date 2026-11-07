# 05 — Product editor

**What to build:** Editors add and edit Products in the mockup's editor panel, and the Website shows each save at once.

- **The fields:**
  - full name, short name and edition
  - Exam, format, and size and paper
  - Subjects, chosen from the Exam's Subjects
  - price from and price up to, and variations
  - Shopee rating, number of ratings and units sold
  - What's inside, and Made for
  - a Listing per Marketplace
  - SEO title and description
  - Coming Soon, Deal, Available in app and Show on website
- **Deleting** needs a typed DELETE, and the dialog shows exact counts of what goes with the Product.
- **Photos** are shown here but can't be edited until ticket 06.

**Blocked by:** 04 — Products list

**Status:** ready-for-agent

Spec: Phase 2 stories 64 (minus photo editing), 65, 66, 67, 68, 69; Implementation Decisions → Phase 2 (Products, Deleting, Conflict check, Live on save, Staff Activity). Mockup: BUILD-MAP §3.3 (Editor panel), §2 deleteProduct. Conventions: §3, §4.

- [ ] **The panel follows the mockup's fields and copy**, adding Coming Soon and Deal under Visibility.
  - The Exam select reads "CE · CELE".
  - The Subject chips come from the selected Exam. Changing the Exam drops any Subject not on the new Exam.
  - The Shopee figures note: "Copy these from the Shopee listing. Best sellers on Home are ranked by units sold."
- [ ] **Coming Soon** hides price, variations, Listings and Shopee figures, and saves without them. That follows the seed's Coming Soon rules.
- [ ] **New Products.**
  - The page address is generated from the full name and made unique (`-2`, `-3`…). It is shown read-only as `aceyourcourse.ph/products/{slug}` and never changes on later saves.
  - A new Live Product needs at least one photo, so until ticket 06 the editor says "Add at least one photo to make it Live". It can be saved as Coming Soon.
- [ ] **Shopee figures.** Saving them sets their "as of" date to today in Manila time. They are all-or-nothing: a rating without a number of ratings and units sold is refused.
- [ ] **Validation**, with field-level messages:
  - "ADD A NAME AND PRICE TO SAVE"
  - a price that is negative, not a number, or has more than 2 decimals
  - price up to below price from
  - a variation with no name or no price
  - a Listing on the wrong domain for its Marketplace
  - a rating outside 0–5
  - an SEO title over 60 characters or a description over 160, shown live by the counters
- [ ] **SEO.** Blank title and description fields show the generated text as their placeholder.
- [ ] **Saves.**
  - The save states, the conflict check and the "Couldn't save" toast all work as in ticket 02.
  - A save shows "✓ SAVED · LIVE ON THE SITE".
  - The Product page, Products, its Exam page and the Home best sellers all show the change on the next load.
  - "View page ↗" opens it.
- [ ] **Delete** opens the typed-DELETE dialog, with the mockup's copy and exact counts: "N Reviews and N photos are deleted with it. N FAQ quotes from its Reviews are removed. Store listings on Shopee, Lazada, and TikTok Shop are not affected."
  - Confirming removes the Product, its Reviews and photos, and those FAQ quotes.
  - Its page then answers 404.
  - Staff Activity keeps the values from before.
  - A wrong word leaves the Delete button disabled.
- [ ] **Sad paths:**
  - a stale save gets the conflict message
  - saving or deleting a Product that was deleted elsewhere returns not-found
  - a write that would break the catalogue's rules is refused with nothing changed
- [ ] **Tests:** seam tests for every rule above, the e2e journeys (edit a price and see it on the Website; add a Coming Soon Product; delete with counts) and axe.
