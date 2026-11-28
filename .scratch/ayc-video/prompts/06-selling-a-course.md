# Executer prompt — 06 Selling a Course

Ticket: `.scratch/ayc-video/issues/06-selling-a-course.md` · Blocked by: 05 · Branch: `feat/phase5-video` (shared by every Phase 5 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Owners choose which Courses are sold separately and set their prices. Members buy one through the existing Plans checkout and own it for good. The Terms of Use explain it (Legal v2.2).

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 5 → "Phase 5 planning decisions (added 2026-11-28)": Who does what, Buying a Course, The Order ledger for Course Orders, Hiding, unpublishing and deleting (the delete guard), Legal v2.2
  - Phase 4 → "Order ledger", "PayMongo integration", "Phase 4 planning decisions (added 2026-11-24)" (the key decides, the method in the app, one item per Order, the price fixed at Pay, late payments, Legal v2.1)
  - Testing Decisions → "Seam 4, Order ledger", "Phase 4 seams" and "Phase 5 seams" (Order ledger; Member seam; Admin seam; the webhook route)
  - Stories 153, 169, 170, 171, 173, 180, 181, 184, 185
- Read:
  - CONTEXT.md: Course, Course Ownership, Order, Plan, Access Pass, Payment Method, Test Order, Staff Role
  - .scratch/ayc-video/grilling-notes.md, decisions 2, 4, 5, 8, 10 and 11
  - .scratch/ayc-payments/grilling-notes.md, decisions 3, 4 and 5
  - docs/mockup/member-app/BUILD-MAP.md "Plans" (the ONE-TIME PURCHASE row) and docs/mockup/admin/BUILD-MAP.md "Plans & prices" (One-time purchases)
- Tickets 01–04 added Courses (with how Members get them, price and On sale stored and shown read-only), Modules, Lessons, the video service, Course Ownership records, the access decision for Lessons, the Courses screen and Lesson progress. Find them in the code, and don't invent paths.
- Existing pieces to follow:
  - Plans admin: src/app/admin/(shell)/plans/**, src/services/plans.core.ts, admin.plans.db.ts, src/components/admin/plans/ (plan-list, plan-panel, plan-editor, plan-on-sale-switch), src/lib/admin/plan-view.ts
  - The Member Plans page and checkout: src/app/app/(shell)/plans/** (including orders/), src/components/member-app/plans.tsx, plans-view.ts, plan-chooser.tsx, order-screens.tsx, order-poller.tsx, order-view.ts
  - Orders and the ledger: src/services/orders.core.ts, orders.rows.ts, src/lib/payments/order-ledger.ts (+ its tests), payment-methods.ts; the webhook route under src/app/api/paymongo/webhook and src/lib/paymongo/webhook.ts; the payments fake (src/services/payments.fake.ts, "Simulate paid")
  - Needs attention and the Orders filters: src/lib/admin/needs-attention.ts, src/lib/admin/orders-list.ts (e.g. the late=1 and noaccount=1 filters)
  - Screens that already show Orders: src/components/member-app/billing-screen.tsx, billing-view.ts; src/components/admin/orders/order-list.tsx, order-detail.tsx
  - Legal: src/content/legal/terms.ts, privacy.ts, documents.ts, schema.ts (+ tests); src/lib/member-app/consent.ts
  - The Orders table in src/lib/db/schema.ts (plan_id and days are NOT NULL today)
- **The Owner's switch** in Course settings: "Included in {Exam} All-Access" ↔ "Sold separately". Owners only; Editors see it read-only, and it's refused for them on the server.
  - The change takes effect at once, after a confirmation with the affected count:
    - Included → Sold separately: Members who watched it through their Access Pass (have Lesson progress in it, hold an active Access Pass for its Exam, and don't own it) lose it, progress kept.
    - Sold separately → Included: Course Ownerships stay; show how many Members with an active Access Pass for its Exam gain it.
  - Course settings shows the price read-only with a link to Plans & prices.
- **Plans & prices → One-time purchases** (Owner-only): each separately sold Course with its price (whole pesos, within the same limits as Plans) and On sale, logged in Staff Activity like Plans. Switching a Course to Sold separately adds it here, not on sale until an Owner sets the price and turns it on.
- **The Plans page:** a "One-time purchases" section for the selected Exam, listing its separately sold, Visible Courses on sale ("PSAD Masterclass · Video course only · yours to keep · ₱1,499").
  - An Exam with only a Course on sale still gets a pill.
  - "Unlock for ₱1,499" on the Courses screen opens that Exam's Plans page at the Course.
  - An owned Course shows "Owned · Watch", with no Pay button.
- **Paying for a Course:**
  - Same Payment Methods, PayMongo page and Pending screen as Plans (fake, test or live by the key).
  - Success: "You own it for good. It never expires."
  - An Order holds exactly one Plan or one Course (enforced in the database). A Course Order copies the Course's name and price at Pay and has no days.
  - Paying adds the Exam to the Member's Target Exams if it's missing.
  - Pay is refused on the server for an owned Course, a Hidden one, one not on sale, an included one, and with no PayMongo key.
- **The Order ledger:**
  - A paid Course Order (including Failed → Paid and Expired → Paid) grants Course Ownership with that Order as its source, logged as "PayMongo (system)".
  - A second Order for a Course the Member already owns that gets paid anyway is recorded Paid and grants nothing. Needs attention shows "Course already owned · refund in PayMongo", with a matching Orders filter.
  - Webhook events keep Phase 4's rules: signature checked, applied once, out of order handled.
- **Existing Order screens keep working for Course Orders:** Billing's history, the Pending and success screens, the Orders list and detail show the Course's name and no access period. (Ticket 07 adds Billing's "Your Courses", the Payment Acknowledgement's line, the Plans vs Courses filter and CSV column, and the sales figures.)
- **The delete guard:** a Course can't be deleted while anyone owns it or any Order names it. The button explains why and suggests hiding it.
- **Legal v2.2** (still marked pending legal review): the Terms' "Payments and refunds" adds that a Course is a one-time purchase with no expiry and that a refund removes it. Bump through the existing mechanism (bump the Privacy Policy too only if the mechanism requires matching versions), so each Member on v2.1 agrees once more. Use the domain terms; never "subscription".

SCOPE
Modify or add:
- src/lib/db/schema.ts: Orders hold a Plan or a Course (course reference, plan_id and days nullable, a check that exactly one is set and days match); `pnpm db:generate`; keep deny-all.db.test.ts passing
- src/lib/payments/order-ledger.ts (+ tests): Course grants and the already-owned case
- orders.core.ts and the Member seam: Pay for a Course, the Plans page's One-time purchases; src/services/member.course-orders.test.ts, added to MEMBER_SUITES in vitest.config.ts
- the Admin seam: the Owner's switch with counts, One-time purchases on Plans & prices, the delete guard, the Needs attention item and filter (+ the matching admin suites)
- the webhook route test with a signed Course Order fixture
- Course settings, Plans & prices, the Plans page, the Courses screen's Unlock and Owned links, and the existing Order screens (+ component tests)
- src/lib/admin/needs-attention.ts and orders-list.ts (+ tests)
- src/content/legal/terms.ts (and privacy.ts if needed) (+ tests); consent tests for the 2.1 → 2.2 re-prompt
- e2e: e2e/member-app/course-purchase.spec.ts, and extend e2e/admin/plans.spec.ts, on the in-memory sample data with the payments fake
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, refunds and gifts (ticket 07).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md, docs/adr/0013-video-on-vdocipher.md, and earlier Phase 5 tickets' uncommitted work if the user says so. Stop and report anything else.
   - `git switch feat/phase5-video`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that tickets 03 and 05 are present (Course Ownership and the access decision; docs/security-review.md). If either is missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), and the spec, notes and mockup sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, forms-validation, shadcn-ui, tailwind-v4, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the ledger (Seam 4): a paid Course Order grants Course Ownership; Failed → Paid and Expired → Paid grant too; a duplicate event grants once; a second paid Order for an owned Course grants nothing and is flagged; Plan Orders behave exactly as before.
5. TDD the seams over both arms: Pay for a Course and each refusal; the price fixed at Pay; the Target Exam added on Paid; the Owner's switch with both counts and Editors refused; One-time purchases; the delete guard; the Needs attention item and the Orders filter.
6. TDD the screens and Legal: Course settings, Plans & prices, the Plans page section and pills, "Owned · Watch", the Unlock link, the success copy, existing Order screens with a Course Order; v2.2 and the once-only re-prompt.
7. e2e:
   - Bea buys "PSAD Masterclass" from the Courses screen's "Unlock for ₱1,499" with the payments fake (Simulate paid), sees "You own it for good. It never expires.", then OWNED on the Courses screen, and plays a Lesson.
   - An Owner switches "HPGE Crash Course" to Sold separately (the confirmation shows the count), sets ₱1,299 and turns it on sale; it appears on the Plans page for CE.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Owner makes a Course sold separately with a price and On sale, and it appears in the Plans page's One-time purchases.
- Bea buys a Course with the payments fake, owns it, and watches it.
- Her Course Order shows in Billing's history and the Orders list with the Course's name.
- A Member on Legal v2.1 is asked to agree to v2.2 once.
Sad paths (each one needs a test):
- Pay is refused on the server for an owned Course, a Hidden one, one not on sale, an included one, and with no PayMongo key.
- The Order keeps the price shown at Pay after an Owner changes it.
- A second paid Order for an owned Course grants nothing and appears in Needs attention and the Orders filter.
- A duplicate paid event grants once; a bad signature changes nothing.
- An Editor can't switch how Members get a Course, or change its price or On sale (refused on the server).
- A Course someone owns, or that an Order names, can't be deleted.
- An Access Pass still never opens a separately sold Course.
- An Order can't hold both a Plan and a Course, or neither (database check).
- A Member who agreed to v2.2 isn't asked again.

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
- Inline "use server" handlers must be async.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.
- Known failures on HEAD (check they fail without your change too, and report rather than fix): the sharp beforeAll timeouts (page-images.sharp, reviewer-reader), products-list.spec:173, the e2e overview promo-banner spec, and the database-arm member.payments / member.billing suites on PGlite.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase5-video, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo, VdoCipher or Vercel, and never apply a migration to hosted. Webhook tests use signed fixtures and the fake.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Only Owners set how Members get a Course and its price; only a paid Order grants Course Ownership.
- This is draft legal copy: keep "pending legal review" and invent no refund rights beyond the brief.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the Orders shape, how the affected counts are computed, whether the Privacy Policy version moved) and follow-ups for ticket 07
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
