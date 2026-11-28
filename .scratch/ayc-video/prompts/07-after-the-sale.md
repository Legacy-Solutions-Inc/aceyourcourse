# Executer prompt — 07 After the sale

Ticket: `.scratch/ayc-video/issues/07-after-the-sale.md` · Blocked by: 06 · Branch: `feat/phase5-video` (shared by every Phase 5 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Course Orders are handled like Plan Orders everywhere after checkout. Refunds remove the Course, Owners can give or remove a Course, Members see their Courses on Billing, and the Owner's records, figures and exports include Course sales.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 5 → "Phase 5 planning decisions (added 2026-11-28)": The Order ledger for Course Orders, Giving a Course, Everywhere else, Course Orders follow Phase 4
  - Phase 4 → "Phase 4 planning decisions (added 2026-11-24)": Refunds, "End granted access", Deleting an account that has Orders, Orders and sales figures
  - Testing Decisions → "Phase 5 seams" (Order ledger; Member seam; Admin seam; the webhook route)
  - Stories 143, 144, 172, 182, 183, 184
- Read:
  - CONTEXT.md: Course Ownership, Order, Refunded, Test Order, Invoice Request, Payment Acknowledgement, Staff Role
  - .scratch/ayc-video/grilling-notes.md, decisions 9 and 11
  - .scratch/ayc-payments/grilling-notes.md, decisions 6, 7 and 13
- Tickets 01–06 added Courses, Course Ownership (with its source), the access decision for Lessons, Lesson progress, Orders that hold a Plan or a Course, the ledger's Course grant and the "Course already owned" flag. Find them in the code, and don't invent paths.
- Existing pieces to follow:
  - Refunds: src/lib/payments/refunds.ts, order-ledger.ts (+ order-ledger.refunds.test.ts), the webhook route under src/app/api/paymongo/webhook, src/services/member.refunds.test.ts
  - Grants by hand: src/services/access-passes.core.ts (Owner-only, notices, Staff Activity) and src/components/admin/users/access-passes.tsx, member-detail.tsx
  - Notices: src/lib/member-app/notices.ts and the member_notice_kind enum in src/lib/db/schema.ts; src/components/member-app/member-notices.tsx
  - Billing and the Acknowledgement: src/components/member-app/billing-screen.tsx, billing-view.ts, payment-acknowledgement.tsx, src/app/app/(shell)/billing/**; Invoice Requests (src/lib/payments/invoice-requests.ts, invoice-request-form.tsx)
  - The Orders admin: src/lib/admin/orders-list.ts, orders-csv.ts, order-view.ts, src/components/admin/orders/ (order-list, order-detail, order-filters, export-csv-button), src/services/orders-admin.core.ts
  - Sales figures: src/lib/payments/sales-figures.ts (+ test), src/services/sales.core.ts
  - Account deletion and the data copy: src/services/privacy-requests.core.ts (deleteAccount, exportMemberData), src/lib/member-app/data-export.ts (MEMBER_DATA_VERSION = 2) (+ tests), src/components/admin/users/privacy-request-detail.tsx
- **Refunds of a Course Order:**
  - A full refund makes the Order Refunded and removes the Course Ownership, unless another Paid Order or a gift still holds it.
  - Notice: "Your refund for AYC-10483 was processed. You no longer own the PSAD Masterclass." Logged as "PayMongo (system)".
  - A partial refund leaves ownership unchanged; the Order shows "PARTIALLY REFUNDED · ₱300". Partials adding up to the full amount count as a full refund.
  - Refund events keep Phase 4's rules: signature checked, applied once, out of order handled.
- **Giving a Course** (Owner-only, on the Member's page in the Admin):
  - "Give Course": pick a separately sold Course; the Member gets Course Ownership with the source "Given by Ace Your Course" and a notice "You now own the PSAD Masterclass". Logged in Staff Activity.
  - "Remove Course": only for a given Ownership, with a notice to the Member. A paid one goes only by a full refund in PayMongo.
  - Giving a Course the Member already owns is refused. Editors can do neither (refused on the server).
  - The Member's page lists their Courses with each one's source.
- **Billing:** "Your Courses" beside Access Passes (name, since, source: the Order reference or "Given by Ace Your Course"); Course Orders in the history.
- **The Payment Acknowledgement** for a Course Order: "PSAD Masterclass · Video course · yours to keep", no access period. Invoice Requests work the same as for Plans.
- **The Orders admin:** the Course's name in the list, detail and CSV (an item column), and a Plans vs Courses filter in the URL.
- **Sales figures** count paid Course Orders; refunds subtract on their own Manila day; Test Orders stay out.
- **Deleting an account:** removes its Course Ownerships, keeps its Course Orders detached ("Account deleted"), stays blocked while any Order is Pending, and the "N paid Orders are kept…" count includes Course Orders.
- **"Download this Member's data"** adds Course Ownerships and Lesson progress. Bump MEMBER_DATA_VERSION and keep older-version tests meaningful.

SCOPE
Modify or add:
- src/lib/payments/order-ledger.ts and refunds.ts (+ tests): Course refunds
- a core module for giving and removing Courses (e.g. src/services/course-ownership.core.ts) on the Admin seam (+ src/services/admin.course-ownership.test.ts over both arms)
- src/lib/db/schema.ts: new notice kinds (and anything else needed); `pnpm db:generate`; keep deny-all.db.test.ts passing
- the Member seam: Billing's Courses, the Acknowledgement for Course Orders; src/services/member.course-ownership.test.ts, added to MEMBER_SUITES in vitest.config.ts
- the webhook route test with signed Course refund fixtures
- billing-screen.tsx, billing-view.ts, payment-acknowledgement.tsx, member-notices (+ tests)
- orders-list.ts, orders-csv.ts, order-view.ts and the Orders components (+ tests)
- sales-figures.ts (+ test)
- privacy-requests.core.ts and data-export.ts (+ tests)
- member-detail.tsx and a Courses panel beside access passes (+ tests)
- e2e: extend e2e/admin/users.spec.ts (Give and Remove Course), e2e/admin/orders.spec.ts (the Courses filter and CSV) and e2e/member-app/billing.spec.ts (Your Courses) on the in-memory sample data with the payments fake
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the checkout (ticket 06) beyond fixing a bug you must report.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md, docs/adr/0013-video-on-vdocipher.md, and earlier Phase 5 tickets' uncommitted work if the user says so. Stop and report anything else.
   - `git switch feat/phase5-video`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 06 is present (Course Orders and the ledger's Course grant). If it's missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), and the spec and notes sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, data-tables, shadcn-ui, tailwind-v4, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the ledger (Seam 4): a full refund removing ownership; kept when another Paid Order or a gift holds it; never removing a gift; partials, and partials adding up to full; duplicate and out-of-order refund events.
5. TDD giving over both arms: Give, Remove (given only), refusals for an already-owned Course, a paid Ownership and Editors; notices and Staff Activity.
6. TDD the records: Billing's Courses, the Acknowledgement line, the Orders filter, CSV column and detail, sales figures with Course Orders (Test Orders out, refunds on their day), account deletion (ownerships removed, Orders detached, blocked while Pending), the export (new version, older versions still read).
7. e2e:
   - An Owner gives "HPGE Crash Course" to a sample Member, who sees it OWNED and the notice; the Owner removes it.
   - An Owner filters Orders to Courses and exports a CSV that names the Course.
   - After buying "PSAD Masterclass" (payments fake), Bea's Billing shows it under "Your Courses" and its Acknowledgement prints the Course line.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- A full refund of Bea's Course Order removes the Course from her Courses screen and Billing, and she gets the notice.
- An Owner gives a Course to a Member, who sees it OWNED and the notice; the Owner then removes it.
- Billing shows "Your Courses" with the source, and the Course Order's Payment Acknowledgement prints the Course line.
- An Owner filters Orders to Courses and exports a CSV with the Course's name; today's paid total includes the Course Order.
Sad paths (each one needs a test):
- A full refund of one of two Paid Orders for the same Course keeps the ownership.
- A refund never removes a given Ownership.
- A partial refund leaves ownership unchanged; partials adding up to the full amount remove it.
- "Remove Course" is refused for a paid Ownership; "Give Course" is refused when the Member already owns it.
- An Editor is refused giving and removing on the server.
- A Test Order for a Course isn't counted in the sales figures.
- Deleting an account removes its Course Ownerships and keeps its Course Orders detached; it's refused while a Course Order is Pending.
- The data export includes Course Ownerships and Lesson progress, and older export versions still read correctly.
- Another Member's Courses or Orders are never readable in the Member App.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables, SUPABASE_SECRET_KEY, both PAYMONGO_* variables and VDOCIPHER_API_SECRET blanked
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data, the payments and video fakes). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in. Make sure the copy has no leftover coverage/ or build output.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.
- A new src/services/member.*.test.ts must be added to MEMBER_SUITES in vitest.config.ts.
- Sample data dated relative to "now" must use the run's clock.
- Inline "use server" handlers must be async.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.
- Known failures on HEAD (check they fail without your change too, and report rather than fix): the sharp beforeAll timeouts (page-images.sharp, reviewer-reader), products-list.spec:173, the e2e overview promo-banner spec, and the database-arm member.payments / member.billing suites on PGlite.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase5-video, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project (or its Auth admin), PayMongo, VdoCipher or Vercel, and never apply a migration to hosted. Tests use the auth-admin fake and signed fixtures.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Only Owners give or remove Courses; only a full refund removes a paid Ownership; Members read only their own Courses and Orders.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the export version bump, the CSV item column, the notice kinds) and follow-ups
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
