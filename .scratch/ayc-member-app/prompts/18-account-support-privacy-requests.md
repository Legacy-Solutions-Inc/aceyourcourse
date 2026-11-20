# Executer prompt — 18 Account, Support and Members' privacy requests

Ticket: `.scratch/ayc-member-app/issues/18-account-support-privacy-requests.md` · Blocked by: 03 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
The Member App gets its Account page and a Support page.
- **Account:** the profile, Target Exams, the date and version of what the Member agreed to, "Request a copy of my data", "Delete my account" behind a clear warning, and Sign out.
- **Support:** the contact email and common questions.
Each request creates a Privacy Request, which Owners see in an Admin list. Ticket 19 carries them out.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 3 → "Privacy Requests" (a copy within 7 days, deletion within 30; deletion revokes Access Passes with no refund), "Consent"
  - "Phase 3 planning decisions (added 2026-11-17)" → "Privacy Requests in the Admin" (the fulfilment part is ticket 19)
  - Testing Decisions → "Phase 3 seams" → "Member seam"
  - Stories 110–113.
- Read CONTEXT.md (Member, Target Exam, Staff Role) and docs/mockup/member-app/BUILD-MAP.md §3 "Account (L595–633)" and "Support (L479–492)".
- Earlier Phase 3 tickets created the concepts you build on. Find them in the code, and don't invent paths:
  - the Member record, the gate and sign-out (01)
  - consent records with their versions and date (02)
  - Target Exams, and the simple Account page with its Target Exams section, including removal (03)
  - the Active Device check (04), if present
  - the Member seam (sample and database arms)
  - the Owner-only Users screen (01) as the place for the Admin list. If ticket 16's Users list exists, add a "Privacy Requests" tab or section beside it.
- **The contact email** is the Owner Setting from Phase 2. Find it in the Settings code (src/services/admin*.ts and the catalogue settings). Don't hard-code it.
- **Common questions** are developer-maintained text, the same pattern the Website uses for fixed copy.
- **A data copy request:** creates a Privacy Request (type data copy, status open, due in 7 days) and tells the Member "AYC will email your data to {email} within 7 days". A repeat request while one is open shows the open one and creates nothing.
- **A deletion request:**
  - a warning: removed within 30 days; paid access isn't refunded; progress is lost
  - a typed confirmation (for example typing DELETE)
  - creates a Privacy Request (type deletion, status open, due in 30 days)
  - the Member stays signed in, and Account shows "Deletion requested on {date}"
  - a repeat while one is open creates nothing
- **The Admin list** (Owner only): type, Member, requested date, due date, status, and overdue flagged, with no fulfilment buttons yet.
- **Sign out** ends the Supabase session and returns to the sign-in screen.

SCOPE
Modify or add:
- the Member seam (both arms) for the Account read and creating Privacy Requests, with tests
- the Admin seam (both arms) for listing Privacy Requests, with tests
- the Account and Support screens (extending ticket 03's Account page) and the Admin list, with component tests
- a migration for Privacy Requests, in the repo's style, with RLS on and no anon or authenticated policies
- e2e: extend the Member App and Admin specs on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, Payments, ticket 19's fulfilment.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0010-access-follows-the-exam.md. Stop and report anything else.
   - `git switch feat/phase3-member-app`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 03 is present. If it's missing, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), and the spec and mockup sections above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, forms-validation, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the due dates (7 and 30 days, Asia/Manila; src/lib/manila-time.ts) and the overdue flag as pure functions.
5. TDD the Member seam: create each type, one open request per type, never another Member's.
6. TDD the Admin list seam: Owner only, ordered by due date, overdue flagged.
7. TDD the screens: Account details, the agreement line, the warning and typed confirmation, the pending states, and Support.
8. Extend the e2e: a sample Member requests a data copy and a deletion, sees both pending, and an Owner sees both listed. An Editor is refused the list.
9. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- A Member sees their profile, Target Exams, and "You agreed to Terms v{x} and Privacy v{y} on {date}".
- They request a data copy, and it shows as pending. Owners see it listed with its due date.
- They request deletion after the warning and typed confirmation. Account shows it pending, and Owners see it listed.
- Support shows the contact email from Settings and the common questions.
- Sign out returns to the sign-in screen.
Sad paths (each one needs a test):
- A second open request of the same type isn't created.
- Deletion without the right typed confirmation is refused on the server.
- One Member can't see or create requests for another (forged IDs are ignored; the Member comes from the session).
- An Editor can't see the Admin list. A non-Staff Member can't reach it.
- A gated person, or a Member who hasn't agreed to the Terms, can't create a request.
- An overdue request is flagged right across Asia/Manila midnight.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked, as the e2e server has them
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm test:e2e` (the in-memory sample data). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree while they run. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase3-member-app, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project or Vercel, and never apply a migration to hosted.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. The Member comes from the session, never from form fields. Owner-only views refuse Editors on the server.
- No email is sent automatically.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (where the Admin list lives, the typed confirmation word) and follow-ups
6. the migration filename(s), with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
