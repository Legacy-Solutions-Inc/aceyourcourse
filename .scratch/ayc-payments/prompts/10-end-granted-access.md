# Executer prompt — 10 "End granted access"

Ticket: `.scratch/ayc-payments/issues/10-end-granted-access.md` · Blocked by: 03 · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
An Owner's "End access now" on the Member detail page removes only the granted days not yet used. Paid days stay, because refunds handle those.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 3 → "Grants and ending access"
  - "Phase 4 planning decisions (added 2026-11-24)" → "'End access now' once paid days exist"
  - Testing Decisions → "Phase 4 seams" (Order ledger: the unused granted days, the 1 Jan / 10 Jan / 15 Jan example, a pass with no paid days, one with no granted days)
  - Story 151t
- Read:
  - CONTEXT.md: Access Pass, Order
  - .scratch/ayc-payments/grilling-notes.md, decision 7
- Existing pieces:
  - src/services/access-passes.core.ts: grant, extend and end, shared by both arms. Today "End access now" sets the end to now, refuses an already ended pass, writes a notice and Staff Activity, and keeps history rows as they were.
  - src/lib/member-app/access-pass.ts, src/services/admin.access-passes.db.ts, src/services/admin.access-passes.test.ts
  - src/components/admin/users/access-passes.tsx (+ test)
  - src/lib/member-app/notices.ts
- Ticket 03 recorded paid days as history rows in access_pass_grants, marked as paid. Rows without the mark are granted days (grants and extensions).
- Ticket 09, if present, added a pure segment model to the Order ledger. Reuse it. If it's absent, add it in the ledger yourself, so ticket 09 can reuse it.
- Find all of these in the code, and don't invent paths.
- **The rule:**
  - Days stack as consecutive segments. Each grant, extension and Paid Order adds its days at the then-current end, or at now if the pass had ended.
  - "End granted access" removes the granted days (grants and extensions) that fall after now. Later paid segments shift earlier by that much.
  - Paid days, used or not, stay.
  - A granted segment that's already used up removes nothing. A partly used one loses only the rest.
  - Example: granted 30 days on 1 Jan (to 31 Jan), bought 90 days on 10 Jan (to 1 May), ended on 15 Jan. 16 granted days are left, so access ends 15 Apr.
  - Handle passes already ended by the old "End access now", whose history rows still run past the end. Decide how removals are recorded (their own history entries, or updated starts_at/ends_at), and explain it in a code comment. If it needs a migration that rewrites existing rows, stop and ask first.
- **The button:**
  - No paid days left after now: "End access now", ending access now as before.
  - Paid days left: "End granted access", with the preview "Access will end on {date}. Paid days stay; refund in PayMongo to remove them." shown before confirming.
  - No granted days left after now: hidden.
  - It still needs a reason, is logged in Staff Activity with the before and after end dates, and sends the Member a notice. Use the ended notice when access ends now; otherwise a notice saying the new end, e.g. "Your {Exam} access now ends {date}".
- Dates show in Asia/Manila.

SCOPE
Modify or add:
- the ledger's segment model and an "unused granted days" function (+ tests)
- src/services/access-passes.core.ts and the database arm (+ src/services/admin.access-passes.test.ts over both arms)
- the Admin seam's Member detail read (whatever the panel needs: paid days left, granted days left, preview end)
- src/components/admin/users/access-passes.tsx (+ test)
- notices text if a new kind is needed (+ migration for the enum value); `pnpm db:generate`
- e2e: extend e2e/admin/users.spec.ts with a sample Member holding a grant and a paid Order
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, refunds (09).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 03 is present (Orders, and paid rows in the pass history). If it's missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), and the spec sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, forms-validation, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure functions:
   - the 1 Jan / 10 Jan / 15 Jan example → 15 Apr
   - grants only → ends now
   - paid only → no granted days, no button
   - an extension counts as granted
   - a grant before and a grant after a Paid Order both lose their unused days, and the paid days stay
   - a used-up grant removes nothing
   - an already ended pass
   - Manila midnight
5. TDD the Admin seam over both arms:
   - the right end written
   - Staff Activity before and after
   - the notice
   - an Editor refused
   - an empty reason refused
6. TDD the panel: label, preview and hidden states.
7. e2e: an Owner opens a sample Member with a grant and a paid Order, sees "End granted access" and the preview date, confirms with a reason, and sees the new end.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- The 1 Jan / 10 Jan / 15 Jan example ends on 15 Apr, and the preview says so before confirming.
- A pass made only of grants ends now, as before ("End access now").
- A pass made only of paid days has no button.
- The change is in Staff Activity with the reason and the before and after ends, and the Member gets a notice.
Sad paths (each one needs a test):
- An Editor is refused on the server, and doesn't see the panel.
- An empty or whitespace-only reason is refused.
- A grant already used up removes nothing.
- An extension counts as granted days.
- A grant before and a grant after a Paid Order both lose their unused days, and the paid days stay.
- Ending a pass that has already expired is handled without changing the end or logging noise.
- Dates are right across Manila midnight.

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
- Never connect to the hosted Supabase project, PayMongo or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Only Owners end access.
- Paid days are never removed here. Only refunds remove them.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the segment model, where it lives, how removals are recorded, the notice wording) and follow-ups
6. "No migration", or the migration filename(s) with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
