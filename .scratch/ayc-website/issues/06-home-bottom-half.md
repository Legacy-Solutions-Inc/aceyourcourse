# 06 — Home, bottom half

**What to build:** Home is completed below Best sellers. It adds:

- "Which format fits how you study?", with prices and Exams computed from the catalogue and cards that open Products filtered by format
- the one-minute video section
- the scrolling wall of hand-picked Reviews, including the critical one
- the authenticity guide on spotting fake copies
- the store band
- the dated promo strip at the top of Home, which appears and disappears by itself in Philippine time

**Blocked by:** 05 — Home, top half

**Status:** ready-for-agent

Spec: Phase 1 stories 5–6, 8–9, 12; Implementation Decisions → Phase 1 (fixed copy, mockup fixes, Member App switch), Architecture → Time zone. Mockup: BUILD-MAP §3 Home items 5–9.

- [ ] Formats:
  - 4 cards; copy comes from content config
  - "For" (the Exams with Live Products of that format) and "From" (the lowest Live price) are computed
  - a format with no Live Products hides its card
  - each card links to `/products?format=…`
  - the "Prefer your phone?" band shows only when the switch is on
- [ ] `#video`: the heading copy and a player with controls, using the same self-hosted file and poster as the hero. Nothing downloads before play.
- [ ] `#reviews`:
  - the Home selection (the first 9 pinned Reviews, in pin order, including the 3★ one) in two marquee rows
  - pauses on hover or focus, and is static under reduced motion
  - the shop-stats badge has an "as of" date
  - "Read every review on Shopee" links to the shop page and is hidden when that link is empty
  - with no pinned Reviews, the section is hidden
- [ ] `#authenticity`: the IPOPHIL copy and the three steps.
- [ ] Store band: the Marketplace shop buttons, which fire `marketplace_click`. "Open the app" shows only when the switch is on.
- [ ] Promo strip:
  - shows when it's visible, the start date has begun (00:00 Asia/Manila), and the end date hasn't passed (until 23:59:59 Asia/Manila)
  - hidden before the start, after the end, or when the banner is off or missing
  - its button follows its link
- [ ] Tests cover:
  - the promo window at each boundary, in Manila time
  - the format card computation (a missing format; the lowest price)
  - the Home Review selection (order, cap of 9, empty)
  - the anchors resolve in e2e
