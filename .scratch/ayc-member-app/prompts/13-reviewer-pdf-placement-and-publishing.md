# Executer prompt — 13 Reviewer PDF placement, preview and publishing

Ticket: `.scratch/ayc-member-app/issues/13-reviewer-pdf-placement-and-publishing.md` · Blocked by: 12 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
An Editor places a Draft Reviewer PDF under an Exam, Subject and Topic, creating the Topic on the spot if needed. They preview it as Members will see it, then publish or unpublish it. Only Published Reviewer PDFs reach the Member App. Publishing is blocked until a Topic is chosen and the processing job has succeeded.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 3 → "Content model", "PDF processing"
  - "Phase 3 planning decisions (added 2026-11-17)" → "Topics editor", "The Reviewer PDF job"
  - Testing Decisions → "Phase 3 seams" → "Admin seam, extended"
  - Stories 116, 128 and 133o.
- Read CONTEXT.md (Reviewer PDF, Topic, Free Preview, Staff Role, Staff Activity), ADR 0010 (with its 2026-11-17 amendment), ADR 0012 and .scratch/ayc-admin/CONVENTIONS.md (the Staff Guard, sample, live and closed modes, Staff Activity, the conflict check).
- Earlier Phase 3 tickets created the concepts you build on. Find them in the code, and don't invent paths:
  - **Ticket 05:** the content tables (Topic, deck, quiz, Reviewer PDF record and status), the Topics editor and its rules (unique name within a Subject), the access decision, and the Library.
  - **Ticket 12:** Reviewer PDF upload, the processing job (Processing → Draft, or Failed), the page-images interface and its private storage, and the Admin's Reviewer PDFs list.
- **Statuses:**
  - Processing → Draft → Published ⇄ Unpublished
  - Processing → Failed
  - Publishing needs a Topic and a Draft or Unpublished upload whose job succeeded.
- **One Reviewer PDF per Topic.** Placing one on a Topic that already has one is refused, with a link to the existing one.
- **"+ New topic"** in the placement form creates a Topic in the chosen Subject using ticket 05's rules, without leaving the form.
- **"+ Add exam" and "+ Add subject"** reuse Phase 2's Owner-only forms (ticket 23: find exam-manage in src/components/admin/exam-pages/). Editors never see them, and the server refuses them.
- **The preview** is for Staff and reads Draft pages through the Admin. It uses the Member App's reader layout, page by page. Stamping with the Staff member's own details is the recommended way, if ticket 14's stamper exists. If it doesn't, show the pages through a Staff-only Admin route that is never publicly cacheable, and note it in the report. Never expose clean page URLs to the browser in a way that outlives the Staff session: no public or long-lived URLs.
- **Free Preview** is a switch per Reviewer PDF.
- **Every write** is recorded in Staff Activity (entity, action, before, after) using the existing pattern in src/services/admin*.ts, with the conflict check where two Editors edit at once.

SCOPE
Modify or add:
- the Admin seam (contract, sample-data arm, database arm) for placement, publish, unpublish, the Free Preview switch and creating a Topic from placement, with their tests
- the Admin Reviewer PDF screens (placement form, preview, status actions) and their component tests
- the Member App Library and reads, only so that Published-only applies, if ticket 05 didn't already enforce it
- a migration only if a column is missing (for example the placement or Free Preview), in the repo's existing style (supabase/migrations/ plus Drizzle in src/lib/db/schema.ts), with RLS on and no anon or authenticated policies
- e2e: extend the Admin Reviewer PDF spec on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Website, Payments.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0010-access-follows-the-exam.md. Stop and report anything else.
   - `git switch feat/phase3-member-app`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that tickets 05 and 12 are present (the content tables, the Topics editor, the upload and the job). If they're missing, stop and ask.
2. Read AGENTS.md, CONTEXT.md, .scratch/ayc-admin/CONVENTIONS.md, the ticket (every checkbox is part of your acceptance criteria), the spec sections above and the code from tickets 05 and 12.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices (only if you add a migration), forms-validation, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the status rules as a pure function: (status, has Topic, job outcome, action) → allowed or the reason.
5. TDD the Admin seam against both arms: placement, "+ New topic", one Reviewer PDF per Topic, publish, unpublish, Free Preview, Staff Activity and the conflict check.
6. TDD the screens: the pickers, "+ New topic", the preview, and the status buttons with their reasons.
7. Extend the e2e: place a Draft under a new Topic, preview it, publish it, and see it in the Member App Library as a Member with access. Then unpublish it and see it gone.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Editor places a Draft under Exam → Subject → a new Topic made with "+ New topic", previews it page by page, and publishes it. It appears in that Topic in the Member App Library.
- Unpublishing hides it from Members, and publishing again brings it back.
- The Free Preview switch makes it open to a Member with no Access Pass once Published.
- Each change has a Staff Activity record.
Sad paths (each one needs a test):
- Publishing without a Topic is refused in the UI (button disabled with the reason) and on the server (a direct post).
- Publishing a Processing or Failed upload is refused.
- Placing on a Topic that already has a Reviewer PDF is refused, with a link to the existing one.
- A duplicate "+ New topic" name in that Subject is refused.
- An Editor can't see or use the Owner-only "+ Add exam" or "+ Add subject". The server refuses their posts.
- A Member (non-Staff) posting any of these actions is refused.
- Draft and Unpublished Reviewer PDFs never appear in the Member App, even for Staff (ADR 0010 amendment: Staff see Visible or Published only).
- A stale edit hits the conflict check.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked, as the e2e server has them
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm test:e2e` (the Website and Admin projects on the in-memory sample data). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree while they run. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` before a full run.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase3-member-app, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project or Vercel, never change their data or settings, and never apply a migration to hosted.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. If you think you need one, stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Every Admin page calls the Staff Guard. Owner-only actions refuse Editors on the server. Every Member App read goes through the access decision.
- Clean page images and originals are never sent to Members, and Staff preview pages are never publicly cacheable.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (including how the preview shows pages) and follow-ups
6. any migration filename, with "Apply <migration> to hosted after merging (the user does this)", or "No migration"
7. the line "Nothing committed or pushed."
```
