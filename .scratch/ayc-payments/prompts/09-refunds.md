# Executer prompt — 09 Refunds

Ticket: `.scratch/ayc-payments/issues/09-refunds.md` · Blocked by: 05, 06, 07 · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and payments-integration engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
When an Owner refunds an Order in the PayMongo dashboard, PayMongo's refund event updates the Order and the Member's access automatically, and the Member is told in the app. A full refund removes that Order's unused days, and only those. A partial refund changes no access.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 4 → "Order ledger" (Refunded, and the "Revised 2026-11-24" note: a partial refund leaves the Order Paid)
  - "Phase 4 planning decisions (added 2026-11-24)" → "Refunds"
  - Testing Decisions → "Phase 4 seams" (Order ledger: full vs partial refunds and partials adding up to full)
  - Stories 150 and 151s
- Read:
  - CONTEXT.md: Refunded, partial refund, Order, Access Pass
  - .scratch/ayc-payments/grilling-notes.md, decisions 6 and 7
- Tickets 03, 05, 06 and 07 added these pieces. Find them in the code, and don't invent paths:
  - Orders
  - the pure Order ledger and its transition table
  - paid days recorded as history rows in access_pass_grants, marked as paid
  - the webhook route with signature checks and processed-event idempotency
  - the "PayMongo (system)" actor
  - Billing and the Acknowledgement
  - the Orders admin, its timeline and the CSV's "amount refunded" column
- Other existing pieces:
  - src/services/access-passes.core.ts ("End access now" from ticket 17 sets the end to now and leaves the history rows as they were)
  - src/lib/member-app/notices.ts and member_notices (a kind enum)
- **PayMongo facts:**
  - Read PayMongo's public docs (read only) for the refund events (e.g. payment.refunded and payment.refund.updated) and the refund object (id, amount, status, payment id).
  - Confirm how a partial refund appears.
  - Add fixtures under test/fixtures/paymongo/ with fake ids.
- **Refund records:**
  - Store each PayMongo refund once (refund id unique, Order, amount in centavos, status, refunded_at).
  - The Order's refunded amount is the sum of its succeeded refunds.
  - Apply each event once (ticket 05's idempotency), and each refund id once even if two events carry it.
- **A full refund** (the refunded amount reaches the Order's amount, including partials adding up to it):
  - The Order becomes Refunded, and it never becomes Paid again.
  - Its unused days come off the Access Pass:
    - Days stack as consecutive segments (each grant, extension and Paid Order adds its days at the current end).
    - Remove the part of this Order's segment that lies after now. Later segments shift earlier by that much.
    - A segment that hasn't started loses all its days. A partly used one loses only the rest. A used-up one loses nothing.
    - The end never moves before now. If nothing is left, access ends now.
    - Days from grants and other Orders are never removed.
  - Notice to the Member: "Your refund for AYC-10483 was processed. CE All-Access now ends {date}", or "…has ended".
  - Logged in Staff Activity as "PayMongo (system)" with the end before and after.
- **A partial refund:**
  - The Order stays Paid and shows "PARTIALLY REFUNDED · ₱300".
  - Access doesn't change. The Owner can adjust it by hand.
  - Logged.
- **The segment model:**
  - Write it as one pure function in the ledger, e.g. the current segments of a pass from its history and the removals already applied. Ticket 10 ("End granted access") reuses it. If ticket 10 already added one, reuse that instead.
  - Decide whether removals are stored as their own history entries, or applied by updating rows' starts_at/ends_at. Explain the choice in a code comment.
  - Handle passes ended by ticket 17's "End access now", whose history rows still run past the end.
  - If the model needs a migration that rewrites existing rows, stop and ask first.
- **Where it shows:** the Order's timeline, the Orders list status (Refunded, or Paid with the partial amount), the CSV's amount refunded, Billing, and the Acknowledgement's status (REFUNDED or PARTIALLY REFUNDED).
- A refund event for a Pending, Failed or Expired Order is ignored and logged.

SCOPE
Modify or add:
- the ledger: refund transitions, partial vs full, the segment model (+ tests)
- src/lib/db/schema.ts (refunds table; a new notice kind; anything the segment model needs); `pnpm db:generate`; keep deny-all.db.test.ts passing
- the webhook route's refund handling (+ route tests with signed fixtures against the fake), and the real client and fake's event parsing
- notices text (src/lib/member-app/notices.ts + test)
- reads and views: Orders list and detail, CSV, Billing, Acknowledgement (+ tests)
- sample data: one refunded and one partially refunded Order, so the screens can be seen
- e2e: extend e2e/admin/orders.spec.ts and e2e/member-app/billing.spec.ts to show the refunded states from the sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, in-app refund buttons (none: refunds happen only in PayMongo).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that tickets 05, 06 and 07 are present (the webhook, Billing, the Orders admin). If any is missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), the spec sections above and PayMongo's refund docs.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the segment model and refund rules as pure functions:
   - the only Order refunded mid-way: ends now
   - the second of two stacked Orders: only its days go
   - a grant after a refunded Order shifts earlier but keeps its days
   - partial refunds: no change
   - two partials adding up to full become Refunded
   - the end never before now
   - Manila midnight
5. TDD the transitions: Refunded never goes back to Paid, and a refund on Pending, Failed or Expired is ignored.
6. TDD the webhook: the same refund event twice removes days once, the same refund id in two events counts once, and a bad signature changes nothing.
7. TDD the views and the notice text.
8. e2e from the sample data:
   - An Owner sees REFUNDED and "PARTIALLY REFUNDED · ₱300" in Orders, and the CSV's amount refunded.
   - The Member sees the same in Billing and on the Acknowledgement.
9. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- A full refund of a Member's only Order ends their access now and sends the notice.
- A full refund of the second of two stacked Orders removes only its days.
- A partial refund shows the amount and leaves the end date unchanged.
- Two partial refunds adding up to the full amount make the Order Refunded and remove its days.
- Each refund is in Staff Activity as "PayMongo (system)" with the before and after ends.
Sad paths (each one needs a test):
- The same refund event twice removes the days once.
- A refund event for a Pending, Failed or Expired Order is ignored and logged.
- A refund that would push the end into the past ends access now, never earlier than now.
- A refund doesn't touch days from grants or other Orders.
- A Refunded Order never becomes Paid again, even if a late paid event arrives.
- A refund event with a bad signature changes nothing.
- The end date is right across Manila midnight.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables, SUPABASE_SECRET_KEY and both PAYMONGO_* variables blanked
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data, the payments fake). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.
- Adding a value to a Postgres enum is its own migration step. Check that drizzle's generated SQL is valid.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never call PayMongo or open its dashboard. Reading its public docs is fine. Never connect to the hosted Supabase project or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys, secrets or connection strings, and never put a real person's email address in the repo.
- Refunds are never started from the app. Only verified PayMongo events change refund state.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the segment model and where it lives, so ticket 10 can reuse it; the refund events handled, with doc links) and follow-ups, including which refund events the user must tick on the webhook
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
