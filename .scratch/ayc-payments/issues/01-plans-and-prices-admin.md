# 01 — Plans & prices in the Admin

**What to build:** Owners manage the Plans sold in the Member App from a new "Plans & prices" screen in a new SALES group of the Admin sidebar. Each Plan has an Exam, a name, a duration (30, 90, 180 or 365 days, labelled 1, 3, 6 or 12 months), a price, Best value and On sale. A live preview shows the Plan as Members will see it.

- **Who:** Owners only. Editors don't see the SALES group, and every Plans action is refused for them on the server.
- **The list:** Exam chips, then each Plan with its period, price, the per-month figure ("₱433 / month"), a BEST VALUE tag and its On sale state. Footer: "PAID THROUGH PAYMONGO · MEMBERS RENEW THEMSELVES · NOTHING RENEWS AUTOMATICALLY".
- **The editor:** name, Exam, access period, price (whole pesos, ₱1–₱99,999), "Mark as best value", "On sale" ("Off hides it from Plans. Current buyers keep access."), the preview, and "Price changes apply to new purchases only. Members who already paid keep what they bought."
- **Rules:**
  - at most one Best value per Exam: ticking it on one Plan clears it from the others
  - at most one Plan on sale per Exam and duration
  - delete only a Plan that has never had an Order; otherwise switch it off (Orders arrive in ticket 03, so until then every Plan can be deleted, but the rule and its test are in place)
  - a Plan always unlocks all of its Exam's content (ADR 0010); there are no per-type "Unlocks" checkboxes
- **Starting Plans** (the mockup's prices): CE 30 days ₱499, 90 days ₱1,299 (Best value), 180 days ₱2,299; every other Exam 30 days ₱449.
  - On sale in the sample data.
  - On the live database the migration adds them **switched off**, until the client confirms the prices and an Owner switches them on.
- **Staff Activity** logs every create, edit, switch and delete, with the conflict check like other Admin editors.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

Spec: Phase 4 → "Plans", "Phase 4 planning decisions → Plans & prices"; stories 145, 146, 151p, 151q, 151r.

- [ ] An Owner creates a 365-day CE Plan, sees it in the preview with its per-month figure, saves it, and it appears in the list.
- [ ] Ticking Best value on one CE Plan clears it from the other CE Plans.
- [ ] Switching a Plan off keeps it in the Admin list, marked off.
- [ ] The sample data has the starting Plans on sale; the migration adds them switched off.
- [ ] **Sad paths, each with a test:**
  - an Editor sees no SALES group and is refused every Plans action on the server
  - a price of 0, a decimal, or above ₱99,999 is refused with a field message
  - a duration other than 30, 90, 180 or 365 is refused
  - a second Plan on sale for the same Exam and duration is refused
  - an empty name is refused
  - a stale edit hits the conflict check
  - deleting a Plan that has an Order is refused (tested with a fixture Order once the table exists, or against the seam's rule)
