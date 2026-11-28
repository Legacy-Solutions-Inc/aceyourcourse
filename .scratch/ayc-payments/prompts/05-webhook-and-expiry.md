# Executer prompt — 05 The PayMongo webhook and Order expiry

Ticket: `.scratch/ayc-payments/issues/05-webhook-and-expiry.md` · Blocked by: 04 · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and payments-integration engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
PayMongo's webhook records payment outcomes as they happen, safely and exactly once. Pending Orders expire after 24 hours without a per-minute job. A late or retried payment still counts.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 4 → "Order ledger" (and its "Revised 2026-11-24" note), "PayMongo integration"
  - "Phase 4 planning decisions (added 2026-11-24)" → "Recording an outcome: the webhook, backed by a status check"
  - Testing Decisions → "Phase 4 seams" (Order ledger, the webhook route)
  - Stories 137, 149, 151g and 151h
- Read CONTEXT.md (Order: Failed or Expired can still become Paid) and .scratch/ayc-payments/grilling-notes.md decision 8 and "Defaults".
- Tickets 03 and 04 added these pieces. Find them in the code, and don't invent paths:
  - the Orders table
  - the payments client interface (verify a webhook and read its event), its fake and the real PayMongo client
  - the mode function
  - the pure Order ledger
  - the status-check backup
  - the "PayMongo (system)" Staff Activity actor
  - the PAYMONGO_WEBHOOK_SECRET env variable
- Other existing pieces:
  - src/app/api/reviewer-pdfs/cron/route.ts and src/app/api/reviewer-pdfs/job-access.ts (CRON_SECRET bearer: 404 without a configured secret, 401 when it's wrong)
  - vercel.json: one daily cron, "0 18 * * *"
  - src/middleware.ts (its matcher includes /api; make sure it never redirects or blocks the webhook POST)
  - src/lib/logger.ts
- **PayMongo facts:**
  - Read PayMongo's public webhook docs (read only) and confirm each of these there:
    - the Paymongo-Signature header, shaped t=<timestamp>,te=<test signature>,li=<live signature>
    - HMAC-SHA256 of "<t>.<raw body>" with the webhook secret
    - compare te for test events and li for live ones
    - the event shape (id, type, livemode, data)
    - the event types for a paid checkout or payment and a failed payment
  - Add fixture events under test/fixtures/paymongo/ with fake ids, signed in tests with a test secret.
- **The webhook route** (src/app/api/paymongo/webhook/route.ts, POST only):
  - Read the raw body (request.text()) before parsing.
  - Verify the signature through the payments client, comparing in constant time.
  - Reject a missing or bad signature, or a malformed payload, with a 4xx and no state change.
  - Without PAYMONGO_WEBHOOK_SECRET configured, the route answers 404 like the cron's no-secret case.
  - Apply each PayMongo event once:
    - Store processed event ids in a small table (event id unique, type, Order, received_at).
    - A repeat is acknowledged with 200 and changes nothing.
  - Find the Order by the checkout id or the reference in the event's metadata.
  - An event for an unknown Order is acknowledged with 200, ignored and logged.
  - Go through the same ledger code as the status check, so both paths can't disagree.
  - Log changes in Staff Activity as "PayMongo (system)".
  - Answer quickly. Do the work inside the request, but nothing slow.
- **Ledger transitions added** (extend ticket 03's table):
  - Failed → Paid: a retry on the same PayMongo page succeeds.
  - Expired → Paid: a late payment. It grants the days and marks "Paid after expiry" on the Order (a flag or timeline entry) when the payment was confirmed more than 24 h after the Order was created.
  - Paid and Refunded never move back. Refunds arrive in ticket 09. A failed event after Paid leaves it Paid.
  - Out of order: a failed event arriving after a paid one changes nothing, and a paid event after a failed one makes it Paid.
- **Expiry:**
  - A Pending Order older than 24 hours shows as Expired everywhere at read time. Add one pure function (effective status at a time) and use it in every read: the Member's Order route, Plans and anywhere else Orders show.
  - A daily sweep (e.g. GET /api/paymongo/expiry-sweep), protected exactly like the existing cron (reuse or generalise job-access.ts, keeping its tests green):
    - For each overdue Pending Order, it asks PayMongo once more through the payments client.
    - It applies Paid if PayMongo says paid. Otherwise it records Expired.
    - It returns counts only.
  - Add it to vercel.json at the same daily time as the existing cron. Note in the report that the user should confirm the Vercel plan allows two cron jobs.
  - No per-minute cron.

SCOPE
Modify or add:
- src/app/api/paymongo/webhook/route.ts (+ a thin route test with fixture payloads against the fake)
- signature verification in the real client and the fake (+ tests)
- the ledger's new transitions and the effective-status function (+ tests)
- a processed-events table and the "paid after expiry" marker in src/lib/db/schema.ts; `pnpm db:generate`; keep deny-all.db.test.ts passing
- src/app/api/paymongo/expiry-sweep/route.ts (+ test), job-access generalisation, vercel.json
- the reads that must show Expired (Member seam and any Admin reads that exist), with tests over both arms
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, refunds (ticket 09), deleted accounts (ticket 14).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 04 is present (the real client, the status-check backup, the PAYMONGO_* variables). If it's missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), the spec sections above and PayMongo's webhook docs.
3. Skills: test-driven-development, testing-unit, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD signature verification:
   - valid te and li
   - wrong secret
   - tampered body
   - missing or garbled header
   - live versus test
5. TDD the ledger's transition table:
   - Failed → Paid
   - Expired → Paid (with and without the "after expiry" mark)
   - Paid stays Paid on failed
   - Refunded stays put
   - effective status at 23 h 59 m and 24 h 01 m
6. TDD the route:
   - a bad signature leaves no change
   - malformed body
   - the same event twice grants once
   - failed after paid
   - paid after failed
   - unknown Order: acknowledged and logged
   - an Expired Order paid
7. TDD the sweep: no secret (404), wrong secret (401), overdue Order actually paid becomes Paid, overdue unpaid becomes Expired, younger Orders untouched.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- A valid paid webhook for a Pending Order makes it Paid and extends the Access Pass.
- A Pending Order created 25 hours ago shows as Expired before the sweep runs.
- The sweep records overdue Orders as Expired after checking PayMongo.
- A paid webhook for an Expired Order makes it Paid, grants the days and notes "Paid after expiry".
- Each change is in Staff Activity as "PayMongo (system)".
Sad paths (each one needs a test):
- A bad or missing signature is rejected with no state change.
- A malformed payload is rejected.
- The same event twice grants once.
- A failed event after a paid event leaves the Order Paid.
- A paid event after a failed event makes it Paid.
- An event for an unknown Order is acknowledged, ignored and logged.
- The sweep finding an overdue Order actually paid makes it Paid, not Expired.
- The cron route refuses a request without its secret (401), and answers 404 when no secret is configured.
- The webhook answers 404 when PAYMONGO_WEBHOOK_SECRET isn't configured.
- The middleware never redirects the webhook POST.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables, SUPABASE_SECRET_KEY and both PAYMONGO_* variables blanked
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data, the payments fake), to show nothing regressed. If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.
- Run `pnpm exec next typegen` if route types go stale.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never call PayMongo or open its dashboard, and never register a webhook. The user does that from the runbook. Reading PayMongo's public docs is fine. Never connect to the hosted Supabase project or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys, secrets or connection strings. The webhook secret is server-only, and no log line contains it or a raw signature.
- The webhook trusts nothing it hasn't verified, and the sweep runs only with CRON_SECRET.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the event types handled, with doc links; how "Paid after expiry" is stored; the sweep route) and follow-ups, including for the user: which events to tick when registering the webhook, and that the Vercel plan must allow two cron jobs
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
