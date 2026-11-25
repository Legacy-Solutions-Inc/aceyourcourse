# Executer prompt — 03 Pay with the payments fake

Ticket: `.scratch/ayc-payments/issues/03-pay-with-the-payments-fake.md` · Blocked by: 02 · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
A Member buys a Plan end to end against a fake payments client. Pay creates a Pending Order, the Confirming payment screen waits, and a paid outcome extends their Access Pass straight away. In sample mode the Confirming screen offers "Simulate paid" and "Simulate failed", so every screen can be clicked through locally. This ticket lays the foundations every later Phase 4 ticket reuses: the Orders table, the payments client interface and its fake, and the pure Order ledger. The real PayMongo client is ticket 04.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 4 → "Order ledger" (and its "Revised 2026-11-24" note), "Return flow", "References"
  - "Phase 4 planning decisions (added 2026-11-24)" → "Paying", "The key decides; no new switch", "Who buys, and which Exams"
  - Testing Decisions → "Phase 4 seams" (Payments client, Order ledger, Member seam)
  - Stories 135–140, 151a, 151b, 151d and 151n
- Read:
  - CONTEXT.md: Order, Plan, Access Pass, Payment Method, Test Order, Target Exam, Staff Activity
  - .scratch/ayc-payments/grilling-notes.md, decisions 3, 4, 5 and 8, and "Defaults"
  - .scratch/ayc-admin/CONVENTIONS.md
  - docs/mockup/member-app/BUILD-MAP.md §3 "Pay pending", "Pay failed" and "Pay success"
- Tickets 01 and 02 added Plans (Admin and sample data) and the Member's Plans page. Find them in the code, and don't invent paths.
- Prior art to copy:
  - src/services/auth-admin.types.ts and src/services/auth-admin.fake.ts: an external-service interface plus a fake. Its real counterpart lives in src/lib/supabase/.
  - src/services/access-passes.core.ts: store-backed calls shared by both arms. Grants write the pass, a history row in access_pass_grants, the Target Exam, a notice and Staff Activity, all or nothing.
  - src/lib/member-app/access-pass.ts: passWithDays.
  - src/lib/member-app/notices.ts and member_notices.
  - src/services/member.rules.ts (grantedTargetExam).
  - src/lib/admin/mode.ts: sample/live/closed.
- **Orders** (a new table, RLS on, no anon or authenticated policies):
  - One Plan per Order.
  - Columns:
    - a uuid id
    - a reference "AYC-10001" upward from a Postgres sequence (sequential, unique, gaps fine; test and live share it)
    - user_id
    - the Exam
    - plan_id (references plans, restrict on delete)
    - the Plan's name, days and price in centavos, copied at Pay; later Plan changes never touch the Order
    - the Payment Method (qrph, gcash, maya, card)
    - status: pending, paid, failed, expired, refunded (the later states are used by tickets 05 and 09)
    - livemode (false with the fake)
    - PayMongo checkout and payment ids (null with the fake)
    - the buyer's name and email as at Pay (ticket 14 keeps them after account deletion)
    - created_at, paid_at, status_changed_at
  - user_id references members with ON DELETE SET NULL, so an Order outlives its account. Ticket 14 builds the rest of that.
  - Wire ticket 01's "delete only a Plan that never had an Order" to real Orders, and test it with a fixture Order.
- **The payments client interface** (e.g. src/services/payments.types.ts). Three jobs:
  - start a checkout for an Order, returning where to send the Member
  - read a checkout's status
  - verify a webhook and read its event
- **The fake** (e.g. src/services/payments.fake.ts):
  - It sends the Member straight to Confirming payment.
  - Its status is whatever was simulated.
  - Its webhook verification works on test fixtures.
- **A selector** (e.g. src/services/payments.ts) returns the client: the fake in sample mode, and none otherwise. Ticket 04 adds the real client and the key rules. Keep the mode decision a pure, tested function, so ticket 04 can extend it.
- **The Order ledger** (pure, no database; e.g. src/lib/payments/order-ledger.ts). These rules are reused by tickets 04, 05, 09, 10 and 11:
  - Pending → Paid: the Access Pass for that Exam becomes max(current end, now) + the Order's days.
    - Record the Order's days as a history row in access_pass_grants beside grants, marked as paid. For example, add a nullable order_id; rows with one are paid days, rows without are granted days (grants and extensions). Use the same starts_at/ends_at segment shape, so tickets 09 and 10 can tell paid from granted days and compute unused days.
    - Satisfy or adjust the table's existing checks (reason and granted_by are NOT NULL today), and explain what you chose.
  - Pending → Failed.
  - Paid adds the Exam to the Member's Target Exams with its Official Exam Date if they hadn't added it (or restores a removed one), the same way a grant does. It also writes an in-app notice: "You now have {Exam} All-Access until {date}".
  - Each change is applied once. Applying the same outcome twice changes nothing.
  - Paid is the only state that grants access.
  - Ticket 05 adds Failed → Paid and Expired → Paid. Design the transition function as a table, so adding rows is the only change.
- **Staff Activity:** the Paid grant is logged under a system actor named "PayMongo (system)". Add one constant for it, with a non-email marker such as "system:paymongo" as actor_email, so ticket 15 can filter it.
- **Pay** (a Server Action):
  - On the Plans page the button becomes "Pay {price} with PayMongo" wherever a payments client exists (the fake in sample mode). Without one it stays "Buying opens soon", disabled.
  - Every click makes a new Pending Order for the signed-in Member and sends them to checkout. With the fake that's straight to Confirming payment.
  - Re-check everything on the server: the Plan is on sale, the Plan belongs to the posted Exam, the method is one of the four, a client exists, and the guard passes.
  - Staff can buy like any Member.
- **Screens** (one route keyed by the Order's reference, e.g. /app/plans/orders/[reference], rendering by status; only the Order's own Member can open it, everyone else gets notFound):
  - Confirming payment:
    - "CONFIRMING PAYMENT / Waiting for PayMongo to confirm your {method} payment / This usually takes under a minute. Keep this page open. Your access starts as soon as the payment is confirmed." with the Plan, price and "REF AYC-10483".
    - Refreshes the Order every few seconds.
    - After about 2 minutes, a "still waiting" message pointing to Support.
    - In sample mode only: "Simulate paid" and "Simulate failed". Their Server Actions refuse outside sample mode.
  - Paid: "✓ PAYMENT CONFIRMED / You're in. Kaya mo 'to." and "It's active until {date}. It won't renew on its own. We'll remind you a week before it ends." Footer: amount, method, reference, "RECEIPT IN BILLING". "Start reviewing" → Library.
  - Failed: "PAYMENT DIDN'T GO THROUGH", with method-specific copy.
    - Card: "Your card was declined. You weren't charged. Try again, or pay with QR Ph, GCash, or Maya instead."
    - Other methods: the same shape naming that method and offering the other three.
    - Buttons: "Try another method" → Plans for the Exam, and "Email support".
- Dates show in Asia/Manila (src/lib/manila-time.ts).

SCOPE
Modify or add:
- src/lib/db/schema.ts (orders, the reference sequence, the history marker); `pnpm db:generate`, plus hand-written SQL for the sequence if drizzle can't express it; keep deny-all.db.test.ts passing
- src/services/payments.types.ts, payments.fake.ts, payments.ts (+ tests)
- src/lib/payments/order-ledger.ts (+ test), and small pure helpers (method labels and failure copy) under src/lib/payments/
- the Member seam (member.types.ts, member.ts, member.mock.ts, member.db.ts): Pay, read own Order, the sample-only simulate; a store-backed core shared by both arms if it helps (like access-passes.core.ts)
- src/services/member.payments.test.ts, added to MEMBER_SUITES in vitest.config.ts
- the Admin seam's Plan delete rule (now backed by Orders) and its test
- src/app/app/(shell)/plans/… (Pay action, the Order route) and components (+ component tests)
- e2e: e2e/member-app/payments.spec.ts on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the real PayMongo client, the webhook and env variables (tickets 04 and 05).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that tickets 01 and 02 are present (Plans & prices in the Admin, /app/plans). If either is missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, CONVENTIONS.md, the ticket (every checkbox is part of your acceptance criteria), and the spec and mockup sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, forms-validation, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the ledger as pure functions:
   - Pending → Paid on an active pass, an expired pass and no pass (20 days left + 90 = 110 days)
   - Pending → Failed
   - Paid twice = once
   - Failed grants nothing
   - Manila midnight
5. TDD the fake and the selector (sample → fake, otherwise none).
6. Add the schema and migration.
7. TDD the Member seam over both arms:
   - Pay fixes the price at Pay
   - refusals: switched-off Plan, wrong Exam, unknown method, no client
   - sequential references under two concurrent Pays
   - own Order only
   - Paid writes the pass, the paid history row, the Target Exam, the notice and the system Staff Activity, all or nothing
8. TDD the screens.
9. e2e:
   - A sample Member picks CE 3 months and GCash, Pays, clicks "Simulate paid", sees the Paid screen with the right end date, and opens locked CE content.
   - Another run picks Card and clicks "Simulate failed", and sees the card-declined copy and "Try another method".
10. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- In sample mode a Member picks CE 3 months and GCash, clicks Pay, clicks "Simulate paid", sees the Paid screen with the right end date, and opens locked CE content.
- A Member with 20 days left who buys 90 days ends up with 110 days.
- A Member with an expired pass who buys 30 days gets 30 days from now.
- Buying for an Exam the Member hadn't added adds it to their Target Exams, with a notice.
- "Simulate failed" with Card shows the card-declined copy and "Try another method".
- The Paid grant is in Staff Activity under "PayMongo (system)", and the pass history has a paid row for the Order.
Sad paths (each one needs a test):
- The Order keeps the price shown at Pay after an Owner changes the Plan's price.
- Pay for a switched-off Plan, or a Plan of another Exam than the one posted, is refused.
- Pay with an unknown Payment Method is refused.
- Pay without a payments client (not sample mode, no key) is refused on the server.
- Applying Paid twice extends the pass once.
- A Failed Order grants nothing.
- One Member can never read another Member's Order. The Confirming screen with someone else's reference answers not found.
- References are sequential and unique under two Pay clicks at once.
- "Simulate paid" and "Simulate failed" are refused outside sample mode.
- Deleting a Plan that has an Order is refused (with a fixture Order).
- The end date is right across Manila midnight.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked, as the e2e server has them
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data, the payments fake). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.
- A new route can leave stale .next/types. Run `pnpm exec next typegen`.
- A new src/services/member.*.test.ts must be added to MEMBER_SUITES in vitest.config.ts. src/services/admin.*.test.ts suites run over both arms through the glob.
- Inline "use server" handlers must be async.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo (API or dashboard) or Vercel, and never apply a migration to hosted. No code in this ticket calls PayMongo.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Every Order read is scoped to the signed-in Member, the price comes from the database (never from the form), and the simulate actions work only in sample mode.
- No email is sent. Notices are in-app only.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made and the paths later tickets will need: the payments interface, fake, selector and ledger files; how paid days are marked in the pass history; the system actor constant; the Order route
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
