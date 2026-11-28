# Executer prompt — 14 Deleting an account that has Orders

Ticket: `.scratch/ayc-payments/issues/14-account-deletion-with-orders.md` · Blocked by: 05 · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Deleting a Member's account keeps their Orders as tax records, detached from the account, and payments can never land on an account that no longer exists.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 3 → "Privacy Requests"
  - "Phase 3 planning decisions (added 2026-11-17)" → "Privacy Requests in the Admin"
  - "Phase 4 planning decisions (added 2026-11-24)" → "Deleting an account that has Orders"
  - Testing Decisions → "Phase 4 seams" (Admin seam: account deletion keeping detached Orders and refused while one is Pending; the webhook route: a payment for a deleted account recorded with no grant)
  - Story 151y
- Read:
  - CONTEXT.md: Order, Invoice Request, Member, Staff Role
  - .scratch/ayc-payments/grilling-notes.md, decision 13
- Existing pieces:
  - src/services/privacy-requests.core.ts (deleteAccount, exportMemberData) and src/services/admin.privacy-requests.db.ts (+ src/services/admin.privacy-requests.test.ts)
  - src/services/auth-admin.types.ts / auth-admin.fake.ts
  - src/lib/member-app/data-export.ts (MEMBER_DATA_VERSION) (+ test)
  - the Owner's deletion screen (src/components/admin/users/privacy-request-detail.tsx, src/components/admin/typed-delete-dialog.tsx)
  - the Member's delete box (src/components/member-app/account-privacy.tsx, which already says "Plans you paid for aren't refunded")
- Tickets 03–05 (and 07, 08, 11 if present) added these pieces. Find them in the code, and don't invent paths:
  - Orders, with user_id ON DELETE SET NULL and the buyer's name and email copied at Pay
  - the effective-status function (Pending over 24 h reads Expired)
  - the ledger, Expired → Paid and the webhook route
  - the Orders admin and CSV
  - Invoice Requests
  - Needs attention's "Paid, account deleted · refund in PayMongo" item
  - If ticket 03 didn't copy the buyer's name and email, or didn't use SET NULL, add that here (with a migration) and say so.
- **On deletion** (the Owner's "Delete this account" from a Privacy Request):
  - The account, its progress, Access Passes and devices are removed as before.
  - Its Orders stay, detached from the account: user_id empty. They keep reference, dates, item, amount, Payment Method, status, refunds, the PayMongo ids, the buyer's name and email as at purchase, and any Invoice Request.
  - The Admin shows them as "Account deleted" in the Orders list, detail and CSV. There's no Member link.
- **A Pending Order blocks deletion** until it's resolved or expired, judged with the effective status, so read-time expiry counts.
  - The message: "This Member has a payment in progress. Try again after it's confirmed or expires (by {time})." {time} is the Order's created_at + 24 h in Manila time.
  - Nothing is deleted, and the Privacy Request stays open.
- **A late payment** (Expired → Paid, or any paid event) on a detached Order is recorded as Paid with no grant: no Access Pass, no notice, no Target Exam. It's logged in Staff Activity as "PayMongo (system)".
  - It appears in Needs attention as "Paid, account deleted · refund in PayMongo". Fill the item if ticket 11 added it, otherwise add it to src/lib/admin/needs-attention.ts.
- **The Owner's confirmation** says "N paid Orders are kept for tax records, without the account." (omit when N is 0).
- **"Download this Member's data"** adds their Orders and Invoice Requests. Bump MEMBER_DATA_VERSION and keep older-version tests meaningful.
- **The Member's own delete box** adds "Payment records are kept as the law requires."
- A deleted account's Orders are never shown to anyone in the Member App. A new account by the same Google user starts with no Orders.

SCOPE
Modify or add:
- src/services/privacy-requests.core.ts and the database arm (+ src/services/admin.privacy-requests.test.ts over both arms)
- the ledger and webhook handling for detached Orders (+ ledger tests and the webhook route test with a signed fixture)
- src/lib/member-app/data-export.ts (+ test)
- the Orders admin reads, views and CSV for "Account deleted" (+ tests)
- needs-attention.ts (+ test), if the item isn't there yet
- privacy-request-detail.tsx / the confirm dialog copy, and account-privacy.tsx (+ tests)
- a migration only if Orders lack SET NULL or the buyer snapshot; `pnpm db:generate`
- e2e: extend e2e/admin/privacy-requests.spec.ts on the in-memory sample data (a sample Member with two Paid Orders)
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 05 is present (the webhook, Expired → Paid, the effective status). If it's missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), and the spec sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the deletion rules over both arms:
   - two Paid Orders kept, detached, with the buyer's name and email
   - refused with a Pending Order younger than 24 h, with the right "by {time}"
   - allowed once it's Expired (including read-time expiry)
   - an Editor still refused
   - the confirmation count
5. TDD the ledger and webhook: a paid event for a detached Order records Paid, grants nothing, writes no notice, and shows in Needs attention.
6. TDD the export (Orders and Invoice Requests included), the Orders admin's "Account deleted" rows and CSV, and the copy changes.
7. e2e: an Owner deletes a sample Member with two Paid Orders from a Privacy Request (the confirmation shows "2 paid Orders are kept…"), and the Orders list still shows both as "Account deleted".
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- Deleting a Member with two Paid Orders removes the account and keeps both Orders, marked "Account deleted", with the buyer's name and email.
- The data export includes the Member's Orders and Invoice Requests.
- The Owner's confirmation and the Member's delete box show the new lines.
Sad paths (each one needs a test):
- Deletion is refused while the Member has a Pending Order younger than 24 hours, and nothing is deleted.
- Deletion is allowed once that Order is Expired (including read-time expiry).
- A paid webhook for a deleted account's Order records Paid, grants nothing, and shows in Needs attention.
- A deleted account's Orders are never shown to anyone in the Member App, including a new account for the same person.
- An Editor is still refused deletion on the server.
- The Orders list and CSV still include the detached Orders.

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
- Inline "use server" handlers must be async.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project (or its Auth admin), PayMongo or Vercel, and never apply a migration to hosted. Tests use the auth-admin fake.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Only Owners delete accounts, and detached Orders are visible only in the Admin.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the export version bump, how "Account deleted" is derived) and follow-ups
6. "No migration", or the migration filename(s) with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
