# Executer prompt — 13 Legal v2.1: payments and refunds

Ticket: `.scratch/ayc-payments/issues/13-legal-payments-and-refunds.md` · Blocked by: none · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
The Terms of Use explain payments and refunds before anyone pays, and each Member agrees to them once through the existing re-consent. The Privacy Policy says payment records are kept as the tax rules require.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - "Phase 4 planning decisions (added 2026-11-24)" → "Legal v2.1", "Deleting an account that has Orders" (the Privacy Policy line)
  - Phase 3 → "Consent"
  - Story 151k
- Read:
  - CONTEXT.md: Order, Plan, Access Pass, Payment Acknowledgement
  - .scratch/ayc-payments/grilling-notes.md, decisions 13 and 14
- Existing pieces:
  - src/content/legal/terms.ts (TERMS_OF_USE_VERSION, currently 2.0, with a line saying the Member App doesn't take payments yet)
  - src/content/legal/privacy.ts and its version
  - src/content/legal/schema.ts, documents.ts, copy.ts, types.ts (+ tests)
  - src/lib/member-app/consent.ts (the version check that re-prompts)
  - the consent screen (src/components/member-app/consent-screen.tsx)
  - the Website legal pages (src/app/(website)/legal/[doc]/page.tsx + test)
  - e2e/legal.spec.ts and e2e/a11y.spec.ts
- **Legal v2.1** (still marked "pending legal review", like v2.0) adds a "Payments and refunds" section to the Terms of Use, with a stable anchor id (e.g. #payments-and-refunds):
  - Prices are in Philippine pesos, including VAT if the business is VAT-registered, and paid through PayMongo.
  - Access starts when payment is confirmed.
  - Buying while an Access Pass is active adds the new days to its current end.
  - Nothing renews automatically, and card details are never stored by us.
  - Refunds placeholder, for the client and the lawyer to change: "Ask Support within 7 days of payment. Refunds are at our discretion. A refund removes that Order's days."
  - Replace the old "doesn't take payments yet" line.
- **The Privacy Policy** (its version bumped too): payment records (Orders and Invoice Requests) are kept for as long as the tax rules require, even after an account is deleted, and the lawyer confirms the years.
- **The version bump:**
  - Bump both documents to 2.1 through the existing mechanism.
  - Each Member who agreed to 2.0 sees the consent screen once more on their next visit. One who agreed to 2.1 isn't asked again.
  - Change no consent logic unless a test proves it's needed.
- **The Plans page line:** "By paying you agree to the Terms of Use, including Payments and refunds." links to the new section.
  - If the Plans page (ticket 02) exists, link it there.
  - If it doesn't, export the section's href as a constant beside the legal content, and say in the report that ticket 02 should use it.
- Use the domain terms (Order, Plan, Access Pass, Payment Acknowledgement), and never "subscription".

SCOPE
Modify or add:
- src/content/legal/terms.ts, privacy.ts, and any copy/types they use (+ their tests)
- consent tests proving the 2.0 → 2.1 re-prompt (src/lib/member-app/consent.test.ts and/or the Member seam's consent suite)
- the Plans page line, if the page exists (+ test)
- e2e: extend e2e/legal.spec.ts (the section and v2.1 render), and the Member App consent journey (a Member on 2.0 is asked once)
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md, plus another Phase 4 ticket's uncommitted work if the user says so. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), and the spec sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the legal documents: v2.1, "pending legal review", the section, its anchor and the Privacy line, through the existing schema and document tests.
5. TDD the re-prompt:
   - a Member on 2.0 is asked
   - after agreeing to 2.1 they aren't
   - a Member who hasn't agreed can't reach any Member App screen (Plans included) until they do
6. Link the Plans line, if the page exists.
7. e2e: the Terms page shows the section and v2.1, both legal pages still pass the accessibility check, and a sample Member on 2.0 sees consent once and then Home.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- The Terms of Use show the "Payments and refunds" section and v2.1, marked pending legal review.
- A Member who agreed to v2.0 is asked to agree to v2.1 on their next visit, once.
- The Privacy Policy has the payment records line.
- The Plans page line links to the section (or the href is exported for ticket 02).
Sad paths (each one needs a test):
- A Member who agreed to v2.1 isn't asked again.
- A Member who hasn't agreed can't reach the Member App's screens (Plans included) until they do.
- The Website's legal pages still render and pass the accessibility check.
- The section's anchor resolves (the link target exists in the rendered page).

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables, SUPABASE_SECRET_KEY and any PAYMONGO_* variables blanked
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo or Vercel.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- This is draft legal copy. Keep "pending legal review", and don't invent retention years, refund rights or company details beyond the brief.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the anchor id, whether the Plans line was linked or the href exported) and follow-ups for the client and lawyer: the refund rule and the retention years
6. "No migration"
7. the line "Nothing committed or pushed."
```
