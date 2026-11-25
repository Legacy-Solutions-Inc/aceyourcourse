# 11 — Sales figures and Needs attention

**What to build:** Owners see how the business is doing on the Admin Overview, and Needs attention lists the payment work waiting for them.

- **Who:** Owners only. An Editor's Overview shows no sales figures and no payment items.
- **KPI tiles** (each clickable to Orders or Users):
  - paid today, with "+₱X vs yesterday"
  - paid this month, with the change vs last month
  - active Members: Members with at least one active Access Pass, paid or granted, Staff excluded
  - Access Passes ending in the next 7 days
- **The rules:** days and months are Manila time; paid amounts count on the paid day; refunds are subtracted on the refund day, and each money tile shows "₱X refunded"; Test Orders are left out.
- **The paid-sales chart:** 14 or 30 days, daily net totals, with tooltips; today's bar highlighted.
- **The sidebar's "PAID TODAY" card:** paid today, number of Orders, number pending, linking to Orders. Owners only.
- **Needs attention** gains:
  - "N payments pending" (oldest age shown)
  - "N invoice requests to send"
  - "N Orders paid after expiry"
  - "Paid, account deleted · refund in PayMongo" (filled by ticket 14; the item and its count are in place here)

**Blocked by:** 08, 09.

**Status:** ready-for-agent

Spec: Phase 4 → "Phase 4 planning decisions → Orders and sales figures"; stories 151, 151w, 151x.

- [ ] An Owner sees today's paid total, this month's total and the chart, matching the fixture Orders.
- [ ] A refund today lowers today's figure and shows "₱X refunded".
- [ ] Needs attention shows pending payments and invoice requests with the right counts, linking to the filtered Orders list.
- [ ] **Sad paths, each with a test:**
  - an Editor sees no sales tiles, chart, card or payment items, and the figures are refused on the server
  - a payment at 23:59 and one at 00:01 Manila land on different days
  - Test Orders never count
  - Staff with an Access Pass aren't counted as active Members
  - a day with no sales shows ₱0 in the chart
  - with no Orders at all the tiles show ₱0 and Needs attention has no payment items
