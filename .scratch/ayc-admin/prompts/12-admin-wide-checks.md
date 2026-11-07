# Executer prompt — 12 Admin-wide checks on the prototype

Ticket: `.scratch/ayc-admin/issues/12-admin-wide-checks.md` · Blocked by: 03, 04, 05, 06, 07, 08, 09, 10, 11 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Prove the whole Stage A Admin holds together before any database work:
- permissions are enforced on the server for every action
- every write is recorded in Staff Activity
- every screen passes axe on desktop and mobile, with no sideways scroll
- the Admin journey works from end to end
- a production build keeps the Admin closed
- the README explains the prototype

Fix the in-scope bugs these checks find.

CONTEXT
- Already on docs/ayc-v1-planning: every Stage A ticket, 01–11.
- The Admin Server Actions are in src/app/admin/(shell)/*/actions.ts and src/app/admin/sign-in/. The seam writes are in src/services/mock/admin/*.ts.
- The permission matrix:
  - Collect every exported Admin Server Action into one registry, with its role ("staff" or "owner").
  - The test imports every actions module, and fails when an exported action is missing from the registry.
  - Call each action as: signed out; not Staff; an Editor (for Owner-only actions); and with the mode forced to closed.
  - Each must be refused with nothing changed in the store.
- The Staff Activity coverage test: for each seam write, a successful call appends exactly one record per entity changed (with before and after), and a refused or failed call appends none.
- Axe covers every screen and state at 1280 × 800 and 375 × 812:
  - sign-in and 403 (each reason)
  - Overview
  - each Exam pages & promo view
  - the Products list, editor and delete dialog
  - Reviews with its editor, and FAQs with its editor
  - Settings, with the add-invite modal
  - the open drawer
  - Serious and critical issues fail.
- Sideways scroll: on each screen at 375 px, document.scrollingElement.scrollWidth <= innerWidth.
- Production build check:
  - Build, then run `next start` on a free port (in a scratchpad copy if :3000 is in use).
  - Expect 404 from /admin, /admin/sign-in and /admin/products, from POST /api/dev/sample-data/reset, and from GET /api/dev/uploads/x.
  - Stop the server you started, by PID.

SCOPE
Create:
- src/app/admin/action-registry.ts, or a test-only registry if that is cleaner, plus src/app/admin/actions.permissions.test.ts.
- src/services/admin.activity-coverage.test.ts.
- e2e/admin/a11y.spec.ts: every screen, both sizes.
- e2e/admin/journey.spec.ts.
- A README "Admin prototype" section covering how to run it, the Sign-in-as Users, Reset, the restart reset, and that production keeps the Admin closed until Stage B.

Modify: only what a failing check needs, within Phase 2's scope.

Leave untouched: Phase 1 behaviour.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if tickets 03 to 11 is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/12-admin-wide-checks.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 decisions (Staff Role permissions, Staff Activity, Two stages); Testing Decisions (Permission and deny-all tests, Admin seam, Seam 5 Admin)
   - every Phase 2 ticket in .scratch/ayc-admin/issues/ 01–11, to know what each screen must do
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, playwright-expert, secure-code-guardian.
4. Write the permission matrix and the registry check first. Run them, and fix any action that isn't refused.
5. Write the Staff Activity coverage test, and fix any write that records the wrong number of entries.
6. Write the axe and sideways-scroll sweep. Fix serious and critical findings in Admin components.
7. Write the journey e2e:
   - an Editor changes a Product price, and the Website shows it
   - the Editor is refused Settings
   - an invited email activates
   - a non-Staff User gets the 403 screen
   - Reset restores the seed
   Confirm the Website project still passes after the admin project runs.
8. Run the production build check, and write the README section.
9. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- The registry lists every exported Admin Server Action. The matrix passes, with every refusal leaving the store byte-for-byte unchanged.
- Every seam write appends exactly one Staff Activity record per entity changed, with before and after.
- Axe reports no serious or critical issues on every listed screen at both sizes, and no screen scrolls sideways at 375 px.
- The journey e2e passes, and the Website e2e suite passes in the same run.
- The production server answers 404 on every Admin and dev-only route.
- The README's Admin prototype section lets a new developer sign in as each sample User and reset the data.
Sad paths (each one needs a test):
- Adding an exported action without a registry entry fails the registry test. Show this by reasoning, or with a temporary change you revert.
- An Editor calling each Owner-only action is refused, and so is a signed-out caller for every action.
- With the mode forced to closed, every action is refused.
- A failed write (forced validation error) appends no Staff Activity.
- Keyboard only: Tab reaches every control on Products and Settings, and focus is visible on each.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage` (the thresholds in vitest.config.ts must still pass; don't lower them)
- `pnpm test:e2e` (the Website and admin projects)
- Show the production build check's output (each route and its status), and the number of actions in the registry.
All must pass. Follow verification-before-completion.
Repo gotchas:
- `pnpm build` breaks a dev server running on :3000. If :3000 answers 200, run e2e against it (PLAYWRIGHT_PORT=3000), and run the build in a scratchpad copy: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in (Turbopack refuses a symlinked node_modules).
- Never kill the user's server.
- Another executer may share the working tree. Verify your own diff, and report the shared-tree results separately.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/. Don't edit CONTEXT.md unless this prompt says so.
- Use the names in .scratch/ayc-admin/CONVENTIONS.md. If the code already differs (an earlier ticket chose otherwise), follow the code and say so in your report.
- Add no dependency unless this prompt names it. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo beyond the mockup samples in CONVENTIONS §5.
- Every Admin page and Server Action calls the Staff Guard. Authorisation never comes from the client, from hidden fields, or from user metadata.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. mockup deviations (with the BUILD-MAP or mockup line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
