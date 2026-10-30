# 05 — Home, top half

**What to build:** The real Home replaces the placeholder from ticket 01, down to the Best sellers row. It has:

- the hero, with the compressed self-hosted promo video. On mobile, nothing downloads until the Visitor taps play.
- the headline and the trust line
- the "Try a card" flip widget
- the ticker
- "Four steps to your reviewer"
- "Find your exam", with each Exam's Subjects and Products by units sold
- the Best sellers carousel, ranked by units sold

**Blocked by:** 02 — Product page

**Status:** ready-for-agent

Spec: Phase 1 stories 1–4, 6–7, 10; Implementation Decisions → Phase 1 (Media, fixed copy in typed content config, Member App switch). Mockup: BUILD-MAP §3 Home items 1–4, §7 Media.

- [ ] The promo video is compressed to about 2–4 MB at 720p and self-hosted, with a poster.
- [ ] Hero video behaviour:
  - on desktop it plays muted and looped, unless the Visitor prefers reduced motion or has Save-Data on
  - below 760 px, only the poster shows and no video bytes download until the Visitor taps play
- [ ] Hero copy:
  - the H1 and sub-headline; the "also in the app" clause shows only when the switch is on
  - a trust line with the shop rating and number of ratings, "as of" a date
  - CTAs "Find your exam" and "Watch 1 min", plus "Try the app free" only when the switch is on
- [ ] "Try a card":
  - 3 sample cards from content config, which auto-flip every 3.2 s until the Visitor interacts
  - no auto-flip under reduced motion
  - flips by keyboard, with Exam dots and "Next card"
- [ ] The ticker comes from content config, with a static fallback under reduced motion.
- [ ] Four steps, from content config. With the switch off, no step mentions or links to the app (app-free copy variants, flagged for client review).
- [ ] "Find your exam":
  - tabs for every Exam with Live Products, operable by keyboard
  - the panel shows the name, board, long name, blurb and Subject chips with full names
  - "All {code} reviewers" goes to the Exam page; "Review {code} in the app" shows only when the switch is on
  - Product rows show Live Products by units sold, linking to their Product pages
  - there is no "Other courses" tab and no "Coming to the site" row
- [ ] Best sellers:
  - the top 6 Live Products by units sold, in a snap carousel whose ←/→ buttons disable at the ends
  - each card has a rank badge and a sold bar relative to #1
  - Products without Shopee figures are excluded
  - fewer than 6 shows what exists; zero hides the section
- [ ] Metadata: the Home title, description, canonical and OG image.
- [ ] Tests cover:
  - the video component: no source before tap on mobile; autoplay on desktop; none under reduced motion or Save-Data
  - the flip widget's timer and its stop on interaction
  - best-seller ranking and its edge cases
  - the steps with the switch off
  - the Home e2e smoke
