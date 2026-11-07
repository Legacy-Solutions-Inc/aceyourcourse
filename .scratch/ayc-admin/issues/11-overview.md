# 11 — Overview

**What to build:** The Overview tells Staff what needs them today.

- the greeting and date, with "N things need you today."
- a **Needs attention** list, where each item links to its fix:
  - Products whose buy button opens a Marketplace's shop page
  - the promo banner off, or ending within 3 days
  - Exam pages whose search check isn't Good
  - Products hidden from the Website
  - trust figures older than 30 days, shown to Owners only
- quick actions: + Add product, + Add Review and + Add FAQ

**Blocked by:** 05 — Product editor, 10 — Home promo banner and announcement bar

**Status:** ready-for-agent

Spec: Phase 2 story 61; Implementation Decisions → Phase 2 (Overview, Menu). Mockup: BUILD-MAP §3.1 (greeting, quick actions, Needs attention; no KPI tiles, chart, orders or member panels). Conventions: §3 (`overview` area, pure helpers).

- [ ] **The greeting** follows the mockup's style: "THURSDAY · 22 OCT 2026", "Good morning, Angel." and "N things need you today.", or "Nothing needs you today." with no items.
- [ ] **Needs attention** uses the mockup's row style, with these items and copy:
  - "N product links use the shop page" → Add links (Products with "Missing product links" on)
  - "Promo banner is off: Turn it on in Exam pages & promo when the next sale starts." or "Promo banner ends {date}" → Open
  - "N exam pages need search fixes" → Fix (the first such Exam's SEO)
  - "N products are hidden from the website" → Review (the Products list)
  - "Trust figures are N days old" → Update (Settings, Owners only)
- [ ] **Quick actions:**
  - - Add product → `/admin/products?product=new`
  - - Add Review → `/admin/reviews?review=new`
  - - Add FAQ → `/admin/reviews?tab=faqs&faq=new`
- [ ] **One pure function** (`needs-attention.ts`) computes the items from catalogue data and today's date in Manila. Its tests cover the boundaries:
  - the banner ending in exactly 3 days (shown) and in 4 days (not shown)
  - trust figures exactly 30 days old (not shown) and 31 days old (shown)
  - zero of each item
  - Coming Soon Products never counting as missing links
- [ ] **Editors** never see the trust-figures item.
- [ ] **No Phase 4 content.** There are no sales tiles, chart, recent orders, member or top-content panels, and no "Paid today" card.
- [ ] **Updates after a fix.** Fixing an item elsewhere removes it from the Overview on the next load. e2e: add the missing Lazada link, and the count drops.
- [ ] **Tests:** the helper suite, an Overview page test and axe.
