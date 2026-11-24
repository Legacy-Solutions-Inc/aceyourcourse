# Phase 4 (Payments) grilling notes (started 2026-11-23)

Branch: `feat/phase4-payments` (from main at 2813176, after PR #15 merged Phase 3). Every Phase 4 ticket shares it.
These notes feed /to-spec, then /to-tickets. Spec: docs/specs/2026-10-29-ayc-v1.md, Phase 4.
Phase 5 (Video) is grilled after Phase 4, on its own branch `feat/phase5-video`.

## Decisions

1. **Order.** Phase 4 before Phase 5. Selling a Course separately needs payments; included Courses and Free Preview don't.
2. **The PayMongo account is the client's**, under the business's details. Payouts and refunds are theirs.
   - Tests, e2e and sample mode use a fake payments client (no keys, never PayMongo).
   - Development and Vercel Preview use PayMongo test-mode keys. Production uses live keys once PayMongo approves the account.
   - Server-only `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET`, never NEXT_PUBLIC_. The user sets them; executers never touch the PayMongo dashboard.
3. **The PayMongo key decides; no new switch.**
   - No key (e2e, or a deploy before keys are set): Plans and prices show, and the button reads "Buying opens soon" (disabled).
   - Sample mode: the fake client, with "Simulate paid" and "Simulate failed" on the pending screen.
   - Test key (`sk_test_…`, used during the beta, production included): buying works with PayMongo test payments, under a "TEST PAYMENTS · no real money" strip. A test Order grants a real Access Pass.
   - Live key (`sk_live_…`): real money, no strip. Go-live means swapping the keys in Vercel and redeploying.
   - Each Order stores PayMongo's `livemode`. The Admin tags test Orders TEST and leaves them out of the KPIs, the chart and the CSV export by default.
4. **The method is picked in the app; one item per Order; the price is fixed at Pay.**
   - The Member picks QR Ph, GCash, Maya or Card on the Plans page. The PayMongo Checkout Session opens with only that method. The Order records it, and the failure copy and "Try another method" use it.
   - One Plan per Order (one Course from Phase 5). No cart.
   - The Order copies the Plan's name, days and price at Pay. Later price changes don't touch it.
   - Every Pay click makes a new Pending Order. An abandoned one expires after 24 hours. Two paid by accident each add their days; the Owner refunds the extra one in PayMongo.
5. **Who buys, and which Exams.**
   - A signed-in, consented Member with at least one Target Exam (the existing guard; the beta gate still decides who gets in).
   - The Plans page has a pill per Exam with at least one Plan on sale, the Member's Target Exams first. `?exam=` picks one.
   - Paying for an Exam the Member hasn't added adds it to their Target Exams with the Official Exam Date (same as Phase 3 decision 14).
   - Exams with nothing on sale aren't on the Plans page; their locked content keeps today's "contact us" note.
   - "See plans" replaces the beta note on locked content, ended access ("Renew access"), the dashboard's "Not in your plan · Unlock" tiles, and the Website Exam page's "See {EXAM} plans" button (through sign-in).
   - Staff can buy too (useful for testing); the Plans page tells them they already open all content.
6. **Refunds.**
   - Full refund: the Order becomes Refunded, its days come off the Access Pass end (only that Order's days when stacked), and the pass ends now if the end is past. The Member gets an in-app notice ("Your refund for AYC-10483 was processed. CE All-Access now ends {date}" / "has ended"). Logged in Staff Activity (system actor).
   - Partial refund: access doesn't change. The Order shows "PARTIALLY REFUNDED · ₱300", it's logged, and the Owner can adjust access by hand.
   - Partial refunds that add up to the full amount count as a full refund.
   - Billing and the Payment Acknowledgement show the refund; the Acknowledgement's status reads REFUNDED or PARTIALLY REFUNDED.
7. **"End access now" with paid days** removes only the granted days not yet used; paid days stay.
   - Days stack as consecutive segments; the unused granted days are those of grant segments (grants and extensions) after now.
   - Example: granted 30 days on 1 Jan (to 31 Jan), bought 90 on 10 Jan (to 1 May), ended on 15 Jan → 16 granted days left → ends 15 Apr.
   - No paid days left: ends now, as today.
   - With paid days left, the button reads "End granted access", with the preview "Access will end on {date}. Paid days stay; refund in PayMongo to remove them." Hidden when no granted days are left.
   - Still needs a reason, is logged in Staff Activity, and sends the Member a notice.
8. **Recording the outcome: the webhook first, a status check as backup.**
   - Webhook: signature checked; each PayMongo event applied once (idempotent per event id).
   - Status check: the "Confirming payment" page polls the Order every few seconds; after about 15 s the server also asks PayMongo, at most every 10 s. It covers a slow webhook and makes development work without one (webhooks can't reach localhost). The Owner's "Check status with PayMongo" uses the same code.
   - Expiry: a Pending Order older than 24 h shows as Expired everywhere at read time. A daily sweep (in the existing daily cron slot) asks PayMongo once more, then records Expired. No per-minute cron.
   - A late payment still counts: Expired → Paid grants the days, with "Paid after expiry" on the timeline.
   - Correction after the answer: a failed attempt can be retried on the same PayMongo page, so Failed → Paid is allowed too. Paid → Refunded is the only other move; Paid and Refunded never go back.
9. **The Plans admin** ("Plans & prices", SALES group, Owners only; Editors don't see SALES).
   - Whole pesos, ₱1–₱99,999; the per-month figure is computed for display. (PayMongo's per-method minimum for Checkout Sessions isn't documented clearly; the executer checks it in test mode and the editor refuses a lower price if one applies.)
   - At most one Best value per Exam; ticking one clears the others.
   - At most one Plan on sale per Exam and duration.
   - Delete only a Plan that never had an Order; otherwise switch it off (hidden from Members, existing Access Passes unchanged).
   - A Plan always unlocks all its Exam's content (ADR 0010); the mockup's "Unlocks" checkboxes are dropped.
   - Starting prices from the mockup (CE 30 d ₱499, 90 d ₱1,299 Best value, 180 d ₱2,299; other Exams 30 d ₱449): on sale in sample data; added switched OFF by the migration on the live database until the client confirms and an Owner switches them on.
10. **Payment Acknowledgement and official invoices.**
    - Settings (Owners only) gains business details printed on every Acknowledgement: business name, address, TIN (optional), VAT-registered yes/no ("Prices include VAT" when yes). Filled in by the client, no developer.
    - "Request official invoice" opens a short form: name on the invoice (prefilled from the Member's name), address, TIN (optional). One request per Order.
    - Owners: an "Invoice requested" filter on Orders, the request on the Order detail, and "Mark invoice sent" after issuing and emailing it outside the app.
    - Members: Billing shows "Invoice requested", then "Invoice sent · check your email".
    - No automatic email (no sending domain yet); the Owner sends it from the support inbox, like Privacy Requests.
11. **Orders, sales figures and the CSV** (Owners only; an Editor's Overview doesn't show sales).
    - Days and months in Manila time.
    - Paid amounts count on the paid day; refunds are subtracted on the refund day; each tile shows "₱X refunded".
    - Active Members: Members with at least one active Access Pass (paid or granted), Staff excluded.
    - Test Orders are left out everywhere unless "Include test orders" is ticked on the Orders list.
    - CSV, one row per filtered Order: reference, paid date/time (Manila), Member name and email, item, Exam, days, amount, method, status, refunded amount, PayMongo payment ID, invoice requested + name, address, TIN.
    - Needs attention gains "N payments pending", "N invoice requests to send", "N Orders paid after expiry".
    - The Member detail page (Users) gets an Orders section linking to each Order.
12. **Renewal reminders and Plan rows.**
    - Banner on Home and that Exam's study screens, one per Exam, for any Access Pass (paid or granted) ending within 7 days. Dismissing hides it until the next Manila day. Never for Staff.
    - Ends before the Exam Date: "Your CE All-Access ends 25 Oct, 27 days before your exam" + "Renew to cover your exam". On or after it: "…ends 25 Oct" + "Renew access". No Exam Date: the end date + "Renew access".
    - Each Plan row shows the end the Member would get, max(current end, now) + days ("Until 18 Jan 2027"); rows reaching the Exam Date add "covers your exam on 20 Oct".
    - Ended access keeps today's locked state, adds the saved progress ("312 cards marked, 14 quizzes taken") and "Renew access" → Plans.
    - A reminder email waits for a sending domain (out of Phase 4).
13. **Deleting an account that has Orders.**
    - The account, progress, Access Passes and devices go as today. Orders stay, detached from the account, keeping reference, dates, item, amount, method, status, refunds, PayMongo ID, the buyer's name and email as at purchase, and any invoice request. The Admin shows them as "Account deleted".
    - Kept for the period the tax rules require; the Privacy Policy (Legal v2.x draft, pending the lawyer) says so, and the lawyer confirms the years.
    - A Pending Order blocks deletion until it's resolved or expired.
    - Planner addition: a late payment (Expired → Paid) on an Order whose account was deleted is recorded as Paid with no grant, and shows in Needs attention as "Paid, account deleted · refund in PayMongo".
    - The Owner's deletion confirmation says "N paid Orders are kept for tax records, without the account".
    - "Download this Member's data" adds their Orders and invoice requests.
    - The Member's delete box adds "Payment records are kept as the law requires."
14. **Payment terms in Legal v2.1** ("pending legal review"), using the existing re-consent (each Member agrees once more on their next visit).
    - A "Payments and refunds" section in the Terms of Use: prices in pesos (VAT included if VAT-registered), paid through PayMongo; access starts on confirmation; buying early adds days; nothing renews automatically; card details never stored; refunds placeholder "Ask Support within 7 days of payment. Refunds are at our discretion. A refund removes that Order's days." for the client and lawyer to change.
    - Under the Pay button: "By paying you agree to the Terms of Use, including Payments and refunds."

## Defaults (confirmed 2026-11-23)

- References `AYC-10001` up; test and live share the numbering (gaps fine).
- Cancel on PayMongo's page → back to Plans with "Payment cancelled · you weren't charged"; the Order stays Pending and expires.
- PayMongo's own email receipt is turned on per payment (no sending domain yet); the Payment Acknowledgement is in Billing.
- Webhook changes are logged in Staff Activity as "PayMongo (system)".
- Selling Courses (Course Orders, Course Ownership) is built in Phase 5 on Phase 4's Orders. Phase 4 sells Plans only.
- Out of Phase 4: promo codes and discounts, email reminders, automatic official invoices, in-app refunds, card storage, auto-renewal.
- The sidebar's "PAID TODAY" card shows for Owners only.
- Runbook gets a PayMongo section (the user's steps): keys in Vercel, webhook URL `https://<site>/api/paymongo/webhook` registered in PayMongo, Preview needs a Deployment Protection bypass (or test on production with test keys), swap to live keys at go-live.
- Vertical slices as in Phase 3; e2e on in-memory sample data with the fake payments client; database suites in CI only; executers never touch hosted, PayMongo or Vercel; the user applies migrations after merging.
- CONTEXT.md gains "Payment Method", "Test Order", "Invoice Request", and sharper Refunded vs Partially refunded.
