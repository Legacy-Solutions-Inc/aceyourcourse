# Executer prompt — 02 The Member's Plans page

Ticket: `.scratch/ayc-payments/issues/02-member-plans-page.md` · Blocked by: 01 · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
The Member App's Plans screen (/app/plans, today a "Coming in the beta" placeholder) shows what's on sale for each Exam, with the exact date access would end. Buying arrives in ticket 03. In this ticket the button is "Buying opens soon", disabled. Every "unlock" entry point in the app and on the Website leads here instead of to the beta note.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - "Phase 4 planning decisions (added 2026-11-24)" → "Who buys, and which Exams", "The key decides; no new switch", "Renewal reminders" (Plan rows)
  - Testing Decisions → "Phase 4 seams" (Member seam, extended)
  - Stories 134, 151c, 151e and 151m
- Read:
  - CONTEXT.md: Plan, Access Pass, Target Exam, Exam Date, Official Exam Date, Payment Method, Staff
  - ADR 0010
  - .scratch/ayc-payments/grilling-notes.md, decisions 3, 4, 5 and 12
  - docs/mockup/member-app/BUILD-MAP.md §3 "Plans (L412–450, L838–847)"
- Ticket 01 added the Plans table, the sample-data Plans and the Admin seam's Plans. Find them in the code, and don't invent paths.
- Existing pieces you build on:
  - src/app/app/(shell)/[screen]/page.tsx: the placeholder that serves Courses, Plans and Billing. Give Plans its own folder, which takes the address over, and keep the placeholder for the others.
  - src/components/member-app/member-menu.ts
  - src/lib/member-app/guard.ts (requireMemberWithExam)
  - src/lib/member-app/access-pass.ts (passWithDays: max(current end, now) + days, the same arithmetic a grant uses)
  - src/lib/member-app/exam-date.ts
  - src/lib/manila-time.ts
  - src/lib/money.ts
  - src/components/member-app/content-state.tsx (BetaAccessNote, "Unlock with {exam} All-Access", "Your access ended")
  - src/components/member-app/library.tsx (locked Topics)
  - src/components/website/exam/try-a-card.tsx ("See {code} app plans")
  - src/lib/member-app/safe-next.ts (the sign-in `next`)
- **The page:**
  - Who sees it: the existing Member App guard (signed in, consented, at least one Target Exam). The beta gate still decides who gets in.
  - Exam pills:
    - One per Exam with at least one Plan on sale.
    - The Member's Target Exams come first, and the page opens on their current Exam.
    - `?exam=CE` (an Exam code) picks a pill. An unknown or not-on-sale code falls back to the current Exam.
    - Exams with nothing on sale have no pill.
  - Header: "PLANS / Choose your access / Pay once for a fixed period. Nothing renews automatically." and "{EXAM} ALL-ACCESS · FLASHCARDS, QUIZZES, REVIEWERS".
  - Plan rows (a radio group):
    - Each row shows the duration label, the price and BEST VALUE.
    - "Until {date}" = max(current Access Pass end, now) + the Plan's days, shown as a Manila date.
    - A row whose end reaches the Member's Exam Date (on or after it) adds "covers your exam on {date}".
  - Order summary and Payment Method choice (QR Ph, GCash, Maya, Card), as laid out in the mockup.
  - The lines "You'll finish payment on PayMongo's secure page. We never see or store your card details." and "By paying you agree to the Terms of Use, including Payments and refunds." The second line links to the Terms' Payments and refunds section if ticket 13 has added it. Otherwise link to the Terms of Use and say so in the report.
  - The button: "Buying opens soon", disabled. Ticket 03 turns it into "Pay {price} with PayMongo" where a payments client exists.
  - Staff see the page with the note "As Staff you already open all content."
- **"See plans" entry points** replace today's beta note wherever the Exam has a Plan on sale:
  - Locked content: "Unlock with CE All-Access" → /app/plans?exam=CE.
  - Ended access: "Renew access" → /app/plans?exam=CE.
  - The dashboard: if it has locked or "Not in your plan · Unlock" tiles, link them the same way. The current dashboard may have none, so don't build new tiles. Report what you found.
  - The Website Exam page: "See {EXAM} plans" goes through sign-in and returns to /app/plans?exam={EXAM}. Make sure the query survives the sign-in `next`.
  - Exams with nothing on sale keep today's "contact us" note.
- Reads go through the Member seam (both arms). Add a Plans read that returns, for the signed-in Member, the on-sale Plans per Exam, their Access Pass ends and their Exam Dates. Never trust an Exam or Plan id from the URL without checking it's on sale.

SCOPE
Modify or add:
- src/services/member.types.ts, src/services/member.ts, src/services/member.mock.ts, src/services/member.db.ts: the Plans read
- src/services/member.plans.test.ts, and add it to MEMBER_SUITES in vitest.config.ts
- a pure view module, e.g. src/components/member-app/plans-view.ts (+ test): pill order, fallback, "Until" and "covers your exam"
- src/app/app/(shell)/plans/page.tsx; components such as src/components/member-app/plans.tsx (+ component test)
- src/paths.ts: a helper for Plans for an Exam, e.g. paths.memberApp.plansFor("CE")
- content-state.tsx, library.tsx, the dashboard (only if it has locked tiles), try-a-card.tsx and their tests
- src/components/member-app/member-menu.ts comments, and the [screen] placeholder's comment (Plans no longer goes through it)
- e2e: e2e/member-app/plans.spec.ts on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, Orders, and payments (ticket 03).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 01 is present (the Plans table and the Admin "Plans & prices" screen). If it's missing, stop and ask.
   - Check `ps` for another executer's Vitest, Playwright or next processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), and the spec and mockup sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, forms-validation, shadcn-ui, tailwind-v4, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure view:
   - pill order (Target Exams first, nothing-on-sale hidden)
   - the `?exam=` fallback
   - "Until" from an active pass, an expired pass and no pass
   - "covers your exam" on or after the Exam Date
   - Manila midnight
5. TDD the Member seam's Plans read over both arms:
   - switched-off Plans hidden
   - another Member's pass never used
6. TDD the page and components, then the entry points and the Website sign-in round trip.
7. e2e:
   - A sample Member with CE opens Plans on CE, sees each CE Plan with an "Until" date, and a disabled "Buying opens soon".
   - Locked CE content's "See plans" opens Plans on CE.
   - An Owner switches a CE Plan off in the Admin, and it disappears from the Member's Plans page.
8. Run `pnpm exec next typegen` after adding the route. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- A Member with CE as their Target Exam opens Plans on CE and sees each CE Plan with its "Until" date.
- A Member with 20 days left on CE sees each "Until" date counting those 20 days.
- A Member with an Exam Date sees "covers your exam on {date}" on the Plans that reach it, and not on the others.
- Locked CE content's "See plans" opens Plans on CE. Ended access's "Renew access" does the same.
- The Website Exam page's "See CE plans" ends on /app/plans?exam=CE after sign-in.
Sad paths (each one needs a test):
- An Exam with no Plan on sale has no pill, and its locked content keeps the "contact us" note.
- `?exam=` with an unknown or not-on-sale Exam falls back to the Member's current Exam.
- A Plan switched off disappears from the page.
- Someone the beta gate doesn't let in never reaches the page. Someone not consented goes to consent first.
- An "Until" date near midnight is right in Manila time.
- The button is disabled and reads "Buying opens soon".
- Staff see the Staff note.
- A `next` that isn't an /app path is still refused by sign-in (the new query doesn't open a redirect).

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
- A new or moved route can leave stale .next/types that fail type:check. Run `pnpm exec next typegen`.
- A new src/services/member.*.test.ts must be added to MEMBER_SUITES in vitest.config.ts.
- Inline "use server" handlers must be async.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. The page reads only the signed-in Member's passes and Exam Dates.
- No buying in this ticket: no Orders table and no payments code.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the Plans read's shape, what the dashboard had, the Terms link) and follow-ups
6. "No migration", or the migration filename(s) with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
