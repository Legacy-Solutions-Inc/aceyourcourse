# Executer prompt — 19 Privacy Request fulfilment in the Admin

Ticket: `.scratch/ayc-member-app/issues/19-privacy-request-fulfilment.md` · Blocked by: 16, 18 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript, Postgres and Supabase Auth engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Owners carry out Privacy Requests from the Admin. For a data copy, they download a Member's data as a JSON file and email it themselves. For a deletion, they delete the account behind a typed confirmation. They mark each request done. Staff and the last Owner can't be deleted, and Staff Activity never keeps a deleted Member's personal data.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 3 → "Privacy Requests"
  - "Phase 3 planning decisions (added 2026-11-17)" → "Privacy Requests in the Admin" (the export contents, the deletion, the staff and last-Owner guards, "Mark done", nothing emailed)
  - Testing Decisions → "Phase 3 seams" → "Admin seam, extended"
  - Stories 133, 133q and 133r.
- Read CONTEXT.md (Member, User, Staff, Staff Role, Staff Activity, Access Pass), ADR 0008 and .scratch/ayc-admin/CONVENTIONS.md.
- Earlier Phase 3 tickets created the concepts you build on. Find them in the code, and don't invent paths:
  - the Privacy Request records and the Owner-only Admin list (18)
  - the Users screen and Member detail (16)
  - Member records (01)
  - consents (02)
  - Target Exams (03)
  - the Active Device and its switch log (04)
  - Access Passes and their history (05)
  - progress records: Card Marks, Quiz Attempts, Reviewer pages viewed, Study Days, and resume state (08, 11, 14)
  - notices (17), if present
- Existing code to follow:
  - **Last-Owner guard:** the Staff rules in src/services/admin.ts, admin.mock.ts and admin.db.ts already refuse removing the last Owner (the comment near "last Owner, or the actor's own access"). Reuse that rule. Don't write a second one.
  - **Staff list helpers:** src/lib/admin/staff-rows.ts.
  - **Staff Activity:** staffActivity in src/lib/db/schema.ts (actorEmail, actorName, entity, entityId, action, before, after).
  - **Secret-key client:** src/lib/supabase/admin.ts builds a server-only client from SUPABASE_SECRET_KEY (today it's used for Storage). Deleting the Supabase user uses that server-only secret-key client, behind a small "auth admin" interface with a fake for tests. Never use a NEXT_PUBLIC_ key. src/env.server.ts holds the secret.
- **Data copy:**
  - "Download this Member's data" returns a JSON file with these sections: profile, Target Exams (including removed ones), consents, Access Passes and their grant history, Card Marks, Quiz Attempts, Reviewer pages viewed, Study Days, resume state, device log, and notices if present
  - it's served as an attachment with `Cache-Control: no-store`, to Owners only
  - each download is logged in Staff Activity (entity Privacy Request, action exported)
  - the Owner emails the file from the support inbox. Nothing is sent by the app.
- **Deletion:**
  - "Delete this account" asks the Owner to type the Member's email to confirm
  - it deletes all their Member data and the Supabase user in a safe order: delete the app data in one transaction, then the Supabase user. If the Supabase call fails, report the error and leave the request open, so it can be retried and safely deleted again.
  - Access Passes are revoked with no refund
  - Staff Activity records entity Privacy Request, action account-deleted, with only the request ID and an opaque Member ID, never the email or name
  - the Privacy Request keeps its type, dates and status, but drops the email and name once deleted
- **Guards:** deleting is refused while the email is an active Staff User or a pending Invite ("Remove them from Staff first"). Removed Staff can be deleted. The last Owner can never be deleted.
- **Mark done:** either type, with the date and by whom. Overdue requests (past 7 or 30 days) are flagged in the list (ticket 18 may already do this).

SCOPE
Modify or add:
- the Admin seam (both arms) for export, delete and mark done, with tests
- an auth-admin interface (a real Supabase secret-key client plus a fake) and its tests
- the Privacy Request detail and actions in the Admin, with component tests
- a migration only if a column is missing (for example the done-by or a nullable email), in the repo's style, with RLS on and no anon or authenticated policies
- e2e: extend the Admin spec on the in-memory sample data, with the fake auth admin
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Member App screens, Payments.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0010-access-follows-the-exam.md. Stop and report anything else.
   - `git switch feat/phase3-member-app`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that tickets 16 and 18 are present. If they're missing, stop and ask.
2. Read AGENTS.md, CONTEXT.md, CONVENTIONS.md, the ticket (every checkbox is part of your acceptance criteria), the spec sections above and the Staff rules in the Admin seam.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, supabase-auth, secure-code-guardian, forms-validation, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the export builder as a pure function over a fixture Member: every section is present, empty sections are empty arrays, and another Member's rows are never included.
5. TDD the delete guards: on the staff list, the last Owner, and a wrong typed confirmation.
6. TDD delete against both arms with the fake auth admin: all rows gone, the Staff Activity record has no personal data, the request keeps its dates, and a Supabase failure leaves the request open and the retry is safe.
7. TDD mark done and the overdue flag, and the screens.
8. Extend the e2e: an Owner downloads a sample Member's data (check the file's sections), deletes another sample Member after typing their email, and marks both done. An Editor is refused.
9. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Owner downloads a Member's data, and the JSON has every section.
- An Owner deletes an account after typing the email. The Member's data and Supabase user are gone, the request shows done, and signing in again with that Google account starts as a brand-new Member.
- Overdue requests are flagged. "Mark done" records the date and who did it.
Sad paths (each one needs a test):
- Deleting someone on the staff list (active or invited) is refused with "Remove them from Staff first".
- Deleting the last Owner is refused.
- A wrong or empty typed confirmation is refused on the server.
- An Editor is refused export, delete and mark done on the server, and a non-Staff Member can't reach them.
- The Staff Activity record for a deletion contains no email or name. The export download is logged.
- The export never includes another Member's data, and is served with `no-store`.
- A Supabase user deletion failure leaves the request open, with no half-deleted state reported as done. Retrying completes it.
- A request for an already deleted Member is handled ("Already deleted"), with no crash.
- The secret key never reaches the client bundle: it's read only in server code (show a grep of src/ in the report).

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked, as the e2e server has them
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm test:e2e` (the in-memory sample data, with the fake auth admin). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
- the grep showing SUPABASE_SECRET_KEY is read only in server code
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree while they run. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase3-member-app, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project or Vercel. Never delete a real user, never change Auth settings, and never apply a migration to hosted. Tests use the fake auth admin, and database tests run in CI against a local Supabase only.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Owner-only actions refuse Editors on the server. The secret key is server-only, never NEXT_PUBLIC_.
- Staff Activity never stores a deleted Member's personal data.
- No email is sent automatically.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command, and the grep
5. the decisions you made (the deletion order, what the request keeps after deletion, which staff statuses block deletion) and follow-ups
6. any migration filename, with "Apply <migration> to hosted after merging (the user does this)", or "No migration"
7. the line "Nothing committed or pushed."
```
