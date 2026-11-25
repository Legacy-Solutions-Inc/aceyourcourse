# 13 — Legal v2.1: payments and refunds

**What to build:** the Terms of Use explain payments and refunds before anyone pays, and each Member agrees to them once through the existing re-consent.

- **Legal v2.1** (still marked "pending legal review") adds a "Payments and refunds" section to the Terms of Use:
  - prices are in pesos (including VAT if the business is VAT-registered), paid through PayMongo
  - access starts when payment is confirmed
  - buying while an Access Pass is active adds the new days to its current end
  - nothing renews automatically, and card details are never stored
  - refunds (a placeholder for the client and the lawyer to change): "Ask Support within 7 days of payment. Refunds are at our discretion. A refund removes that Order's days."
- **The Privacy Policy** says payment records are kept as the tax rules require, even after an account is deleted (the lawyer confirms the years).
- **The version bump** uses the existing re-consent: each Member sees the consent screen once more on their next visit.
- **The Plans page line** "By paying you agree to the Terms of Use, including Payments and refunds." links to the new section.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

Spec: Phase 4 → "Phase 4 planning decisions → Legal v2.1"; story 151k.

- [ ] The Terms of Use show the "Payments and refunds" section and v2.1, marked pending legal review.
- [ ] A Member who agreed to v2.0 is asked to agree to v2.1 on their next visit, once.
- [ ] The Privacy Policy has the payment records line.
- [ ] **Sad paths, each with a test:**
  - a Member who agreed to v2.1 isn't asked again
  - a Member who hasn't agreed can't reach the Member App's screens (Plans included) until they do
  - the Website's legal pages still render and pass the accessibility check
