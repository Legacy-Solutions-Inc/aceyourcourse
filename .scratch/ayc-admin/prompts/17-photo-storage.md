# Executer prompt — 17 Photo storage

Ticket: `.scratch/ayc-admin/issues/17-photo-storage.md` · Blocked by: 15 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Product photos and Exam share images live in a public Supabase Storage bucket.
- The upload seam's Storage arm hands the browser a one-time signed upload URL, made with the server-only secret key.
- The bucket enforces JPEG, PNG or WebP, up to 10 MB.
- The seed uploads the Phase 1 photos into the bucket. The repo keeps its copies for the mock tests.
- next/image allows the Storage host.
- After a save commits, the Storage objects of removed photos are deleted.

CONTEXT
- Already on docs/ayc-v1-planning:
  - the upload seam (src/services/uploads.ts, with its sample arm and the dev route, ticket 06)
  - the photo flow in the Product editor and the share image in Exam pages
  - Admin writes on the database (ticket 15)
  - SUPABASE_SECRET_KEY in the server env (ticket 13)
- The bucket, in a migration in supabase/migrations, with SQL on storage.buckets:
  - id "catalogue", public = true
  - file_size_limit 10 MB
  - allowed_mime_types image/jpeg, image/png, image/webp
  - No storage.objects policies for anon or authenticated: uploads only go through signed upload URLs made on the server.
  - Check the current Supabase Storage docs for createSignedUploadUrl and uploadToSignedUrl.
- The server-only Storage client: src/lib/supabase/admin.ts imports "server-only", and uses NEXT_PUBLIC_SUPABASE_URL plus SUPABASE_SECRET_KEY. Used for Storage only.
- Paths: products/{productId}/{uuid}.{ext}, and exam-pages/{code}/share-{uuid}.{ext}. The public URL comes from getPublicUrl.
- The browser flow stays as in ticket 06: the browser PUTs to uploadUrl, then saves the path.
- Arm selection: the Storage arm when the database is configured, the sample arm otherwise.
- next.config.ts gets images.remotePatterns for the Supabase host's /storage/v1/object/public/** (from NEXT_PUBLIC_SUPABASE_URL, which covers hosted and local 127.0.0.1:54321).
  - The CSP's img-src already allows https:. In development, add the local Storage origin (http://127.0.0.1:54321) only.
  - Check src/lib/csp.ts and its tests.
- The seed uploads public/products/<slug>/*.webp into the bucket and stores the bucket paths. In production it runs once, inside catalogue:seed --production.

SCOPE
Create:
- the bucket migration
- src/lib/supabase/admin.ts
- src/services/uploads.storage.ts (the Storage arm), with database tests against local Supabase
- the Storage clean-up in admin.db.ts, after commit

Modify:
- src/services/uploads.ts (the selector)
- scripts/catalogue-seed.ts and src/lib/catalogue-seed/ (photo upload)
- next.config.ts
- src/lib/csp.ts and its test (development only)
- the README

Leave untouched: public/products (the mock arm and the tests still use them), and the browser upload flow.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 15 (admin.db.ts, so photo records are on the database) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/17-photo-storage.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 decisions (Seams: Image upload, Keys, Catalogue goes real, Products: photos)
   - src/services/uploads*.ts, the dev upload route, next.config.ts, src/lib/csp.ts and scripts/catalogue-seed.ts
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, supabase, supabase-postgres-best-practices, drizzle-data.
4. Write the bucket migration, apply it, and check the bucket's limits with a database test.
5. TDD the Storage arm against local Supabase:
   - a signed URL upload succeeds and its public URL serves
   - a wrong type or a file over 10 MB is refused by the bucket
   - a reused token is refused
   - a missing secret key fails clearly
6. Add the after-commit clean-up: removed photos, a deleted Product's photos, a replaced share image. A failed delete is logged, never fatal.
7. Upload the seed photos in catalogue:seed. Update next.config and the CSP for development. Run the photo e2e on the database.
8. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- In the e2e on the local database, uploading a fixture photo goes to Storage, and after saving the Website's Product page shows it from the Storage URL through next/image.
- `pnpm db:reset` uploads every seed photo, and the Website shows the seed photos from Storage.
- Removing a photo and saving deletes its object. Deleting a Product deletes all its objects.
- The bucket reports public = true, a 10 MB limit and the three MIME types.
Sad paths (each one needs a test):
- A .gif, or an 11 MB file, sent to the signed URL is refused by the bucket, and nothing is stored.
- A second upload with the same signed token is refused.
- A missing SUPABASE_SECRET_KEY with the database configured makes createUpload fail with "Storage isn't configured on this server." A test proves the key is never in a client bundle.
- A seed photo file that is missing aborts catalogue:seed before any database write.
- A Storage delete failure after a save is logged, and the save still succeeds.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage` (the thresholds in vitest.config.ts must still pass; don't lower them)
- `pnpm test:e2e` (the Website and admin projects)
- `supabase start` (Docker running), then `pnpm db:reset` and `pnpm test:db`; show the database test summary (passed and skipped).
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
