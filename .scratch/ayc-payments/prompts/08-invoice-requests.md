# Executer prompt — 08 Invoice Requests

Ticket: `.scratch/ayc-payments/issues/08-invoice-requests.md` · Blocked by: 06, 07 · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
A Member asks for the official invoice of a Paid Order, with the details to put on it. Owners track the requests and mark them sent. The invoice itself is issued outside the app and emailed from the support inbox. The app sends no email.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - "Phase 4 planning decisions (added 2026-11-24)" → "Payment Acknowledgement and Invoice Requests", "Orders and sales figures" (CSV columns)
  - Testing Decisions → "Phase 4 seams"
  - Stories 144, 151j and 151v
- Read:
  - CONTEXT.md: Invoice Request, Payment Acknowledgement, Order
  - .scratch/ayc-payments/grilling-notes.md, decisions 10 and 11
  - .scratch/ayc-admin/CONVENTIONS.md
- Tickets 06 and 07 added these pieces. Find them in the code, and don't invent paths:
  - Billing, the Payment Acknowledgement (with its "Request official invoice" placeholder area), the business details and the shared TIN validator (src/lib/payments/tin.ts or similar)
  - the Orders admin (list filters, Order detail, the CSV with empty invoice columns)
  - If ticket 05 is present, use its effective-status function: a Pending over 24 h is Expired.
- **Invoice Requests** (a new table, RLS on, no anon or authenticated policies):
  - One per Order, enforced by a unique key on the Order.
  - Fields: name on the invoice, address, TIN (optional), requested_at, sent_at, and who marked it sent (email and name as they were then).
  - Keep it with the Order if the account is later deleted (ticket 14). Reference the Order, not the Member.
- **The Member:**
  - "Request official invoice" on the Acknowledgement, and on the Order's row in Billing, opens a short form:
    - name on the invoice, prefilled from the Member's name
    - address
    - TIN (optional, "for businesses"), validated with the shared TIN validator
  - Only for the Member's own Paid Order, and only once.
  - Billing and the Acknowledgement then show "Invoice requested", later "Invoice sent · check your email".
- **Owners:**
  - An "Invoice requested" filter on the Orders list: requested, not yet sent.
  - The request's details on the Order detail.
  - "Mark invoice sent": logged in Staff Activity. Marking an already sent request again changes nothing and logs nothing.
  - The CSV's invoice columns filled in.
- **No automatic email.**

SCOPE
Modify or add:
- src/lib/db/schema.ts (invoice_requests); `pnpm db:generate`; keep deny-all.db.test.ts passing
- the Member seam (member.types.ts, member.ts, member.mock.ts, member.db.ts): request an invoice, and read its state with own Orders; src/services/member.invoice-requests.test.ts, added to MEMBER_SUITES in vitest.config.ts
- the Admin seam (Orders list filter, detail, CSV rows, markInvoiceSent); src/services/admin.orders.test.ts or a new admin.invoice-requests.test.ts
- zod schemas for the form (+ tests)
- the Acknowledgement and Billing components, the Orders list filter, the Order detail panel, the CSV builder (+ tests)
- e2e: extend e2e/member-app/billing.spec.ts and e2e/admin/orders.spec.ts on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, refunds (09), Needs attention (11).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that tickets 06 and 07 are present (Billing and the Acknowledgement; the Orders admin and CSV). If either is missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, CONVENTIONS.md, the ticket (every checkbox is part of your acceptance criteria), and the spec sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, forms-validation, shadcn-ui, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the form schema: name and address required (trimmed), TIN optional but well-shaped, length limits.
5. TDD the Member seam over both arms:
   - request for own Paid Order
   - second request refused
   - Pending, Failed, Expired or another Member's Order refused
   - state shown
6. TDD the Admin seam over both arms:
   - the filter (requested, not sent)
   - the detail
   - "Mark invoice sent" (Staff Activity once, idempotent)
   - Editor refused
   - CSV columns filled
7. TDD the components.
8. e2e:
   - A sample Member requests an invoice for a Paid Order and sees "Invoice requested".
   - An Owner filters "Invoice requested", opens the Order, sees the details and marks it sent.
   - The Member sees "Invoice sent · check your email".
9. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- A Member requests an invoice for a Paid Order and sees "Invoice requested".
- An Owner filters "Invoice requested", opens the Order, sees the details and marks it sent. The Member then sees "Invoice sent · check your email".
- The CSV's invoice columns hold the request's name, address and TIN.
- "Mark invoice sent" is in Staff Activity.
Sad paths (each one needs a test):
- A second request for the same Order is refused (and the database's unique key holds under a double submit).
- A request for a Pending, Failed or Expired Order, or another Member's Order, is refused.
- An empty or whitespace-only name or address is refused with a field message.
- A TIN in the wrong shape is refused.
- An Editor is refused "Mark invoice sent" and the request details on the server.
- Marking an already sent request again changes nothing and logs nothing.

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
- A new src/services/member.*.test.ts must be added to MEMBER_SUITES in vitest.config.ts.
- Inline "use server" handlers must be async.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address, address or TIN in the repo. Use obviously fake fixture values.
- Authorisation stays on the server. A Member requests only for their own Paid Order, and only Owners read requests or mark them sent.
- No email is sent.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made and follow-ups
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
