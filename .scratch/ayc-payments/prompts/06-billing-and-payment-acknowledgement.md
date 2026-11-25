# Executer prompt — 06 Billing and the Payment Acknowledgement

Ticket: `.scratch/ayc-payments/issues/06-billing-and-payment-acknowledgement.md` · Blocked by: 03 · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
The Member App's Billing screen (/app/billing, today a "Coming in the beta" placeholder) shows the Member's Access Passes and every Order. Each Paid Order has a printable Payment Acknowledgement. Owners enter the business details printed on it in Settings.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 4 → "Payment Acknowledgement"
  - "Phase 4 planning decisions (added 2026-11-24)" → "Payment Acknowledgement and Invoice Requests"
  - Testing Decisions → "Phase 4 seams"
  - Stories 143, 144 and 151u
- Read:
  - CONTEXT.md: Payment Acknowledgement (not an official BIR invoice), Order, Test Order, Access Pass, Payment Method
  - .scratch/ayc-payments/grilling-notes.md, decision 10
  - .scratch/ayc-admin/CONVENTIONS.md
  - docs/mockup/member-app/BUILD-MAP.md §3 "Billing (L452–477, L848–855)" and "Receipt (L662–674)"
  - docs/mockup/admin/BUILD-MAP.md §3.11 "Settings"
  - Where the mockup says "receipt", we say Payment Acknowledgement.
- Ticket 03 added Orders, the Order ledger and the Member seam's Order reads. Ticket 05, if present, added the read-time Expired status. Find them in the code, and don't invent paths. If the effective-status function isn't there yet, apply "Pending older than 24 h reads Expired" in a small pure helper, and note it for ticket 05.
- Other existing pieces:
  - src/app/app/(shell)/[screen]/page.tsx: the placeholder that serves Billing. Give Billing its own folder.
  - src/services/member.ts listAccessPasses
  - src/lib/manila-time.ts, src/lib/money.ts
  - Settings: src/app/admin/(shell)/settings/page.tsx and actions.ts, src/components/admin/settings/settings-editor.tsx, the website_settings single row, the Admin seam's settings write with the conflict check and Staff Activity
- **Billing** ("Your payment history. Card details stay with PayMongo; we never see them."):
  - Access:
    - Each Access Pass shows its Exam, ACTIVE or ENDED, and "Until {date} · N days left · renews only if you renew".
    - "Renew now" → Plans for that Exam.
  - Orders:
    - Every Order of the signed-in Member, newest first, with reference, date, item, Payment Method, amount and status (Pending, Paid, Failed, Expired; a Pending older than 24 h reads Expired).
    - Test Orders are marked TEST.
    - Each Paid Order links to its Acknowledgement.
  - Empty: "No payments yet" and "See plans".
- **The Payment Acknowledgement** (e.g. /app/billing/[reference]):
  - Printable, with a "Print or save as PDF" button (window.print) and print CSS that hides the shell.
  - "Payment Acknowledgement · This is not an official invoice".
  - Number (the reference), date (Manila), billed to (the Member's name and email), seller (the business details).
  - The line item with its access period and "no auto-renewal".
  - Total paid, Payment Method, PayMongo reference (payment id, or checkout id when there's no payment id), status.
  - "Prices include VAT" when VAT-registered is yes.
  - TEST marked on a Test Order.
  - A "Request official invoice" placeholder area. Ticket 08 builds the request, so put no form here.
  - Only for the Member's own Paid Order. Anything else is notFound.
- **Business details** in Settings (Owners only; Settings is already Owner-only):
  - business name, address, TIN (optional), VAT-registered yes/no
  - New columns on website_settings, saved through the Admin seam with the conflict check, and logged in Staff Activity.
  - Until they're filled in, the Acknowledgement shows the business name only, defaulting to "Ace Your Course".
- **TIN:**
  - 9 digits, optionally followed by a 3- or 5-digit branch code, with or without dashes (e.g. 123-456-789 or 123-456-789-000).
  - Stored normalised with dashes.
  - Put the validator in a pure shared module (e.g. src/lib/payments/tin.ts), because ticket 08 reuses it.

SCOPE
Modify or add:
- the Member seam (member.types.ts, member.ts, member.mock.ts, member.db.ts): list own Orders, read own Paid Order's Acknowledgement data (with the business details)
- src/services/member.billing.test.ts, added to MEMBER_SUITES in vitest.config.ts
- src/app/app/(shell)/billing/page.tsx and billing/[reference]/page.tsx; components (+ component tests), a pure view module (+ test)
- the Admin seam's business-details write (admin.types.ts, admin.schema.ts, admin.mock.ts, admin.db.ts) and src/services/admin.settings.test.ts
- src/lib/db/schema.ts (website_settings columns); `pnpm db:generate`
- the Settings page, its action and settings-editor.tsx (+ test)
- src/lib/payments/tin.ts (+ test)
- e2e: e2e/member-app/billing.spec.ts and the Settings part in e2e/admin/settings.spec.ts, on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, Invoice Requests (ticket 08), refunds (ticket 09).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 03 is present (Orders and Pay with the fake). If it's missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, CONVENTIONS.md, the ticket (every checkbox is part of your acceptance criteria), and the spec and mockup sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, forms-validation, shadcn-ui, tailwind-v4, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure parts:
   - the TIN validator
   - days-left and status labels (Expired at read time)
   - Manila dates
   - the VAT line
5. TDD the Member seam over both arms: own Orders only, Acknowledgement only for own Paid Orders.
6. TDD the Admin seam's business details: Editor refused, conflict check, Staff Activity.
7. TDD the pages and components, then the Settings section.
8. e2e:
   - A sample Member buys CE 3 months with the fake ("Simulate paid"), opens Billing, sees the Access Pass and the Paid Order, opens the Acknowledgement, and sees the business name and the print button.
   - An Owner fills in business details with VAT yes, and the Acknowledgement shows them and "Prices include VAT".
9. Run `pnpm exec next typegen` after adding routes. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- A Member who bought CE 3 months sees the Access Pass and the Paid Order in Billing, opens the Acknowledgement and prints it.
- The Acknowledgement shows the business details from Settings, and "Prices include VAT" only when VAT-registered is yes.
- An Owner fills in the business details and sees them on an Acknowledgement.
- The business details save is in Staff Activity.
Sad paths (each one needs a test):
- A Member can never open another Member's Acknowledgement (not found).
- A Pending, Failed or Expired Order has no Acknowledgement (no link, and the URL answers not found).
- An Editor is refused the business details on the server.
- A TIN in the wrong shape is refused with a field message.
- A stale business-details save hits the conflict check.
- An empty Billing shows "No payments yet" and "See plans".
- Dates on Billing and the Acknowledgement are right in Manila time.
- A Test Order's Acknowledgement is marked TEST.
- Before business details are set, the Acknowledgement shows "Ace Your Course" only.

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
- A new or moved route can leave stale .next/types. Run `pnpm exec next typegen`.
- A new src/services/member.*.test.ts must be added to MEMBER_SUITES in vitest.config.ts.
- Inline "use server" handlers must be async.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency (printing uses the browser). Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address or a real TIN in the repo. Use obviously fake values in fixtures.
- Authorisation stays on the server. A Member reads only their own Orders, and only Owners save business details.
- The page never calls itself an invoice or a receipt. It's a Payment Acknowledgement.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the Acknowledgement route, the TIN rule, the PayMongo reference shown) and follow-ups
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
