# Executer prompt — 01 Plans & prices in the Admin

Ticket: `.scratch/ayc-payments/issues/01-plans-and-prices-admin.md` · Blocked by: none · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Owners manage the Plans sold in the Member App from a new "Plans & prices" screen, in a new SALES group of the Admin sidebar. Each Plan has an Exam, a name, a duration, a price, Best value and On sale. A live preview shows the Plan as Members will see it. Editors never see or touch any of it.

CONTEXT
- This is the first ticket of Phase 4 (Payments). Nothing about Orders or PayMongo exists yet.
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 4 → "Plans"
  - "Phase 4 planning decisions (added 2026-11-24)" → "Plans & prices"
  - Testing Decisions → "Phase 4 seams" (Admin seam, extended)
  - Stories 145, 146, 151p, 151q and 151r
- Read:
  - CONTEXT.md: Plan, Access Pass, Order, Staff Role, Staff Activity
  - ADR 0010 and its amendment: a Plan always unlocks all of its Exam's content
  - .scratch/ayc-admin/CONVENTIONS.md: Staff Guard, sample/live/closed modes, Staff Activity, the conflict check
  - .scratch/ayc-payments/grilling-notes.md, decision 9
  - docs/mockup/admin/BUILD-MAP.md §3.8 "Plans & prices" and §2 (sidebar)
- Where our decisions differ from the mockup, ours win:
  - Drop the "UNLOCKS · TAP TO INCLUDE" checkboxes and the "ONE-TIME PURCHASES" table. Courses are sold in Phase 5.
  - Drop the ACTIVE user-count column.
  - Plans can be deleted, but only when they have never had an Order.
- **The Plan rules:**
  - Duration is 30, 90, 180 or 365 days, labelled "1 month · 30 days", "3 months · 90 days", "6 months · 180 days", "12 months · 365 days".
  - Price is whole pesos from ₱1 to ₱99,999.
    - Store money as integer centavos, the way Products do (src/lib/money.ts formatPeso, src/lib/admin/peso.ts).
    - The editor refuses decimals.
  - Per-month figure:
    - Display only, computed, rounded to whole pesos ("₱433 / month" for ₱1,299 over 3 months).
    - A 30-day Plan reads "for 30 days".
  - Best value: at most one per Exam. Ticking it on one Plan clears it from the others in the same write.
  - On sale: at most one Plan on sale per Exam and duration.
    - Off hides the Plan from Members.
    - Off never touches existing Access Passes.
  - Delete:
    - Only a Plan that has never had an Order.
    - Orders arrive in ticket 03. Until then, put the rule behind the seam (for example a store method saying whether a Plan has Orders, false for now), so ticket 03 only wires it up. Test the rule now.
- **The screen:**
  - Exam chips.
  - Each Plan with its period, price, per-month figure, a BEST VALUE tag and its On sale switch.
  - Footer: "PAID THROUGH PAYMONGO · MEMBERS RENEW THEMSELVES · NOTHING RENEWS AUTOMATICALLY".
  - Header primary action: "+ New plan".
  - Editor fields:
    - name, Exam, access period, price
    - "Mark as best value"
    - "On sale" ("Off hides it from Plans. Current buyers keep access.")
    - preview: "PREVIEW · MEMBER PLANS PAGE", with a tag like "CE · 3 MONTHS", the price, the per-month figure, and "DOESN'T RENEW AUTOMATICALLY · PAID THROUGH PAYMONGO"
    - the line "Price changes apply to new purchases only. Members who already paid keep what they bought."
- **Starting Plans** (the mockup's prices): CE 30 days ₱499, CE 90 days ₱1,299 (Best value), CE 180 days ₱2,299, and every other Exam 30 days ₱449.
  - In the sample data they are on sale.
  - On the live database a hand-written migration inserts them switched OFF, for the Exams that exist (insert … select from exams), until the client confirms prices and an Owner switches them on.
- **PayMongo's minimum amount:**
  - Read PayMongo's public developer docs (read only; never call their API) for a minimum Checkout Session amount per method.
  - If one is documented, refuse lower prices with a field message naming it, add a test, and give the doc URL in the report.
  - If it's unclear, keep ₱1 and say so in the report.
- **The sidebar:**
  - Add a SALES group between MEMBER APP and SETTINGS, with "Plans & prices" as an Owner-only item.
  - Settings moves down one number.
  - Ticket 07 adds "Orders & payments" to the same group later.
  - Update admin-menu.test.ts.

SCOPE
Modify or add:
- src/components/admin/admin-menu.ts (+ test); src/paths.ts (paths.admin.plans)
- src/services/admin.types.ts, src/services/admin.schema.ts (zod), src/services/admin.ts (exports), src/services/admin.mock.ts and the sample store under src/services/mock/ (starting Plans), the database arm (a new src/services/admin.plans.db.ts wired from src/services/admin.db.ts, like admin.access-passes.db.ts), and a shared core if both arms need the same rules (like src/services/access-passes.core.ts)
- src/services/admin.plans.test.ts. The ADMIN_SUITES glob runs it over both arms.
- src/lib/db/schema.ts (a plans table, RLS on); `pnpm db:generate` for the table, plus a hand-written migration for the switched-off starting Plans; keep src/lib/db/deny-all.db.test.ts passing
- src/app/admin/(shell)/plans/page.tsx and actions.ts; components under src/components/admin/plans/ with component tests; a pure view/format module (per-month figure, labels) under src/lib/admin/ with tests
- e2e/admin/plans.spec.ts on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Member App.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Check `ps` for another executer's Vitest, Playwright or next processes. If one is running, stop and ask (one executer at a time).
2. Read AGENTS.md, CONTEXT.md, CONVENTIONS.md, the ticket (every checkbox is part of your acceptance criteria), and the spec and mockup sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, forms-validation, shadcn-ui, tailwind-v4, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure parts first:
   - the per-month figure and duration labels
   - the zod schema (name, Exam, duration, whole-peso price range, flags)
5. TDD the Admin seam over both arms:
   - create, edit, switch on/off, delete
   - Best value clearing the others in one write
   - one on sale per Exam and duration
   - delete refused when the Plan has Orders
   - Staff Activity for every write (src/services/admin.activity-coverage.test.ts must stay green)
   - the conflict check on a stale edit
   - Editors refused
6. Add the table, run `pnpm db:generate`, and write the starting-Plans data migration by hand.
7. TDD the screen, the editor and the preview with component tests, then the sidebar group.
8. e2e: an Owner opens Plans & prices, creates a 365-day CE Plan, sees the preview's per-month figure, saves it, and ticks Best value on it (the 90-day CE Plan loses its tag). An Editor sees no SALES group, and /admin/plans refuses them.
9. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Owner creates a 365-day CE Plan, sees it in the preview with its per-month figure, saves it, and it appears in the list.
- Ticking Best value on one CE Plan clears it from the other CE Plans.
- Switching a Plan off keeps it in the Admin list, marked off.
- The sample data has the starting Plans on sale. The migration inserts them switched off.
- Every create, edit, switch and delete is in Staff Activity with before and after values.
Sad paths (each one needs a test):
- An Editor sees no SALES group and is refused every Plans read and action on the server (and the page).
- A price of 0, a decimal (e.g. 499.50), a negative, a non-number, or above ₱99,999 is refused with a field message.
- A duration other than 30, 90, 180 or 365 is refused.
- A second Plan on sale for the same Exam and duration is refused with a message, and nothing is written.
- An empty or whitespace-only name is refused.
- A Plan for an Exam that isn't in the catalogue is refused.
- A stale edit hits the conflict check.
- Deleting a Plan that has an Order is refused (through the seam's rule, for now).

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked, as the e2e server has them
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.
- A new route can leave stale .next/types that fail type:check. Run `pnpm exec next typegen`.
- Inline "use server" handlers must be async (only build and e2e catch it).
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo (API or dashboard) or Vercel, and never apply a migration to hosted. Reading PayMongo's public docs is fine.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings (read variable names only), and never put a real person's email address in the repo.
- Authorisation stays on the server. Every Plans read and write refuses Editors on the server, not just in the menu.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the menu numbers, how "has Orders" is stubbed for ticket 03, the PayMongo minimum with its source) and follow-ups
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
