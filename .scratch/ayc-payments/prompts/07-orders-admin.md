# Executer prompt — 07 The Orders admin

Ticket: `.scratch/ayc-payments/issues/07-orders-admin.md` · Blocked by: 04 · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Owners see every Order in a new "Orders & payments" screen in the SALES group. It has search, filters, stats and a CSV export for the accountant, plus an Order detail page to resolve payment questions. A Member's detail page lists their Orders.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 4 → "Orders Admin"
  - "Phase 4 planning decisions (added 2026-11-24)" → "Orders and sales figures"
  - Testing Decisions → "Phase 4 seams" (Admin seam, extended)
  - Stories 147, 148, 151o and 151z
- Read:
  - CONTEXT.md: Order, Test Order, Payment Method, Staff Role, Staff Activity
  - .scratch/ayc-payments/grilling-notes.md, decisions 3 and 11
  - .scratch/ayc-admin/CONVENTIONS.md
  - docs/mockup/admin/BUILD-MAP.md §3.9 "Orders & payments" and §2
- Tickets 01–04 added these pieces. Find them in the code, and don't invent paths:
  - the SALES group with Plans & prices
  - Orders and the Order ledger
  - the payments client and selector
  - the status-check code (Confirming payment's backup), which "Check status with PayMongo" must reuse, not copy
  - If ticket 05 is present, use its effective-status function (Pending over 24 h reads Expired) and its "Paid after expiry" marker.
- Other existing pieces:
  - src/components/admin/admin-menu.ts (+ test)
  - src/lib/admin/guard.ts (requireOwner)
  - the Users list and src/components/admin/users/member-detail.tsx
  - src/app/admin/(shell)/users/privacy-requests/[id]/data/route.ts: a guarded download route to copy
  - src/lib/manila-time.ts
  - src/components/admin/use-url-search.ts
  - src/lib/admin/*-list.ts: pure list filters
  - the conflict check (record_stamps)
- **Who:** Owners only. Editors don't see it, and every read and action is refused for them on the server.
- **The list:**
  - Stats for the current filter: paid (the Manila month by default), Orders, Pending, Failed.
  - "Search by order number or email".
  - Filters: status (any, Paid, Pending, Failed, Expired, Refunded), Payment Method (all, QR Ph, GCash, Maya, Card), range (last 7 days, last 30 days by default, all time) on Manila day boundaries.
  - "Include test orders", off by default. Test Orders are tagged TEST.
  - Columns: Order, date, Member (email), item, method, amount, status.
  - Footer: "Payment status comes from PayMongo. Card details are never stored on the platform."
  - Empty: "No Orders match".
  - Filters live in the URL.
- **CSV export** (a guarded GET route; logged in Staff Activity):
  - Exactly the filtered Orders, one row each: reference, paid date and time (Manila), Member name and email, item, Exam, days, amount, Payment Method, status, amount refunded, PayMongo payment ID, invoice requested, invoice name, address and TIN.
  - The refund and invoice columns stay empty until tickets 08 and 09 fill them.
  - A header row always.
  - Escape against spreadsheet formula injection: prefix a ' to any cell starting with =, +, -, @, tab or carriage return.
  - RFC 4180 quoting.
- **Order detail** (e.g. /admin/orders/[reference]):
  - Member (links to the Member detail page), item, amount, method, PayMongo reference, created.
  - Timeline by status:
    - "Checkout started → Paid with {method} → PayMongo confirmed · access granted", or waiting, or failed
    - "Paid after expiry" where it applies
  - A status note, e.g. "Access is granted automatically when PayMongo confirms. Pending payments expire after 24 hours."
  - An internal note only Admins see: saved with the conflict check, logged in Staff Activity, "✓ NOTE SAVED · ONLY ADMINS SEE IT".
  - "Check status with PayMongo", using the shared status-check code. The result is "CHECKED JUST NOW · STILL PENDING AT {METHOD}" or the new outcome applied through the ledger.
  - "Open in PayMongo dashboard ↗": confirm the dashboard URL shape in PayMongo's docs; hide it when there's no PayMongo id.
  - "Refunds are issued from the PayMongo dashboard."
  - An unknown reference answers notFound.
- **The Member detail page** (Users) gains an Orders section linking to each Order.
- **The sidebar:** add "Orders & payments" to SALES after Plans & prices, and Settings moves down one number. Update the test.

SCOPE
Modify or add:
- the Admin seam (admin.types.ts, admin.schema.ts, admin.ts, admin.mock.ts, a new src/services/admin.orders.db.ts wired from admin.db.ts): list with filters and stats, detail, internal note, check status, CSV rows
- src/services/admin.orders.test.ts (runs over both arms through the glob)
- pure modules under src/lib/admin/: orders list filter and stats, and CSV building with escaping (+ tests)
- src/app/admin/(shell)/orders/page.tsx, orders/[reference]/page.tsx, orders/export/route.ts, actions.ts; components under src/components/admin/orders/ (+ component tests)
- src/components/admin/admin-menu.ts (+ test), src/paths.ts
- member-detail.tsx and the Admin seam's Member detail read (+ tests)
- an internal-note column on orders, if not already there; `pnpm db:generate`
- e2e: e2e/admin/orders.spec.ts on the in-memory sample data (with sample Orders added to the sample store if none exist: paid, pending, failed and one Test Order)
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, Invoice Requests (08), refunds (09), sales figures on the Overview (11).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 04 is present (the real client and the status-check backup). If it's missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, CONVENTIONS.md, the ticket (every checkbox is part of your acceptance criteria), and the spec and mockup sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, data-tables, forms-validation, shadcn-ui, tailwind-v4, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure modules:
   - search by reference and email
   - each filter
   - Manila range boundaries
   - stats
   - test toggle
   - CSV columns, quoting and formula escaping
5. TDD the Admin seam over both arms:
   - Editor refused on every call
   - unknown reference
   - note conflict check and Staff Activity
   - "Check status" applying Paid through the ledger with the fake
   - the CSV export logged
6. TDD the screens, the export route and the Member detail section.
7. e2e:
   - An Owner finds an Order by reference and by email, and filters GCash + Paid.
   - The export holds exactly those rows (read the download).
   - Ticks "Include test orders" to see the TEST row.
   - Opens a Pending Order and saves an internal note.
   - An Editor gets no SALES group and is refused /admin/orders.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Owner finds an Order by its reference and by the Member's email.
- Filtering by GCash and Paid shows only those Orders, and the CSV holds exactly them.
- Test Orders appear only with "Include test orders" ticked.
- "Check status with PayMongo" on a Pending Order that PayMongo says is paid makes it Paid and grants the days (with the fake).
- A Member's detail page lists their Orders, each linking to its detail.
- The CSV export and the internal note are in Staff Activity.
Sad paths (each one needs a test):
- An Editor is refused the list, the detail, the CSV, the note and the status check on the server.
- An empty filter shows "No Orders match", and the CSV has only the header row.
- A CSV cell starting with =, +, - or @ (e.g. a Member named "=HYPERLINK(…)") is escaped against spreadsheet formula injection.
- An unknown Order reference answers not found.
- A stale internal note hits the conflict check.
- The date range uses Manila day boundaries (an Order at 00:30 Manila on the first day is in; one at 23:59 the day before is out).
- "Check status" on an Order that isn't Pending changes nothing.

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
- A new route can leave stale .next/types. Run `pnpm exec next typegen`.
- Inline "use server" handlers must be async.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never call PayMongo or open its dashboard. Reading its public docs is fine. Never connect to the hosted Supabase project or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Every Orders read, the export route and every action refuses Editors on the server.
- No refunds in the app. The screen only points to PayMongo's dashboard.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (menu numbers, the CSV escaping rule, the dashboard URL with its source) and follow-ups
6. "No migration", or the migration filename(s) with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
