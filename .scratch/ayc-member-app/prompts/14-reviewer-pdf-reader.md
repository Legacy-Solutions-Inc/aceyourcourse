# Executer prompt — 14 Reviewer PDF reader with stamped pages

Ticket: `.scratch/ayc-member-app/issues/14-reviewer-pdf-reader.md` · Blocked by: 13 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js, TypeScript and image-processing engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
A Member reads a Topic's Reviewer PDF one page at a time, zooms 75–150%, and reopens at their last page and zoom. The server stamps every page with the Member's email and short Member ID on every request. Only the Member's own browser caches it. A dropped connection shows "page didn't load · Try again".

CONTEXT
- Spec: docs/specs/2026-10-29-ayc-v1.md
  - Phase 3 → "Burned-in watermark" (changed on 2026-11-17: stamp on every request, private short browser cache, no CDN or Storage copy), "Reviewer PDF reader"
  - "Phase 3 planning decisions (added 2026-11-17)" → "Watermark stamping", "Progress storage", "Resume", "The Reviewer PDF job" (pages are about 1600 px WebP; zoom happens in the browser)
  - Testing Decisions → "Phase 3 seams" → "Member seam" and "Page images"
  - Stories 101, 102 and 105.
- Read CONTEXT.md (Reviewer PDF, Member, Active Device, Study Day, Free Preview), ADRs 0010 (with its amendment), 0011 and 0012, and docs/mockup/member-app/BUILD-MAP.md §3: "Reviewer (L344–370)", "Load error (L676–689)", "Empty topic", "Expired", "Signed out elsewhere".
- Earlier Phase 3 tickets created the concepts you build on. Find them in the code, and don't invent paths:
  - the Member seam (sample and database arms)
  - the gate, consent, and the Active Device check (01, 02, 04)
  - the access decision and its outcomes (allowed, locked, expired, device-replaced, no-token, unavailable, not open yet), and the content tables (05)
  - the page-images interface and its private storage (12)
  - Published-only (13)
  - Study Days and resume state (08 added them for decks; extend them for the Reviewer PDF page and zoom)
- **sharp is already a direct dependency in package.json.** Use it for stamping. Add no other dependency. If you think you need one, stop and ask.
- **The protected page endpoint:** a Route Handler under /app. For each request:
  1. gate, consent and Active Device
  2. the access decision for that Reviewer PDF
  3. a range check on the page number
  4. read the clean page through the page-images interface
  5. stamp it
  6. respond with `Cache-Control: private, max-age=<short, for example 300>` and never a public or s-maxage cache
  Refusals send no image bytes.
- **The stamp:** the Member's email and short Member ID, semi-transparent, tiled or diagonal, in the same position every time so it can be tested, and readable without hiding the content. Put the stamper behind the page-images interface so seam tests use a fake.
- **The reader:**
  - page N of M, Previous and Next (and the arrow keys)
  - zoom 75–150% in 25% steps, done in the browser
  - no service worker and no offline caching
  - an image load error shows "page didn't load · Try again", and the retry refetches
- **Progress and resume:**
  - each page viewed is recorded once per Member and page, in the current-state "pages viewed" record
  - viewing a page counts as a Study Day (Asia/Manila; src/lib/manila-time.ts manilaDate)
  - the last page and zoom per Reviewer PDF are stored, and the reader reopens there

SCOPE
Modify or add:
- the page endpoint and the stamper (behind the page-images interface) with tests, including real sharp tests on tiny fixture images
- the Member seam (both arms) for pages viewed and Reviewer PDF resume, with tests
- the reader screen and its component tests
- a migration only for missing tables or columns (pages viewed, Reviewer PDF resume), in the repo's style, with RLS on and no anon or authenticated policies
- e2e: a Member App reader journey on the in-memory sample data
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the Admin's upload and job (ticket 12) except to read its interface, the Website.

APPROACH
1. Pre-flight.
   - Run `git status`. Allowed uncommitted changes: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md and docs/adr/0010-access-follows-the-exam.md. Stop and report anything else.
   - `git switch feat/phase3-member-app`. If it's behind main, `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a branch.
   - Confirm that tickets 12 and 13 are present (the page-images interface, Published status). If they're missing, stop and ask.
2. Read AGENTS.md, CONTEXT.md, the ticket (every checkbox is part of your acceptance criteria), the spec sections and the mockup screens above.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices (if you add a migration), secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the stamper with real sharp on a small fixture image. The output differs from the input in the stamp's region and matches it outside it (within tolerance). Two Members' outputs differ.
5. TDD the endpoint with the fake stamper and storage: each access outcome, range checks and headers.
6. TDD pages viewed (once per page), the Study Day and resume against both Member seam arms.
7. TDD the reader: paging, zoom steps and bounds, the load-error retry, and reopening at the last page and zoom.
8. Add the e2e: open a Published Reviewer PDF, page forward, zoom, leave, reopen at the same page and zoom, and check a locked Member gets the unlock prompt.
9. Verify, run requesting-code-review on your diff, fix the in-scope findings, then report.

ACCEPTANCE CRITERIA
Happy paths:
- A Member with access reads pages, zooms, leaves, and reopens at the same page and zoom.
- Each page carries that Member's stamp, and a different Member's copy of the same page carries theirs.
- A failed page load shows "page didn't load · Try again", and retrying shows the page.
- Free Preview Reviewer PDFs open for a Member with no Access Pass. Active Staff open Published ones without a pass.
Sad paths (each one needs a test):
- A locked or expired Member's page request is refused with no image bytes. The reader shows the unlock prompt or renew, with progress kept.
- An Unpublished or Draft Reviewer PDF's pages are refused ("no longer available").
- A page number below 1, above the count, or not a number is refused.
- A replaced device is refused (Session ended). A missing token gets the "Use the Member App on this device" outcome.
- The response is never publicly cacheable: no `public` and no `s-maxage`.
- The clean image and the original PDF are never sent or linked.
- Viewing the same page twice records it once. The Study Day is right across Asia/Manila midnight.
- One Member's resume and pages viewed never reach another.

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
- Add no dependency (sharp is already there). Otherwise stop and ask.
- Never print .env, keys or connection strings, and never put a real person's email address in the repo or the fixtures (use example.com addresses).
- Every Member App read goes through the access decision. Stamped pages are never publicly cacheable, and clean pages are never sent.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it; mark the CI-only ones "CI only, not run here"
3. the happy-path and sad-path tests you added
4. the results of each verification command, plus the measured stamp time per page from your test
5. the decisions you made (the stamp layout, max-age) and follow-ups
6. any migration filename, with "Apply <migration> to hosted after merging (the user does this)", or "No migration"
7. the line "Nothing committed or pushed."
```
