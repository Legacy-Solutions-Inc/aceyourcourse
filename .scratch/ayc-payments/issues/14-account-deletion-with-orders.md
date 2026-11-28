# 14 — Deleting an account that has Orders

**What to build:** deleting a Member's account keeps their Orders as tax records, detached from the account, and payments can never land on an account that no longer exists.

- **On deletion** (the Owner's "Delete this account" from a Privacy Request): the account, its progress, Access Passes and devices are removed as before. Its Orders stay, detached from the account, keeping reference, dates, item, amount, Payment Method, status, refunds, the PayMongo ID, the buyer's name and email as at purchase, and any Invoice Request. The Admin shows them as "Account deleted".
- **A Pending Order blocks deletion** until it's resolved or expired: "This Member has a payment in progress. Try again after it's confirmed or expires (by {time})."
- **A late payment** (Expired → Paid) on a deleted account's Order is recorded as Paid with no grant, and appears in Needs attention as "Paid, account deleted · refund in PayMongo".
- **The Owner's confirmation** says "N paid Orders are kept for tax records, without the account."
- **"Download this Member's data"** adds their Orders and Invoice Requests.
- **The Member's own delete box** (which already says "Plans you paid for aren't refunded") adds "Payment records are kept as the law requires."

**Blocked by:** 05.

**Status:** ready-for-agent

Spec: Phase 3 → "Privacy Requests"; Phase 4 → "Phase 4 planning decisions → Deleting an account that has Orders"; story 151y.

- [ ] Deleting a Member with two Paid Orders removes the account and keeps both Orders, marked "Account deleted", with the buyer's name and email.
- [ ] The data export includes the Member's Orders and Invoice Requests.
- [ ] **Sad paths, each with a test:**
  - deletion is refused while the Member has a Pending Order younger than 24 hours
  - deletion is allowed once that Order is Expired (including read-time expiry)
  - a paid webhook for a deleted account's Order records Paid, grants nothing, and shows in Needs attention
  - a deleted account's Orders are never shown to anyone in the Member App
  - an Editor is still refused deletion on the server
  - the Orders list and CSV still include the detached Orders
