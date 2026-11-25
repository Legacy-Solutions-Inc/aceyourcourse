# 04 — Real PayMongo checkout

**What to build:** with a PayMongo key set, Pay opens PayMongo's hosted checkout with only the chosen Payment Method, and the Member comes back to the Confirming payment screen, which also asks PayMongo directly if no outcome has arrived. The key alone decides whether buying works and whether it's test or real money.

- **The real payments client** behind ticket 03's interface:
  - starts a Checkout Session for the Order with one line item (the Plan), only the chosen Payment Method, the success and cancel return addresses, the Order's reference, and PayMongo's own email receipt turned on
  - reads a checkout's status (for the backup below and for the Admin's "Check status with PayMongo" in ticket 07)
  - its tests run on recorded fixture responses; no test ever calls PayMongo
- **Server-only variables:** `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` (the webhook secret is used in ticket 05). Never `NEXT_PUBLIC_`; no client code reads them.
- **The key decides; no new switch:**
  - no key (the e2e server, or a deploy before keys are set): "Buying opens soon", disabled
  - sample mode: the fake, as in ticket 03
  - a test key (`sk_test_…`): buying works with PayMongo's test payments, and every Member App screen shows a "TEST PAYMENTS · no real money" strip
  - a live key (`sk_live_…`): real money, no strip
  - each Order stores PayMongo's `livemode`
- **The status-check backup:** after about 15 seconds on Confirming payment without an outcome, the server asks PayMongo, at most every 10 seconds, and applies what it learns through the same ledger as the webhook will. This also makes development work without a webhook.
- **Cancel:** cancelling on PayMongo's page returns to Plans with "Payment cancelled · you weren't charged". The Order stays Pending.
- **Runbook:** a PayMongo section in `docs/runbooks/production.md` for the user: set the keys in Vercel, register `https://<site>/api/paymongo/webhook` in PayMongo, use a Deployment Protection bypass to test on Vercel Preview (or test on production with test keys), and swap to live keys at go-live. `.env.example` lists both variables with comments.

**Blocked by:** 03.

**Status:** ready-for-agent

Spec: Phase 4 → "PayMongo integration", "Phase 4 planning decisions → The key decides; Paying; Recording an outcome"; stories 135, 136, 151a, 151f, 151i, 151l.

- [ ] With a test key, Pay sends the Member to PayMongo's checkout for that one method, and the Order records `livemode` false.
- [ ] With a test key, every Member App screen shows the TEST strip; with a live key it doesn't.
- [ ] A Member back on Confirming payment with no webhook sees Paid once PayMongo's status says paid (proved with the fake and fixture responses).
- [ ] Cancelling returns to Plans with the cancelled message.
- [ ] The runbook and `.env.example` cover the keys and the webhook.
- [ ] **Sad paths, each with a test:**
  - no key: Pay is refused on the server and the button is disabled
  - PayMongo answering an error when creating the checkout shows "Couldn't start the payment. Try again." and leaves no broken redirect (the Order stays Pending)
  - the status check is throttled (never more than once every 10 seconds per Order)
  - a status response for another Order's checkout is ignored
  - a status of "still pending" changes nothing
  - the keys never reach the client bundle (a grep in the report)
