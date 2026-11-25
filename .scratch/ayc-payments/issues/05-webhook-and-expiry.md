# 05 — The PayMongo webhook and Order expiry

**What to build:** PayMongo's webhook records payment outcomes as they happen, safely and exactly once, and Pending Orders expire after 24 hours without a per-minute job.

- **The webhook route** (`/api/paymongo/webhook`):
  - verifies PayMongo's signature with `PAYMONGO_WEBHOOK_SECRET` and rejects anything invalid with no change
  - applies each PayMongo event once (idempotent per event id), even if PayMongo sends it again
  - handles events arriving out of order
  - goes through the same ledger code as the status check
  - logs changes in Staff Activity as "PayMongo (system)"
- **Transitions added to the ledger:**
  - Failed → Paid (a retry on the same PayMongo page succeeds)
  - Expired → Paid (a late payment), with "Paid after expiry" on the Order's timeline
  - Paid and Refunded never move back (refunds arrive in ticket 09)
- **Expiry:**
  - a Pending Order older than 24 hours shows as Expired everywhere at read time
  - a daily sweep, added to the existing daily cron slot (protected like the existing cron), asks PayMongo once more for each overdue Pending Order and then records Expired
  - no per-minute cron

**Blocked by:** 04.

**Status:** ready-for-agent

Spec: Phase 4 → "PayMongo integration", "Phase 4 planning decisions → Recording an outcome"; stories 137, 149, 151g, 151h.

- [ ] A valid paid webhook for a Pending Order makes it Paid and extends the Access Pass.
- [ ] A Pending Order created 25 hours ago shows as Expired before the sweep runs.
- [ ] The sweep records overdue Orders as Expired after checking PayMongo.
- [ ] A paid webhook for an Expired Order makes it Paid, grants the days and notes "Paid after expiry".
- [ ] **Sad paths, each with a test:**
  - a bad or missing signature is rejected with no state change
  - a malformed payload is rejected
  - the same event twice grants once
  - a failed event after a paid event leaves the Order Paid
  - a paid event after a failed event makes it Paid
  - an event for an unknown Order is acknowledged and ignored, and logged
  - the sweep finding an overdue Order actually paid makes it Paid, not Expired
  - the cron route refuses a request without its secret
