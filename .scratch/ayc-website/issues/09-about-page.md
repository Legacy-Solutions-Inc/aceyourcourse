# 09 — About page

**What to build:** A Visitor trusts the people behind the products. `/about` tells AYC's story:

- the before and after
- the "How it grew" timeline
- the four mission tabs
- the Iloilo City roots, with store buttons

Its stats (the number of Products and Exams, shop rating, ratings and followers) are computed from the catalogue and settings, not hardcoded. The closing call to action lists every Exam.

**Blocked by:**

- 01 — Branded Website shell and Exams menu
- 02 — Product page (the Product count and store buttons come from the Product contract)

**Status:** ready-for-agent

Spec: Phase 1 story 40; Implementation Decisions → Phase 1 (About stats computed; About CTA lists every Exam; Media self-hosted). Mockup: BUILD-MAP §3 About.

- [ ] Hero:
  - the H1, "Read our story" and "See the reviewers"
  - the team photo with the IPOPHIL sticker
  - stats: Products (Live, shown on the Website), Exams (with at least one Product), and the shop rating, number of ratings and followers, "as of" a date
- [ ] The story, the before/after panel and the timeline. The "Now" Exam list is computed from the catalogue's Exam names.
- [ ] The mission tabs are keyboard operable (Radix Tabs semantics). Their copy comes from content config.
- [ ] Iloilo City roots: the copy, the Marketplace shop buttons (each hidden when empty, firing `marketplace_click`), and the mock shipping label.
- [ ] The CTA has a tile for every Exam with Products, linking to its Exam page, CPA included.
- [ ] The About photos are self-hosted and optimised, with alt text.
- [ ] Metadata: title, description and canonical.
- [ ] Tests cover:
  - the computed stats (Coming Soon excluded; an Exam with no Products not counted; an empty catalogue shows no zero-stat tiles)
  - the CTA lists every Exam
  - the e2e page render
