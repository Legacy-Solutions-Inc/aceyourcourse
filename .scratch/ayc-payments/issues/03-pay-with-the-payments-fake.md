# 03 — Pay with the payments fake

**What to build:** a Member buys a Plan end to end against a fake payments client: Pay creates a Pending Order, the Confirming payment screen waits, and a paid outcome extends their Access Pass straight away. In sample mode the Confirming screen offers "Simulate paid" and "Simulate failed", so every screen can be clicked through locally. The real PayMongo client comes in ticket 04.

- **Orders** (a new table): one Plan per Order, with the Member, the Exam, the Plan's name, days and price copied at Pay (later Plan changes never touch the Order), the Payment Method, the status, `livemode`, a sequential reference from `AYC-10001` upward, the PayMongo checkout and payment IDs (empty with the fake), and timestamps.
- **A payments client interface** with three jobs: start a checkout for an Order (returning where to send the Member), read a checkout's status, and verify a webhook and read its event. This ticket adds the interface and a **fake** (following the existing auth-admin interface and its fake). Tests and sample mode use the fake.
- **Pay:** on the Plans page the button becomes "Pay {price} with PayMongo" wherever a payments client is available (the fake in sample mode). It creates a new Pending Order every click and sends the Member to the checkout (with the fake: straight to Confirming payment).
- **The Order ledger** (pure, no database): the rules every later ticket reuses.
  - Pending → Paid: extend the Member's Access Pass for that Exam to max(current end, now) + the Order's days. Record the Order's days in the pass's history alongside grants, so paid and granted days can be told apart (tickets 09 and 10 rely on it).
  - Pending → Failed.
  - Paid adds the Exam to the Member's Target Exams with its Official Exam Date if they hadn't added it (as a grant does), and sends an in-app notice ("You now have {Exam} All-Access until {date}").
  - Each change is applied once: applying the same outcome twice changes nothing.
  - Paid is the only state that grants access.
- **Screens** (from the mockup):
  - **Confirming payment:** "Waiting for PayMongo to confirm your {method} payment… Keep this page open." with the Plan, price and reference. It refreshes the Order every few seconds. After about 2 minutes: a "still waiting" message pointing to Support.
  - **Paid:** "✓ PAYMENT CONFIRMED / You're in. Kaya mo 'to." "It's active until {date}. It won't renew on its own. We'll remind you a week before it ends." Footer: amount, method, reference, "RECEIPT IN BILLING". "Start reviewing" → Library.
  - **Failed:** "PAYMENT DIDN'T GO THROUGH", method-specific copy ("Your card was declined. You weren't charged. Try again, or pay with QR Ph, GCash, or Maya instead."), "Try another method" → Plans, "Email support".
- **Staff Activity** logs the Paid grant under the system actor "PayMongo (system)".
- **Staff** can buy like any Member.

**Blocked by:** 02.

**Status:** ready-for-agent

Spec: Phase 4 → "Order ledger", "Return flow", "References", "Phase 4 planning decisions → Paying"; stories 135–140, 151a, 151b, 151d, 151n.

- [ ] In sample mode a Member picks CE 3 months and GCash, clicks Pay, clicks "Simulate paid", sees the Paid screen with the right end date, and opens locked CE content.
- [ ] A Member with 20 days left who buys 90 days ends up with 110 days.
- [ ] A Member with an expired pass who buys 30 days gets 30 days from now.
- [ ] Buying for an Exam the Member hadn't added adds it to their Target Exams, with a notice.
- [ ] "Simulate failed" with Card shows the card-declined copy and "Try another method".
- [ ] **Sad paths, each with a test:**
  - the Order keeps the price shown at Pay after an Owner changes the Plan's price
  - Pay for a switched-off Plan, or a Plan of another Exam than the one posted, is refused
  - Pay with an unknown Payment Method is refused
  - Pay without a payments client (no key, not sample mode) is refused on the server
  - applying Paid twice extends the pass once
  - a Failed Order grants nothing
  - one Member can never read another Member's Order (the Confirming screen with someone else's Order answers not found)
  - references are sequential and unique under two Pay clicks at once
  - the end date is right across Manila midnight
