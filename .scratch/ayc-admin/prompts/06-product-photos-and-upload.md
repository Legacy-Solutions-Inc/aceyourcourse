# Executer prompt — 06 Product photos, and the upload seam

Ticket: `.scratch/ayc-admin/issues/06-product-photos-and-upload.md` · Blocked by: 05 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Editors manage a Product's photos in the editor's photo strip:
- upload JPEG, PNG or WebP files up to 10 MB each, straight from the browser to a one-time upload URL
- see a warning, not a block, below 1000 × 1000 or when a photo isn't square
- the first photo is the cover
- reorder by dragging, or with Move left and Move right
- remove a photo

Photo changes save with the Product. This ticket builds the upload seam, whose sample arm is a development-only upload route held in memory. Ticket 17 adds Supabase Storage behind the same seam.

CONTEXT
- Already on docs/ayc-v1-planning: the Product editor, with its save path and conflict check (ticket 05). Photos show read-only, and "Add at least one photo to make it Live" exists.
- Today, Product photos are static files in public/products/<slug>/N.webp ({ src, alt }), rendered with next/image (src/components/website/product-image.tsx, product-gallery.tsx). next.config.ts has no images config. The CSP allows img-src 'self' and https:.
- The upload seam (CONVENTIONS §3):
  - createUpload(actor, { purpose, contentType, size }) returns { uploadUrl, path, publicUrl }.
  - The browser PUTs the bytes to uploadUrl, then the Product save records the path.
  - The sample arm:
    - stores the bytes in the sample store under an id
    - uploadUrl is /api/dev/uploads/<id>?token=<one-time token>
    - publicUrl is /api/dev/uploads/<id>
    - the route's PUT checks the token, the declared type and size, and the file's magic bytes (JPEG FF D8 FF, PNG 89 50 4E 47, WebP RIFF….WEBP)
    - GET serves the bytes with their content type
    - outside sample mode, the route answers 404
- next/image with a relative src goes through the image optimiser, which fetches the same origin. If that fails for the dev route, render uploaded sample images unoptimized and say so. Don't widen the CSP.
- Dimension warnings are computed in the browser before upload (createImageBitmap). They don't block. The server only checks the type and size.
- Drag and drop: use native HTML5 drag events with no new dependency, plus Move left and Move right buttons for keyboard and screen readers.
- Alt text is generated on save: "{full name}, photo N of M", matching the seed's format.
- Uploads not yet saved are kept in memory. Orphans are acceptable in Stage A; ticket 17 handles cleaning up Storage.
- The mockup: BUILD-MAP §3.3, "PHOTOS · FIRST IS THE COVER" (the editor panel, lines 181–190).

SCOPE
Create:
- src/services/uploads.ts, uploads.mock.ts and uploads.types.ts, plus src/services/uploads.test.ts.
- src/app/api/dev/uploads/[id]/route.ts, plus a test.
- The photo strip component in src/components/admin/products/.
- The products area's photo handling in updateProduct and createProduct (ordered photos with paths; alt generated).
- e2e/admin/product-photos.spec.ts, with a small fixture image under e2e/fixtures/.

Modify: the Product editor, the sample store (uploads), and the Website image rendering, only if uploaded sample images need unoptimized.

Leave untouched: the existing public/products files and the seed's photo paths.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 05 (the Product editor, updateProduct) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/06-product-photos-and-upload.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 decisions (Seams: Image upload; Products: photos)
   - docs/mockup/admin/BUILD-MAP.md §3.3 (PHOTOS)
   - src/components/website/product-image.tsx, product-gallery.tsx, next.config.ts and src/lib/csp.ts
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, shadcn-ui, secure-code-guardian.
4. TDD the upload seam:
   - an allowed type and size gives a URL
   - a disallowed type or a size over 10 MB is refused
   - a signed-out actor is refused
5. TDD the route:
   - a PUT with a valid token stores the file
   - a second PUT is refused
   - a type mismatch, a size mismatch or bad magic bytes is refused
   - GET serves the bytes
   - 404 when closed
6. TDD the photo rules in the products area:
   - the order is saved and the cover is first
   - alt text is generated
   - removing the last photo of a Live Product is refused
   - an unknown upload path is refused
   - the conflict check
7. Build the strip: progress per file, warnings, drag and the move buttons, remove, and the cover label.
8. Write the e2e: upload the fixture, reorder it to first, save, and see the Website's Product page show it as the cover with the right alt text.
9. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- Choosing two valid files uploads them with progress. They appear as unsaved, and "Save product" attaches them. The caption reads "N photos · drag to reorder".
- Dragging the new photo to first, or using Move left until it's first, labels it COVER. After saving, the Website's Product page, its card and its Exam page use it as the cover.
- A 900 × 900 photo, or a 1200 × 800 one, shows a warning badge and still saves.
- Every photo's alt text after saving is "{full name}, photo N of M".
- A new Live Product can now be created once it has a photo.
Sad paths (each one needs a test):
- A .gif or a 12 MB file is refused before upload, naming the file. createUpload refuses it as well.
- A PUT whose body isn't really an image (bad magic bytes), or doesn't match the declared type or size, is refused, and nothing is stored.
- A second PUT to the same upload URL is refused.
- A network failure on one upload (forced in the e2e with route interception) shows "Upload failed · Try again" on that file only. Retrying works.
- Removing the last photo of a Live Product and saving gets "A Live Product needs at least one photo."
- Saving with a photo whose upload never finished is refused: "Wait for uploads to finish."
- A stale save gets the conflict message, and the unsaved photos stay in the strip.
- A signed-out createUpload is refused. In closed mode, GET and PUT on /api/dev/uploads answer 404.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage` (the thresholds in vitest.config.ts must still pass; don't lower them)
- `pnpm test:e2e` (the Website and admin projects)
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
- Don't widen the CSP or add an images remote pattern in this ticket. Ticket 17 does that for Supabase Storage.
- No drag-and-drop or upload library.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. mockup deviations (with the BUILD-MAP or mockup line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
