# Executer prompt — 11 Sales figures and Needs attention

Ticket: `.scratch/ayc-payments/issues/11-sales-figures-and-needs-attention.md` · Blocked by: 08, 09 · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Owners see how the business is doing on the Admin Overview, through KPI tiles, a paid-sales chart and a "PAID TODAY" sidebar card. Needs attention lists the payment work waiting for them. Editors see none of it.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - "Phase 4 planning decisions (added 2026-11-24)" → "Orders and sales figures"
  - Testing Decisions → "Phase 4 seams" (Order ledger: the sales figures; Admin seam: the sales figures)
  - Stories 151, 151w and 151x
- Read:
  - CONTEXT.md: Order, Test Order, Refunded, Access Pass, Staff
  - .scratch/ayc-payments/grilling-notes.md, decision 11 and "Defaults" (PAID TODAY for Owners only)
  - docs/mockup/admin/BUILD-MAP.md §3.1 "Overview" and §2 (the PAID TODAY card)
- Tickets 03–09 added these pieces. Find them in the code, and don't invent paths:
  - Orders, with paid_at and livemode
  - the effective-status function (Pending over 24 h reads Expired)
  - "Paid after expiry"
  - refunds with their own refunded_at and amounts
  - Invoice Requests (requested, not sent)
  - the Orders list and its URL filters
- Existing pieces:
  - src/app/admin/(shell)/page.tsx (Overview)
  - the Admin seam's getOverview and src/services/admin.overview.test.ts
  - src/lib/admin/needs-attention.ts (+ test) and src/components/admin/overview/
  - src/components/admin/admin-sidebar.tsx
  - src/lib/manila-time.ts
  - src/lib/money.ts
  - recharts, already a dependency (use the shadcn chart wrapper if src/components/ui has one)
- **Who:** Owners only. An Editor's Overview shows no sales tiles, chart, card or payment items, and the sales figures are refused for Editors on the server (the seam returns none for them; don't just hide them in the UI).
- **The rules** (put them in pure functions in the ledger or a sales module):
  - Days and months are Manila time.
  - A paid amount counts on its paid day.
  - Refunds are subtracted on the refund day, not the paid day, and each money tile shows "₱X refunded".
  - Test Orders (livemode false) are left out everywhere here.
  - Active Members: Members with at least one active Access Pass (paid or granted), Staff excluded.
- **KPI tiles** (each clickable to the filtered Orders list or Users):
  - paid today, with "+₱X vs yesterday" (or −)
  - paid this month, with the change vs last month
  - active Members
  - Access Passes ending in the next 7 days
- **The paid-sales chart:** 14 or 30 days of daily net totals, with tooltips. Today's bar is highlighted. A day with no sales shows ₱0.
- **The sidebar's "PAID TODAY" card:** paid today, number of Orders, number pending, linking to Orders. Owners only.
- **Needs attention gains** (each links to the filtered Orders list):
  - "N payments pending", with the oldest age shown (Pending and not yet Expired)
  - "N invoice requests to send"
  - "N Orders paid after expiry"
  - "Paid, account deleted · refund in PayMongo". Ticket 14 fills it. Put the item and its count in place now (zero until then), and give the Orders list a filter for it if needed.

SCOPE
Modify or add:
- a pure sales-figures module (+ tests): day and month totals, refunds on their day, test exclusion, deltas, chart series
- the Admin seam's Overview read (both arms) and src/services/admin.overview.test.ts
- src/lib/admin/needs-attention.ts (+ test): the new kinds
- src/app/admin/(shell)/page.tsx, components under src/components/admin/overview/ (tiles, chart) and admin-sidebar.tsx (card) (+ component tests)
- sample data: enough paid, refunded, pending and test Orders across a few Manila days to make the screen meaningful
- e2e: extend e2e/admin/overview.spec.ts on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, account deletion (14).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that tickets 08 and 09 are present (Invoice Requests, refunds). If either is missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), and the spec and mockup sections above. The e2e overview promo-banner spec failed on HEAD before Phase 4. If it still fails, check it fails without your change too, and report it rather than fixing it.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, dataviz, shadcn-ui, tailwind-v4, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure figures:
   - 23:59 vs 00:01 Manila on different days
   - month boundaries
   - a refund today lowering today, not the paid day
   - "₱X refunded"
   - Test Orders never counted
   - Staff excluded from active Members
   - a ₱0 day in the series
   - no Orders at all
5. TDD the seam over both arms: an Editor gets no figures, and an Owner's match the fixture Orders.
6. TDD needs-attention's new items and counts (zero items hidden), the tiles, the chart's data and highlight, and the sidebar card's Owner-only rendering.
7. e2e:
   - An Owner sees today's paid total, this month's, the chart and the PAID TODAY card, plus "payments pending" and "invoice requests to send" linking to the filtered Orders list.
   - An Editor sees none of them.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Owner sees today's paid total, this month's total and the chart, matching the fixture Orders.
- A refund today lowers today's figure and shows "₱X refunded".
- Needs attention shows pending payments and invoice requests with the right counts, linking to the filtered Orders list.
- The PAID TODAY card shows paid today, Orders and pending, and opens Orders.
Sad paths (each one needs a test):
- An Editor sees no sales tiles, chart, card or payment items, and the figures are refused on the server.
- A payment at 23:59 and one at 00:01 Manila land on different days.
- Test Orders never count.
- Staff with an Access Pass aren't counted as active Members.
- A day with no sales shows ₱0 in the chart.
- With no Orders at all, the tiles show ₱0 and Needs attention has no payment items.

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
- Sample data dated "today" must be relative to the run's clock, so e2e doesn't break tomorrow.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency (recharts is already there). Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Sales figures never reach an Editor's page.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (where the sales rules live, the chart range default) and follow-ups
6. "No migration", or the migration filename(s) with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
