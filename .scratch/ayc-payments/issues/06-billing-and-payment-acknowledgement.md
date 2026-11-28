# 06 — Billing and the Payment Acknowledgement

**What to build:** the Member App's Billing screen (`/app/billing`, today a placeholder) shows the Member's Access Passes and every Order, and each Paid Order has a printable Payment Acknowledgement. Owners enter the business details printed on it in Settings.

- **Billing** ("Your payment history. Card details stay with PayMongo; we never see them."):
  - **Access:** each Access Pass with its Exam, ACTIVE or ENDED, "Until {date} · N days left · renews only if you renew", and "Renew now" → Plans for that Exam
  - **Orders:** every Order, newest first, with reference, date, item, Payment Method, amount and status (Pending, Paid, Failed, Expired; Pending older than 24 hours reads Expired). Test Orders are marked TEST.
  - each Paid Order links to its Acknowledgement
- **The Payment Acknowledgement** (printable, "Print or save as PDF"):
  - labelled "Payment Acknowledgement · This is not an official invoice"
  - number (the reference), date, billed to (the Member's name and email), seller (the business details), the line item with its access period and "no auto-renewal", total paid, Payment Method, PayMongo reference, status
  - "Prices include VAT" when the business is VAT-registered
  - a "Request official invoice" placeholder area (the request itself is ticket 08)
- **Business details in Settings** (Owners only): business name, address, TIN (optional), VAT-registered yes or no. Saved with the conflict check and logged in Staff Activity. Until they're filled in, the Acknowledgement shows the business name only.

**Blocked by:** 03.

**Status:** ready-for-agent

Spec: Phase 4 → "Payment Acknowledgement", "Phase 4 planning decisions → Payment Acknowledgement and Invoice Requests"; stories 143, 144, 151u.

- [ ] A Member who bought CE 3 months sees the Access Pass and the Paid Order in Billing, opens the Acknowledgement and prints it.
- [ ] The Acknowledgement shows the business details from Settings, and "Prices include VAT" only when VAT-registered is yes.
- [ ] An Owner fills in the business details and sees them on an Acknowledgement.
- [ ] **Sad paths, each with a test:**
  - a Member can never open another Member's Acknowledgement (not found)
  - a Pending, Failed or Expired Order has no Acknowledgement
  - an Editor is refused the business details on the server
  - a TIN in the wrong shape is refused with a field message
  - an empty Billing shows "No payments yet" and "See plans"
  - dates on Billing and the Acknowledgement are right in Manila time
  - a Test Order's Acknowledgement is marked TEST
