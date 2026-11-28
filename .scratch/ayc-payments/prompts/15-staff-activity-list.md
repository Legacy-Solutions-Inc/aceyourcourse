# Executer prompt — 15 Staff Activity list for Owners

Ticket: `.scratch/ayc-payments/issues/15-staff-activity-list.md` · Blocked by: none · Branch: `feat/phase4-payments` (shared by every Phase 4 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Owners can read Staff Activity in the Admin: who changed what and when, including the automatic "PayMongo (system)" entries. It's read-only.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 4 → "Orders Admin" (the Staff Activity list for Owners)
  - Testing Decisions → "Phase 4 seams" (Admin seam: the Staff Activity list)
- Read:
  - CONTEXT.md: Staff Activity, Staff Role, Staff
  - .scratch/ayc-admin/CONVENTIONS.md (Staff Activity)
- Existing pieces:
  - the staff_activity table in src/lib/db/schema.ts (id, seq, at, actor_email, actor_name, entity, entity_id, action, before, after)
  - src/services/admin.types.ts (StaffActivity)
  - src/services/content-editor.core.ts (activityRecord)
  - src/services/admin.activity-coverage.test.ts
  - src/lib/db/row-diff.ts (+ test), which may already summarise before/after
  - Settings: src/app/admin/(shell)/settings/page.tsx (requireOwner)
  - src/components/admin/use-url-search.ts
  - src/lib/manila-time.ts (formatDateTime)
- If ticket 03 is present, it added a "PayMongo (system)" actor constant (actor_email marker such as "system:paymongo"). Find it, and don't invent it. If it's absent, the list still works. Show the system name for whatever marker exists, and leave a note for ticket 03.
- **Where:** a read-only "Staff Activity" screen under Settings (e.g. /admin/settings/activity), with its own link on the Settings screen. Settings is already Owner-only.
- **The list:**
  - Newest first. Each entry shows:
    - when (Manila time)
    - who: the Staff name and email as recorded, or "PayMongo (system)" for the system actor
    - the area: a readable label mapped from the entity, e.g. Products, Exam pages, Users, Plans, Orders; unknown entities fall back to the raw name
    - what changed: the action, plus a short summary of the fields that changed between before and after, from the recorded details
- **Paging:**
  - Keyset by seq, with the cursor in the URL. Never use offset.
  - New entries arriving while an Owner pages never repeat or skip one.
  - 50 per page.
- **Filters** in the URL:
  - by Staff member: actors who appear in Staff Activity, including removed Staff and "PayMongo (system)"
  - by area
- Empty: "No activity".
- Nothing can be edited or deleted. There are no write actions.
- Values in before/after can include personal data, so the screen is for Owners only, enforced on the server.

SCOPE
Modify or add:
- the Admin seam (admin.types.ts, admin.ts, admin.mock.ts, admin.db.ts): list with filters and cursor, and the actor and area options
- src/services/admin.staff-activity.test.ts (runs over both arms through the glob)
- a pure view module, e.g. src/lib/admin/staff-activity-view.ts (+ test): area labels, the change summary, the system actor name
- src/app/admin/(shell)/settings/activity/page.tsx; components under src/components/admin/settings/ (+ component tests); the link on the Settings screen; src/paths.ts
- e2e: extend e2e/admin/settings.spec.ts on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the staff_activity table's shape (unless an index for actor or seq paging is needed; add it with `pnpm db:generate` and say so).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md and docs/specs/2026-10-29-ayc-v1.md, plus another Phase 4 ticket's uncommitted work if the user says so. Stop and report anything else.
   - `git switch feat/phase4-payments`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, CONVENTIONS.md, the ticket (every checkbox is part of your acceptance criteria), and the spec sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, data-tables, shadcn-ui, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure view: area labels and fallback, the change summary (added, removed, changed fields; nothing for identical values), the system actor's name, Manila times.
5. TDD the Admin seam over both arms:
   - newest first
   - filter by actor and by area
   - keyset paging that neither repeats nor skips when entries are added between pages
   - an Editor refused
   - empty results
6. TDD the screen and the Settings link.
7. e2e: an Owner makes a change (e.g. saves the contact email), opens Settings → Staff Activity, sees it at the top, and filters by their own name. An Editor is refused /admin/settings/activity.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Owner sees the latest Staff Activity entries, newest first, and filters them by a Staff member.
- Filtering by area shows only that area's entries.
- System entries from PayMongo show as "PayMongo (system)" once payments exist (tested with a fixture entry using the system marker).
Sad paths (each one needs a test):
- An Editor is refused the screen and its data on the server.
- An empty filter result shows "No activity".
- Paging never repeats or skips an entry when new entries arrive.
- Times are right in Manila time.
- A tampered cursor or unknown filter value is handled (first page or empty), never a crash.
- There's no way to edit or delete an entry: no actions, and the seam exposes no write.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables, SUPABASE_SECRET_KEY and any PAYMONGO_* variables blanked
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.
- A new route can leave stale .next/types. Run `pnpm exec next typegen`.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase4-payments, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo or Vercel, and never apply a migration to hosted.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Only Owners read Staff Activity, and nothing writes to it from this screen.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the area map, the cursor shape, the system actor marker found or assumed) and follow-ups
6. "No migration", or the migration filename(s) with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
