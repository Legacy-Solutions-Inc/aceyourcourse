# 08 — Invoice Requests

**What to build:** a Member asks for the official invoice of a Paid Order, with the details to put on it, and Owners track and mark the requests sent. The invoice itself is issued outside the app and emailed from the support inbox.

- **The Member:** "Request official invoice" on the Payment Acknowledgement (and on the Order in Billing) opens a short form: name on the invoice (prefilled from the Member's name), address, TIN (optional, for businesses). One request per Order. Billing then shows "Invoice requested", later "Invoice sent · check your email".
- **Owners:**
  - an "Invoice requested" filter on the Orders list (requested, not yet sent)
  - the request's details on the Order detail
  - "Mark invoice sent", logged in Staff Activity
  - the CSV's invoice columns filled in
- **No automatic email.**

**Blocked by:** 06, 07.

**Status:** ready-for-agent

Spec: Phase 4 → "Phase 4 planning decisions → Payment Acknowledgement and Invoice Requests"; stories 144, 151j, 151v.

- [ ] A Member requests an invoice for a Paid Order and sees "Invoice requested".
- [ ] An Owner filters "Invoice requested", opens the Order, sees the details and marks it sent; the Member then sees "Invoice sent · check your email".
- [ ] **Sad paths, each with a test:**
  - a second request for the same Order is refused
  - a request for a Pending, Failed or Expired Order, or another Member's Order, is refused
  - an empty name or address is refused with a field message
  - a TIN in the wrong shape is refused
  - an Editor is refused "Mark invoice sent" on the server
  - marking an already sent request again changes nothing
