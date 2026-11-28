# Executer prompt — 04 Real PayMongo checkout

Ticket: `.scratch/ayc-payments/issues/04-paymongo-checkout.md` · Blocked by: 03 · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and payments-integration engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
With a PayMongo key set, Pay opens PayMongo's hosted checkout with only the chosen Payment Method. The Member comes back to the Confirming payment screen, which also asks PayMongo directly if no outcome has arrived. The key alone decides whether buying works and whether it's test or real money. No test ever calls PayMongo.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 4 → "PayMongo integration", "Return flow"
  - "Phase 4 planning decisions (added 2026-11-24)" → "The key decides; no new switch", "Paying", "Recording an outcome", "The runbook"
  - Testing Decisions → "Phase 4 seams" (Payments client)
  - Stories 135, 136, 151a, 151f, 151i and 151l
- Read:
  - CONTEXT.md: Order, Payment Method, Test Order
  - .scratch/ayc-payments/grilling-notes.md, decisions 2, 3, 4 and 8, and "Defaults"
- Ticket 03 added the Orders table, the payments client interface, its fake, the selector, the pure Order ledger and the Order route (Confirming / Paid / Failed). Find them in the code, and don't invent paths.
- Other existing pieces:
  - src/env.server.ts: the server-only env schema
  - src/env-names.test.ts and src/repo-secrets.test.ts: env and secret checks
  - .env.example
  - src/lib/e2e-server-env.ts (+ test): the variables the e2e server blanks
  - src/lib/csp.ts: form-action is 'self'
  - src/lib/supabase/auth-admin.ts: a real client behind an interface
  - docs/runbooks/production.md
- **PayMongo facts.**
  - Read PayMongo's public developer docs (read only), and confirm each detail there before relying on it:
    - Checkout Sessions API: POST /v1/checkout_sessions and GET /v1/checkout_sessions/{id}, with HTTP Basic auth using the secret key
    - line_items amounts in centavos with currency PHP
    - payment_method_types: confirm the exact names for QR Ph, GCash, Maya (likely "paymaya") and Card
    - success_url, cancel_url, reference_number, send_email_receipt, metadata
    - livemode, checkout_url, and the payments and payment_intent on the response
  - Record a few realistic responses as JSON fixtures under test/fixtures/paymongo/: created, paid, still active/pending and an error. Write them by hand from the docs' examples, with fake ids.
  - Use fetch. Add no SDK.
- **The real client** (e.g. src/lib/paymongo/client.ts), behind ticket 03's interface:
  - Start a Checkout Session for an Order:
    - one line item: the Order's Plan name and its amount, quantity 1
    - only the chosen method
    - success and cancel return addresses built from the site URL
    - the Order's reference as reference_number and metadata
    - PayMongo's email receipt on
  - Store the checkout id and livemode on the Order.
  - Redirect only to an https checkout_url on PayMongo's checkout host. Refuse anything else.
  - Read a checkout's status (used by the backup below, and by ticket 07's "Check status with PayMongo").
  - Map PayMongo's errors to a typed failure, and never throw raw responses to the UI. Log without the key.
- **Server-only variables:** PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET (the webhook secret is read in ticket 05).
  - Add them to src/env.server.ts as optional.
  - Add them to .env.example with comments. Never NEXT_PUBLIC_.
  - Add both to the e2e server's blanked variables in src/lib/e2e-server-env.ts (+ test), so a key in .env can never reach an e2e run.
  - Keep env-names and repo-secrets tests green.
- **The key decides; no new switch.** Extend ticket 03's pure mode function:
  - sample mode → the fake
  - otherwise a key starting sk_test_ → "test": buying works with PayMongo's test payments, and every Member App screen shows a "TEST PAYMENTS · no real money" strip
  - a key starting sk_live_ → "live": real money, no strip
  - no key, or a malformed one → off: "Buying opens soon", disabled, and Pay refused on the server; a malformed key also logs a warning without the key
  - The strip gets a boolean from the server. The key never leaves the server.
- **The status-check backup:**
  - After about 15 s on Confirming payment without an outcome, the server asks PayMongo for the Order's checkout status, at most once every 10 s per Order.
  - Persist the last check time on the Order. Serverless instances share no memory.
  - It applies what it learns through the same ledger the webhook will use.
  - It ignores a response whose checkout id or reference isn't this Order's.
  - "Still pending" changes nothing.
  - This also makes development work without a webhook.
- **Cancel:** PayMongo's cancel_url returns to Plans for that Exam with "Payment cancelled · you weren't charged". The Order stays Pending, and ticket 05 expires it.
- **Checkout failure:** if PayMongo answers an error when creating the checkout, show "Couldn't start the payment. Try again." on Plans. There is no redirect, and the Order stays Pending.
- **CSP:**
  - form-action 'self' can block a redirect that follows a form submission in some browsers.
  - Make the hop to PayMongo's checkout work. Either return the URL from the action and navigate on the client, or add PayMongo's checkout origin to form-action with a csp test.
  - Choose, test, and explain.
- **Runbook:** add a PayMongo section to docs/runbooks/production.md, for the user to follow:
  - set both keys in Vercel (test keys during the beta)
  - register https://<site>/api/paymongo/webhook in PayMongo for the payment events ticket 05 handles
  - test on Vercel Preview with a Deployment Protection bypass, or on production with test keys
  - swap to live keys at go-live and redeploy
  - Never paste keys into chat or the repo

SCOPE
Modify or add:
- src/lib/paymongo/client.ts (+ test on fixtures), test/fixtures/paymongo/*.json
- the payments selector and mode function from ticket 03 (+ tests)
- src/env.server.ts, .env.example, src/lib/e2e-server-env.ts (+ tests)
- the TEST strip in the Member App shell (src/app/app/(shell)/layout.tsx or its shell component, + test)
- the status-check backup (a Member seam call or Server Action used by the Order route's poller) and the Order column for the last check (+ migration)
- the Plans page's cancelled and couldn't-start messages; src/lib/csp.ts if you choose that route (+ test)
- docs/runbooks/production.md (PayMongo section)
- e2e: extend e2e/member-app/payments.spec.ts only where the fake can show it (the cancelled message via the cancel return address). The e2e server has no key and stays in sample mode with the fake.
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the webhook route (ticket 05).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 03 is present (the Orders table, the payments interface and fake, the Order route). If it's missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), the spec sections above and PayMongo's Checkout Session docs.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the mode function: sample, sk_test_, sk_live_, empty, malformed.
5. TDD the real client against fixtures with an injected fetch:
   - the request body (one item, one method, centavos, reference, receipt on, return URLs)
   - Basic auth
   - success, error and non-PayMongo checkout_url
   - status mapping
6. TDD the status-check backup: the throttle, the wrong-Order response, still pending, paid → ledger.
7. TDD the strip, cancel and couldn't-start messages, and the CSP choice.
8. Write the runbook section and .env.example. Then grep the client bundle of the scratchpad build for "PAYMONGO" and "sk_test_" / "sk_live_" and show it finds nothing.
9. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- With a test key, Pay sends the Member to PayMongo's checkout for that one method, and the Order records livemode false (proved with the client's fixture tests and an injected fetch).
- With a test key, every Member App screen shows the TEST strip. With a live key it doesn't.
- A Member back on Confirming payment with no webhook sees Paid once PayMongo's status says paid (proved with fixtures).
- Cancelling returns to Plans with "Payment cancelled · you weren't charged", and the Order stays Pending.
- The runbook and .env.example cover both keys and the webhook URL.
Sad paths (each one needs a test):
- No key: Pay is refused on the server and the button is disabled.
- A malformed key behaves like no key and logs a warning without the key.
- PayMongo answering an error when creating the checkout shows "Couldn't start the payment. Try again." There's no redirect, and the Order stays Pending.
- A checkout_url that isn't https on PayMongo's checkout host is refused.
- The status check is throttled: never more than once every 10 seconds per Order, across instances.
- A status response for another Order's checkout is ignored.
- A status of "still pending" changes nothing.
- The keys never reach the client bundle (the grep in the report), and the e2e server env blanks both PAYMONGO_* variables.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables, SUPABASE_SECRET_KEY, PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET blanked; then the client-bundle grep
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data, the payments fake). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.
- Run `pnpm exec next typegen` if route types go stale.
- Inline "use server" handlers must be async.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never call PayMongo (no request to api.paymongo.com from you, a script or a test) and never open its dashboard. Reading its public docs is fine. Never connect to the hosted Supabase project or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency (no PayMongo SDK). Otherwise stop and ask.
- Never print .env, keys or connection strings (read variable names only). PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET are server-only, never NEXT_PUBLIC_, and never imported by client code. Never put a real person's email address in the repo.
- Authorisation stays on the server. Pay, the status check and the strip decision run on the server, and the status check only reads the signed-in Member's own Order.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command, including the client-bundle grep
5. the decisions you made (the CSP route, the throttle storage, PayMongo's method names with doc links) and follow-ups, including what the user must do: set both keys in .env for local test payments, and in Vercel
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
