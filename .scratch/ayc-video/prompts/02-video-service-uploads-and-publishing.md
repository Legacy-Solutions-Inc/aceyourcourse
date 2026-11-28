# Executer prompt — 02 Video service, uploads and publishing

Ticket: `.scratch/ayc-video/issues/02-video-service-uploads-and-publishing.md` · Blocked by: 01 · Branch: `feat/phase5-video` (shared by every Phase 5 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and Postgres engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
Staff upload each Lesson's video from the Lesson editor straight to VdoCipher, preview it, and publish the Lesson once the video is ready. The VdoCipher key decides whether this is real, as the PayMongo key does for payments.

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 5 → "Phase 5 planning decisions (added 2026-11-28)": The VdoCipher account, The VdoCipher key decides, The video service interface, Uploads, Hiding, unpublishing and deleting, Access and playback (the Staff preview, the security headers)
  - Testing Decisions → "Phase 5 seams" (Video service; Admin seam, extended)
  - Stories 156, 176, 177, 178, 187
- Read:
  - docs/adr/0013-video-on-vdocipher.md
  - CONTEXT.md: Course, Module, Lesson, Free Preview, Staff
  - .scratch/ayc-video/grilling-notes.md, decisions 1, 7, 8, 12 and 14
  - docs/mockup/admin/BUILD-MAP.md §3.7 "Courses & videos" (Lesson editor video states)
- VdoCipher's public docs (read only; never call VdoCipher, never use its dashboard):
  - upload permission: https://www.vdocipher.com/docs/server/upload/credentials
  - upload from the browser: https://www.vdocipher.com/docs/server/upload/browser
  - playback pass (OTP and playbackInfo): https://www.vdocipher.com/docs/server/playbackauth/otp
  - watermark (annotate): https://www.vdocipher.com/docs/server/playbackauth/anno
  - and whatever pages they link for a video's status and length, and deleting a video
- Ticket 01 added Courses, Modules and Lessons, the "Courses & videos" screens and the Lesson editor. Find them in the code, and don't invent paths.
- Existing pieces to follow:
  - The payments client as the pattern for an external-service interface with a real client and a fake: src/services/payments.types.ts, payments.fake.ts, payments.ts (computePaymentsMode: sample → fake, key → real, no key → off), src/lib/paymongo/client.ts (+ test with a stubbed fetch)
  - src/lib/admin/mode.ts (sample vs live)
  - src/lib/csp.ts (+ src/lib/csp.test.ts) and src/middleware.ts
  - src/lib/member-app/member-id.ts (shortMemberId, memberWatermark) and src/lib/watermark.ts
  - The Admin seam and src/services/admin.courses.test.ts from ticket 01
  - docs/runbooks/production.md §13 (the PayMongo section, as a model for the VdoCipher one)
- **The video service** (new, small): one interface with a real VdoCipher client and a fake.
  - get one-time upload permission for a new video (returns what the browser needs to send the file, and the VdoCipher video id)
  - read a video's status (processing, ready, failed) and length in seconds
  - delete a video
  - issue a playback pass for a video, carrying watermark text (returns what the player needs)
  - The real client calls VdoCipher's API with the server-only `VDOCIPHER_API_SECRET`. Test it only with a stubbed fetch and fixture responses.
- **The key decides:** sample mode → the fake; a key → the real client; no key → off.
  - The fake: upload permission and the "upload" succeed locally, the status reads processing for a few seconds and then ready with a made-up length, delete records the deletion, and the playback pass returns a token for the sample player.
  - No key: the Lesson editor shows "Connect the video service to upload", with upload off. The rest of the builder works.
- **Uploading** from the Lesson editor:
  - MP4 or MOV, up to 4 GB, checked before permission is asked.
  - The server gives permission to Staff only, for an existing Lesson, and records the VdoCipher video on the Lesson (state uploading) before the browser sends anything.
  - The browser sends the file straight to VdoCipher's upload host (use XMLHttpRequest for upload progress). The file never passes through our servers.
  - Progress: "41% · about 6 min left · keep this page open". The browser warns before leaving mid-upload.
  - On failure: "Upload failed · Try again" (state upload failed). Trying again starts over.
  - After the upload: "Processing". While the editor is open it asks the server for the status every few seconds, then shows the video ready with its length (state draft).
  - "Replace video": a Published Lesson keeps playing its old video until the new one is ready; then the new one takes over and the old one is deleted from VdoCipher.
- **Publishing:**
  - Publish needs a title and a ready video: "ADD A TITLE BEFORE PUBLISHING", "ADD A VIDEO BEFORE PUBLISHING", "WAIT FOR THE VIDEO TO FINISH UPLOADING". Unpublish returns a Lesson to draft.
  - Lesson states: no video, uploading, processing, draft, published, upload failed.
  - A Course can be made Visible once it has a Published Lesson. Unpublishing the last Published Lesson of a Visible Course is refused: "A visible course needs a published lesson. Hide the course first."
- **Deleting** a Lesson or a Course also deletes its videos from VdoCipher. A failed delete doesn't block the deletion; it's logged in Staff Activity.
- **The Staff preview:** the Lesson editor plays the video with a playback pass watermarked with the Staff member's email, without the device check (the Admin is exempt). With the fake it shows the sample player: a dark 16:9 frame labelled "SAMPLE VIDEO", with the moving watermark, play and pause, a progress bar and a running clock. Build the sample player as a reusable component; ticket 03 uses it in the Member App.
- **Security headers:** allow VdoCipher's player in frame-src and VdoCipher's upload host in connect-src (take both hosts from the docs), and nothing else new.
- **The runbook:** add a VdoCipher section to docs/runbooks/production.md for the user: the client opens the account under the business's email (30-day free trial: 4 videos, 5 GB), the user sets `VDOCIPHER_API_SECRET` in Vercel (server-only, never NEXT_PUBLIC_), and the client buys Starter before uploading more than 4 videos.
- **Sample data:** the sample Lessons get ready fake videos with lengths and are Published; the three sample Courses become Visible.

SCOPE
Modify or add:
- the video service: types, the fake, the mode function, and the real client (e.g. src/services/video.types.ts, video.fake.ts, video.ts, src/lib/vdocipher/client.ts) (+ tests)
- src/lib/db/schema.ts for the Lesson's video, length and states if ticket 01 didn't add them; `pnpm db:generate`; keep deny-all.db.test.ts passing
- the Admin seam: upload permission, status, Replace, publish and unpublish, the Course visibility rule, video deletion on delete (+ src/services/admin.courses.test.ts or a new src/services/admin.lesson-videos.test.ts over both arms)
- the Lesson editor's video area, upload progress, the Staff preview and the sample player (+ component tests)
- src/lib/csp.ts (+ test)
- docs/runbooks/production.md (the VdoCipher section)
- sample data
- e2e: extend e2e/admin/courses.spec.ts on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Member App's screens, Orders and payments.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md, docs/adr/0013-video-on-vdocipher.md, and ticket 01's uncommitted work if the user says so. Stop and report anything else.
   - `git switch feat/phase5-video`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that ticket 01 is present (Courses, Modules, Lessons and the builder). If it's missing, stop and ask.
   - Check `ps` for another executer's processes. If one is running, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), ADR 0013, the spec sections and VdoCipher's docs above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, shadcn-ui, tailwind-v4, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the mode function (sample, key, no key) and the real client against fixture responses: permission, status, delete, playback pass with the watermark; a VdoCipher error mapped to a clear failure; the secret only ever in the request header.
5. TDD the Admin seam over both arms with the fake: permission for Staff only and for an existing Lesson, the states, the status poll, Replace keeping the old video until the new one is ready, the publish refusals, the last-Published-Lesson refusal, deletion deleting videos (and a failed delete still deleting and logging).
6. TDD the Lesson editor: the file checks, progress text, failure and retry, Processing to ready, "Connect the video service to upload" with no key, and the sample player.
7. e2e: an Editor uploads a small fixture MP4 to a Lesson in sample mode, sees Processing then ready, previews it, publishes the Lesson and makes the Course Visible.
8. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- In sample mode an Editor uploads, sees the progress, Processing, then the ready video with its length, previews it, publishes the Lesson, and makes the Course Visible.
- Replace keeps the old video playing until the new one is ready, then deletes the old one.
- With no key, the editor shows "Connect the video service to upload" and the rest of the builder works.
- The runbook has the VdoCipher section.
Sad paths (each one needs a test):
- A file that isn't MP4 or MOV, or is over 4 GB, is refused before any permission is asked.
- Upload permission is refused on the server for non-Staff and for a Lesson that doesn't exist.
- A failed upload shows "Upload failed · Try again", and the Lesson can't be published.
- Publishing while uploading or processing is refused with "WAIT FOR THE VIDEO TO FINISH UPLOADING", and without a title with "ADD A TITLE BEFORE PUBLISHING".
- Unpublishing the last Published Lesson of a Visible Course is refused.
- Deleting a Lesson deletes its video; a failed delete still deletes the Lesson and is logged.
- The key never reaches the browser: no NEXT_PUBLIC_ variable, nothing in a client bundle or page.
- The security headers add only VdoCipher's player frame and upload host.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm build`, in the scratchpad copy, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables, SUPABASE_SECRET_KEY, both PAYMONGO_* variables and VDOCIPHER_API_SECRET blanked
- `pnpm test:e2e`, in the scratchpad copy (the in-memory sample data, the video fake). If the admin project is skipped because a website spec failed, rerun with `--project=admin --no-deps` and report both.
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run LIVE against the hosted project. Never run Playwright against them, never kill them, and never run `pnpm build` in the working tree. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in. Make sure the copy has no leftover coverage/ or build output.
- Check `ps` for parallel Vitest runs before a full run.
- Don't add throwaway probe specs to e2e/. Keep any fixture video tiny.
- A new route can leave stale .next/types. Run `pnpm exec next typegen`.
- Inline "use server" handlers must be async.
- `pnpm db:generate` works offline and is fine. Never run db:reset, db:studio, db push or a seed load.
- Known failures on HEAD (check they fail without your change too, and report rather than fix): the sharp beforeAll timeouts (page-images.sharp, reviewer-reader), products-list.spec:173, the e2e overview promo-banner spec, and the database-arm member.payments / member.billing suites on PGlite.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase5-video, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, PayMongo, VdoCipher or Vercel, and never apply a migration to hosted. No test, e2e run or script makes a real network call to VdoCipher.
- `VDOCIPHER_API_SECRET` is server-only and never NEXT_PUBLIC_. The user sets it; never print it or ask for it.
- Never touch the other project's Supabase on ports 54321–54324. No Docker.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency (use fetch, XMLHttpRequest and VdoCipher's embed). Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo.
- Authorisation stays on the server. Only Staff get upload permission and Staff preview passes.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made (the interface shape, the VdoCipher endpoints and hosts used, the status poll interval, the Replace flow) and follow-ups for tickets 03 and 04 (the sample player, the playback pass)
6. "No migration", or the migration filename(s) with "Apply <migration> to hosted after merging (the user does this)"
7. the line "Nothing committed or pushed."
```
