# Executer prompt — 12 Reviewer PDF upload and the processing job

Ticket: `.scratch/ayc-member-app/issues/12-reviewer-pdf-upload-and-job.md` · Blocked by: 05 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Supabase engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
An Editor uploads a Reviewer PDF of up to 200 MB from the Admin and can leave the page. A background job splits it into page images in batches. The Admin shows the progress, and the upload ends as a Draft or as Failed, with a reason and the fix to try. Placing, previewing and publishing are ticket 13.

CONTEXT
- Read first:
  - AGENTS.md and CONTEXT.md (Exam, Subject, Topic, Member, Staff, Access Pass, Free Preview, Card Mark, Best Score, Study Day, Active Device)
  - .scratch/ayc-admin/CONVENTIONS.md (the Staff Guard; sample, live and closed modes; Staff Activity; the conflict check)
  - the ticket: every checkbox is part of your acceptance criteria
  - docs/specs/2026-10-29-ayc-v1.md, Phase 3: the decisions, especially "Phase 3 planning decisions (added 2026-11-17)", and the "Phase 3 seams" block in Testing Decisions
  - ADR 0010 (with its 2026-11-17 amendment), ADR 0011 and ADR 0012
  - docs/mockup/member-app/BUILD-MAP.md (the screens named below)
- Earlier Phase 3 tickets built these. Find them in the code; don't invent paths and don't rebuild them:
  - the Member App shell and the beta gate (01)
  - consent (02)
  - Target Exams (03)
  - the Active Device check (04)
  - the content tables, the Access Pass record, the pure access decision and the Member seam, plus the Admin's Member App content area and the Topics editor (05)
  - the pure import planner and the shared formula renderer (06)
- Existing patterns to copy:
  - the Admin seam: src/services/admin.ts, admin.types.ts, admin.mock.ts, admin.db.ts, admin.schema.ts, with its per-area behaviour suites (src/services/admin.*.test.ts) and src/services/admin.db.test.ts
  - Admin forms: src/lib/admin/*-form.ts (for example faq-form.ts, review-form.ts)
  - the conflict check: record_stamps in src/lib/db/schema.ts
  - private uploads: the upload seam, src/services/uploads.ts, uploads.types.ts, uploads.storage.ts and uploads.mock.ts. A Staff-checked action hands the browser a one-time signed upload URL, the browser PUTs the file, and the save records the path.
- Migrations:
  - new tables go in a new file in supabase/migrations/ in the repo's existing style, generated from src/lib/db/schema.ts with `pnpm db:generate`
  - RLS on, and no anon or authenticated policies, like every other table
  - database tests run in CI only, and you never apply a migration to the hosted project
- Spec: Phase 3 → "PDF processing", and "The Reviewer PDF job" in "Phase 3 planning decisions (added 2026-11-17)". ADR 0012 (Vercel background functions, job status in Postgres).
- Upload:
  - straight from the Editor's browser to a private Supabase Storage bucket, with a resumable (TUS) upload
  - it never goes through a Vercel request body, which is capped at about 4.5 MB
  - a Staff-checked Server Action authorises the upload, following the upload seam's pattern (src/services/uploads.ts, uploads.storage.ts), and then records it
  - files that aren't PDFs, or are over 200 MB, are refused in the browser before uploading, and again on the server
  - read the Supabase Storage docs for resumable uploads and the bucket size limit before building; the supabase skill says to check the current docs
  - the bucket is private, with RLS deny-all like the rest
- The job:
  - a job row records the status (Processing, Draft, Failed), pages done, total pages, the failure reason, a restart count and a heartbeat
  - a Vercel function renders about 25 pages per run with pdf.js on a server-side canvas, at about 1600 px wide as WebP
  - it saves the pages to the private bucket, updates the job and its heartbeat, then starts the next run
  - a run that picks up a job resumes from the pages done, never duplicating or skipping a page
  - a Vercel Cron every minute (a cron entry in vercel.json) calls a cron endpoint that restarts jobs whose heartbeat is stale
  - it fails the job after a set number of restarts (pick a number and say why)
  - the endpoint refuses any caller without the right `Authorization: Bearer <CRON_SECRET>`
  - CRON_SECRET is a new server-only env var in src/env.server.ts, never NEXT_PUBLIC_, optional so local and e2e runs don't need it; the cron endpoint answers 404 or 401 when it's unset
  - also document it in .env.example
- Libraries: permissive licences only, for example pdfjs-dist (Apache-2.0) with @napi-rs/canvas (MIT), and sharp (Apache-2.0) for WebP if needed. No AGPL MuPDF or mupdf.js.
  - THESE ARE NEW DEPENDENCIES. Before installing anything, stop and ask the user, with each package's exact name, version and licence and why it's needed.
  - Check they run on Vercel's Node runtime (native binaries for linux-x64).
- Failure reasons, each shown with its fix:
  - password-protected: "Remove the password and upload again"
  - corrupt or unreadable: "Re-export the PDF and upload again"
  - over 200 MB
  - too many restarts: "Try again, or contact the developer"
- The page-images interface: a small interface for "render pages N–M of this PDF" and "store page images", with an in-memory fake. The seam tests and e2e use the fake. Real renderer tests use tiny fixture PDFs committed under the tests: a 3-page PDF, a password-protected PDF and a corrupt file. Keep each a few KB.
- The Admin list (under the Member App content area, Editors and Owners):
  - each upload with its file name, status and progress ("Processing · 75 of 312 pages"), refreshing by itself while anything is Processing
  - deleting removes the original and every page image, and the job
- Every upload and delete goes in Staff Activity.
- Clean page images and the original are never reachable from a browser: no public URLs, no signed URLs to Members. Ticket 14 serves stamped pages.

SCOPE
Modify or add:
- a migration for the Reviewer PDF job fields (and the page-image records, if you keep any) on ticket 05's Reviewer PDF record. Also a new private bucket, in the style of supabase/migrations/20261103130415_catalogue_bucket.sql.
- the Admin seam: create the upload, record it, list, delete, both arms, and the behaviour suite
- the page-images interface, its fake, the pdf.js renderer and the storage adapter, with their tests and the fixture PDFs
- the job runner, the chaining run endpoint and the cron endpoint (Route Handlers), with their tests
- vercel.json (the cron entry), src/env.server.ts (CRON_SECRET) and its test, and .env.example
- the Admin Reviewer PDFs screen (upload, list, progress, delete)
- the Admin e2e spec, using the fake renderer
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Website, the Member App, placement and publishing (ticket 13), the reader and stamping (ticket 14).

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0010-access-follows-the-exam.md. If anything else is uncommitted, stop and report.
   - Stay on the shared branch: `git switch feat/phase3-member-app`. If it's behind main, run `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a new branch.
   - Check the blocking tickets' work is present (see "Blocked by" above and CONTEXT). If it's missing, stop and ask. Don't build it yourself.
2. Read the files in CONTEXT, the upload seam, and ticket 05's Reviewer PDF record and Admin content area. Read the current Supabase Storage resumable-upload docs.
3. Stop and ask about the new dependencies: the exact packages, versions and licences. Wait for the answer before installing anything.
4. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices (the migration), supabase (storage), secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
5. TDD the job state machine as pure functions:
   - Processing to Draft when the pages are done
   - Processing to Failed with each reason
   - which pages the next batch covers
   - when a heartbeat is stale
   - the restart limit
6. TDD the runner against the fake: batches resume without duplicating or skipping pages, a stale job restarts, and too many restarts fail it.
7. TDD the real renderer on the fixtures: 3 pages render to 3 WebP images of about 1600 px wide. The password-protected and corrupt fixtures fail with the right reason.
8. TDD the endpoints and env: the cron endpoint refuses a missing or wrong secret and answers 404/401 with CRON_SECRET unset. The server env accepts CRON_SECRET unset or set.
9. TDD the seam and screen (both arms): the upload is refused for a non-PDF or over 200 MB, the list shows progress, delete removes everything, and Staff Activity records it.
10. e2e on the sample data, with the fake renderer: an Editor uploads a small PDF, sees Processing then Draft, and deletes it.
11. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- An Editor uploads a PDF, leaves the page, comes back, and finds it a Draft with every page rendered.
- Progress shows while processing, and refreshes by itself.
- Deleting removes the original, every page image and the job.
- The renderer turns the 3-page fixture into 3 WebP page images of about 1600 px wide.
Sad paths (each one needs a test):
- The password-protected fixture fails with "Remove the password and upload again".
- The corrupt fixture fails with its reason.
- A non-PDF or an over-200 MB file is refused before upload, and again on the server.
- A batch boundary resumes without duplicating or skipping pages.
- A stale heartbeat restarts the job. Too many restarts fail it.
- The cron endpoint refuses callers without the right CRON_SECRET, and does nothing when it's unset.
- Clean page images and the original are never reachable from a browser: no public bucket, no public or Member URL.
- A Member (non-Staff) posting the upload or delete actions directly is refused.

VERIFICATION
Run each of these and show the last lines of its output:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked, as the e2e server has them
- `pnpm test:coverage`: the thresholds must still pass. Don't lower them.
- `pnpm test:e2e`: the Website, Admin and Member App projects, on the in-memory sample data
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run in LIVE mode against the hosted project:
  - never run Playwright against them, and never kill them
  - never run `pnpm build` in the working tree while they run
  - run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` before a full run, verify your own diff, and report the shared-tree results separately.
- Playwright silently skips the admin project when a website spec fails. Rerun with `--project=admin --no-deps`.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Git:
  - Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR.
  - Leave every change uncommitted on feat/phase3-member-app, and do NOT create a branch.
  - This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project or Vercel. Never change their data, settings or environment variables, and never apply a migration.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency without stopping to ask first. Name the exact package, version and licence.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo.
- Authorization stays on the server:
  - every Admin page and action calls the Staff Guard
  - every Member App read and write goes through the gate, consent, the Active Device check and the access decision
  - never trust the client or hidden fields
- Clean images (card images, quiz figures, Reviewer PDF pages and originals) are never public. Members only ever get short-lived signed URLs, or stamped pages, after an allowed read.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it. Mark the CI-only ones "CI only, not run here".
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you had to make, and follow-ups
6. each migration filename, with the line "Apply <migration> to hosted after merging (the user does this)", or "No migration"
7. the line "Set CRON_SECRET in Vercel (Production and Preview), redeploy, and confirm the cron schedule in the Vercel dashboard (the user does this)", plus the dependencies you installed with their licences
8. the line "Nothing committed or pushed."
```
