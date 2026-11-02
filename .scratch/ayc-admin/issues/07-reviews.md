# 07 — Reviews

**What to build:** Editors curate Reviews under Reviews & FAQs → REVIEWS.

- **The list:**
  - search, Exam chips, star chips and "Pinned on Home only"
  - the counters "N REVIEWS" and "N OF 9 PINNED ON HOME", which warns above 9
  - a HOME pin toggle on each row
  - with "Pinned on Home only" on, ▲▼ reorders the Home order
- **The editor:**
  - stars, and the text copied word for word
  - the Product, and an optional variation
  - the Marketplace, and helpful votes
  - Pin on Home
  - a live preview using the Website's Review card
- **Changes go live.** Adding, editing and deleting all show on the Website.
- **Deleting** removes the FAQ quotes taken from that Review, and the dialog says how many.

**Blocked by:** 02 — Settings, and the shared save path

**Status:** ready-for-agent

Spec: Phase 2 stories 70, 71, 72; Implementation Decisions → Phase 2 (Reviews, Deleting, Conflict check). Mockup: BUILD-MAP §3.4 (REVIEWS tab), §2 deleteReview, `ReviewCard.dc.html`. Conventions: §2 (`/admin/reviews`), §3.

- [ ] The REVIEWS and FAQS tabs follow the mockup. FAQS shows an empty body until ticket 08.
- [ ] **The list.**
  - Rows follow the mockup: stars, a 2-line excerpt, and the meta line "CE · ULTIMATE CE POSTERS 2.0 · MSTC, HPGE, PSAD · SHOPEE · 19 HELPFUL", showing the Review's real Marketplace.
  - Filters: search over the text, Exam, stars (ANY ★ / 5★ / 4★ / 3★ and below) and "Pinned on Home only".
  - The filters combine, and they live in the URL.
  - The footer note follows the mockup.
- [ ] **Pinning.**
  - Turning the pin on saves at once and adds the Review to the end of the Home order. Turning it off removes it.
  - "N OF 9 PINNED ON HOME" turns red, with "· HOME SHOWS THE FIRST 9", above 9.
  - With "Pinned on Home only" on, each row gets ▲▼, which reorders the pins and saves at once.
- [ ] **The editor.**
  - Stars from 1 to 5.
  - REVIEW TEXT · COPY WORD FOR WORD, with line breaks kept.
  - PRODUCT: Live Products only, shown as "CE · CE Formula Flash Cards".
  - VARIATION BOUGHT · OPTIONAL: that Product's variations, or "Not specified".
  - STORE: Shopee, Lazada or TikTok Shop.
  - HELPFUL VOTES: a whole number of 0 or more.
  - Pin on Home.
  - PREVIEW: the Website's Review card, shown once there is text.
- [ ] **Saves.** Saving or adding shows on the Product page, its Exam page, `/reviews`, and Home if it is pinned. Save states, the conflict check and the toast all work as in ticket 02.
- [ ] **Validation:**
  - "PASTE THE REVIEW TEXT TO SAVE"
  - stars outside 1–5
  - negative or fractional votes
  - a Coming Soon or unknown Product
  - a variation the Product doesn't have
- [ ] **Edits that break an FAQ quote.** An edit that removes the words an FAQ quote uses is refused, naming the FAQ: "The FAQ “What are the posters like?” quotes this Review. Edit that quote first."
- [ ] **Delete.** The confirmation uses the mockup's copy plus "N FAQ quotes from this Review are removed." Confirming deletes the Review and clears those quotes. Staff Activity keeps the values from before.
- [ ] **Sad paths:**
  - a stale save
  - pinning or deleting a Review that is already gone, which returns not-found
  - a signed-out action is refused
- [ ] **Tests:** seam tests for every rule above, e2e (add a Review and see it on its Product page; pin it and see it on Home; delete one with a quote and see the FAQ lose it) and axe.
