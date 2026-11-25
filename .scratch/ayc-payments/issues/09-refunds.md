# 09 — Refunds

**What to build:** when an Owner refunds an Order in the PayMongo dashboard, PayMongo's refund event updates the Order and the Member's access automatically, and the Member is told in the app.

- **A full refund:** the Order becomes Refunded. Its days come off the Access Pass end (only that Order's days when purchases are stacked, using the pass history from ticket 03). If the end is then in the past, access ends now. The Member gets an in-app notice: "Your refund for AYC-10483 was processed. CE All-Access now ends {date}" or "…has ended".
- **A partial refund:** the Order stays Paid and shows "PARTIALLY REFUNDED · ₱300". Access doesn't change; the Owner can adjust it by hand. Partial refunds that add up to the whole amount count as a full refund.
- **Where it shows:** the Order's timeline, the Orders list status, the CSV's amount refunded, Billing, and the Acknowledgement's status (REFUNDED or PARTIALLY REFUNDED).
- **Logged** in Staff Activity as "PayMongo (system)", with the before and after end dates.
- Refund events follow ticket 05's rules: signature checked, applied once, out of order handled.

**Blocked by:** 05, 06, 07.

**Status:** ready-for-agent

Spec: Phase 4 → "Order ledger → Refunded", "Phase 4 planning decisions → Refunds"; stories 150, 151s.

- [ ] A full refund of a Member's only Order ends their access now and sends the notice.
- [ ] A full refund of the second of two stacked Orders removes only its days.
- [ ] A partial refund shows the amount and leaves the end date unchanged.
- [ ] Two partial refunds adding up to the full amount make the Order Refunded and remove its days.
- [ ] **Sad paths, each with a test:**
  - the same refund event twice removes the days once
  - a refund event for a Pending, Failed or Expired Order is ignored and logged
  - a refund that would push the end into the past ends access now, never earlier than now
  - a refund doesn't touch days from grants or other Orders
  - a Refunded Order never becomes Paid again
  - the end date is right across Manila midnight
