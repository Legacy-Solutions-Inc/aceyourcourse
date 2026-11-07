# Executer prompt — 01 Admin shell and Staff sign-in (sample data)

Ticket: `.scratch/ayc-admin/issues/01-admin-shell-and-sign-in.md` · Blocked by: — (Phase 1 committed) · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Open the Admin. Staff go to /admin and choose "Continue with Google". In development, that opens a "Sign in as" list of sample Users. They then land in the Admin shell from the mockup:
- the sidebar, with Settings shown to Owners only
- the header, with the SAMPLE DATA tag and "View site ↗"
- the user block, with Sign out
- the mobile drawer

The Staff Guard decides every case:
- signed out → the sign-in screen
- not Staff → the 403 screen, with the attempt recorded
- an invited email → the Invite activates
- an expired Invite → the 403 screen, saying it expired
- an Editor opening Settings → the 403 "owners only" screen

In production, the Admin is closed: every /admin route answers 404.

The Overview shows the greeting. The four section screens exist with their headers and an empty body, which later tickets fill in.

CONTEXT
- This is Stage A (CONVENTIONS §1): no database and no Supabase sign-in.
  - Stage A ignores DATABASE_URL completely, even when .env sets it.
  - Real Google sign-in comes in ticket 16, behind the same Guard.
- Already on docs/ayc-v1-planning: the whole Phase 1 Website.
  - The Catalogue seam: src/services/catalogue.ts selects catalogue.mock.ts, which reads CATALOGUE_SEED from src/services/mock/catalogue.ts.
  - src/paths.ts (paths.auth.callback exists; there are no admin paths yet).
  - src/middleware.ts, with the per-request nonce CSP and needsSession() from src/lib/session-routes.ts. That already lists /admin, so the middleware calls Supabase there today.
  - src/config.ts: isSupabaseConfigured and computeAuthDisabled.
  - src/lib/auth/session.ts and actions.ts: Supabase getSession and signOut, unused by the Admin in Stage A.
  - shadcn components in src/components/ui: sheet, dialog, avatar, dropdown-menu, sidebar, sonner and others.
  - Brand tokens in src/app/globals.css, fonts in src/app/fonts.ts, and the Website shell in src/app/(website)/layout.tsx.
  - The Website's StatusPage component, which may suit the 403 layout.
- The mockup: docs/mockup/admin/AdminDashboard_v2.dc.html, mapped in docs/mockup/admin/BUILD-MAP.md.
  - Sidebar 14–38. Drawer 40–69. Header 72–79. Overview greeting 704–706. Auth screens 883–906. Menu button 908.
  - Copy overrides are in CONVENTIONS §4.
  - Our menu is fixed (spec Phase 2, Menu):
    - 01 HOME: Overview
    - 02 WEBSITE: Exam pages & promo
    - 03 WEBSITE: Products & store links
    - 04 WEBSITE: Reviews & FAQs
    - 05 SETTINGS: Settings (Owner only)
    - then "View site ↗"
  - No "Paid today" card, no hardcoded badges, and no later-phase items.
- Sample Users and their states are in CONVENTIONS §5. Times are relative to server boot.
- Greeting: Manila time. "Good morning" before 12:00, "Good afternoon" before 18:00, otherwise "Good evening". The first name comes from the Staff User's name.

SCOPE
Create:
- src/lib/admin/mode.ts: computeAdminMode and adminMode, server-only, Stage A rule.
- src/lib/admin/safe-next.ts: accepts /admin paths only.
- src/lib/admin/identity.ts: the sample cookie arm.
- src/lib/admin/guard.ts: getStaff, requireStaff, requireOwner. Closed mode → notFound().
- src/lib/admin/time.ts: Manila greeting and date line. Reuse any existing Manila date helper in src/lib first.
- A test beside each of those modules.
- The Admin seam's first area, staff sign-in:
  - src/services/admin.ts, with the contract and selector
  - admin.types.ts, holding StaffActor, AdminResult and AdminError (CONVENTIONS §3)
  - admin.mock.ts and src/services/mock/admin/staff.ts
  - functions: resolveSignIn(email, now), returning { status: "staff", actor } or { status: "denied", reason: "not-staff" | "invite-expired" }; recordDeniedSignIn; and the read the Guard uses
- src/services/mock/sample-store.ts, with the staff, invites, deniedSignIns, staffActivity and generation parts. Ticket 02 adds the catalogue.
- src/services/mock/staff.ts: the sample staff from CONVENTIONS §5.
- src/services/admin.staff.test.ts, using the describe.each(ADMIN_ARMS) pattern.
- src/app/admin/sign-in/page.tsx, with a "Sign in as" client panel and its Server Action (sample mode only).
- src/app/admin/denied/page.tsx.
- src/app/admin/(shell)/layout.tsx and page.tsx (the Overview greeting).
- The section screens (exam-pages, products, reviews, settings) with their headers and empty bodies. Settings calls requireOwner.
- The signOut Server Action for the Admin.
- src/components/admin/: sidebar, header (group label, title, SAMPLE DATA tag, View site ↗, a slot for the primary action), user block, mobile drawer.
- e2e/admin/helpers.ts (signInAs and resetSampleData; the reset route arrives in ticket 02, so keep that helper inert until then) and e2e/admin/sign-in.spec.ts.
- The Playwright "admin" project (CONVENTIONS §6).

Modify:
- src/paths.ts: paths.admin.
- src/middleware.ts: no Supabase call for /admin in sample mode; the CSP still goes on every response.
- src/app/robots.ts and its test: disallow /admin.
- e2e/a11y.spec.ts, or a new e2e/admin/a11y.spec.ts, for the signed-in screens.
- playwright.config.ts.

Leave untouched: the Website pages, the Catalogue seam's contract, src/lib/supabase/*, and the auth callback.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if the Phase 1 Website (the Catalogue seam in src/services/catalogue.ts, src/paths.ts, src/middleware.ts with needsSession) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/01-admin-shell-and-sign-in.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 user stories 51–60, and Implementation Decisions → Phase 2 (Mockup fidelity, Menu, Two stages, Seams, Staff access, Invites, Staff Role permissions)
   - docs/adr/0008-single-brand-members-and-staff.md and docs/adr/0003-mock-first-service-seam.md
   - docs/mockup/admin/BUILD-MAP.md §1, §2, §3.1 (greeting only), §3.12, and the mockup lines named in CONTEXT
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, shadcn-ui, tailwind-v4, secure-code-guardian.
4. TDD the pure parts first: computeAdminMode, safe-next, and the greeting and date line (including the Manila edges at 11:59, 12:00, 17:59 and 18:00).
5. TDD the staff sign-in area through the seam's contract:
   - an active Owner and an active Editor
   - Kim activating, case-insensitively, with Staff Activity recorded
   - the expired Invite denied
   - Juan denied
   - each denied attempt recorded with its email, time and reason
6. TDD the Guard with the sample identity:
   - signed out, not Staff, an Editor on an Owner-only page
   - a Staff User removed from the store between two calls
   - a cookie naming an unknown email
   - closed mode
7. Build the screens from the mockup's lines: sign-in, the Sign-in-as panel, 403, the shell, the drawer and the Overview greeting. Use the brand tokens and shadcn primitives. Check them at 1280 px and at 375 px.
8. Wire the middleware change, robots, and the paths.
9. Write the e2e journeys and the axe checks, adding the admin Playwright project.
10. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- Signed out, /admin redirects to /admin/sign-in?next=%2Fadmin. Signing in as the Owner lands on /admin with "Good morning|afternoon|evening, Angel." and the date line (for example "THURSDAY · 22 OCT 2026"), all in Manila time.
- The Owner's sidebar shows the five items plus "View site ↗". The Editor's has no Settings. Every item opens its screen, with the header showing the group label, the title and the SAMPLE DATA tag.
- Signing in as kim.reyes@gmail.com, or as KIM.REYES@GMAIL.COM through "Other email", activates the Invite as an Editor, lands on the Overview, and appends one Staff Activity record. A second sign-in also works.
- The 403 screen for juan.delacruz@gmail.com shows:
  - "You're signed in as juan.delacruz@gmail.com, which isn't on the admin list. Nothing was changed."
  - "THIS ATTEMPT WAS LOGGED · {time}"
  - "Use another account", which signs out and returns to sign-in
  - "Go to the website"
  With MEMBER_APP_LIVE=true, the second button is "Go to the member app" instead.
- Sign out returns to the sign-in screen, and /admin redirects there again.
- At 375 px, the Menu button opens the drawer. Escape and the scrim close it, and focus returns to the button.
- Every Admin page sends noindex, and robots.txt disallows /admin.
Sad paths (each one needs a test):
- The expired Invite gets /admin/denied?reason=invite-expired with "Your invite expired. Ask an Owner to renew it.", and the attempt is recorded.
- An Editor opening /admin/settings gets /admin/denied?reason=owners-only. Calling an Owner-only check from a Server Action as an Editor is refused.
- next=https://evil.example, next=//evil.example, next=/app and next=/admin/../app all fall back to /admin.
- A sample cookie naming an unknown email gets the 403 screen. A cookie for a Staff User removed from the store after sign-in is denied on the next request.
- In production (computeAdminMode with nodeEnv "production"), requireStaff calls notFound(), and the sign-in page and the Sign-in-as action refuse.
- In sample mode, a request to /admin makes no Supabase call. Test it at the middleware level.
- The "Other email" field rejects an empty or invalid email with a message.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage` (the thresholds in vitest.config.ts must still pass; don't lower them)
- `pnpm test:e2e` (the Website and admin projects)
- Show the e2e output of e2e/admin/sign-in.spec.ts on its own.
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
- The Sign-in-as list and its Server Action exist only in sample mode. Production can never reach them.
- Don't call Supabase anywhere in the Admin in this ticket.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. mockup deviations (with the BUILD-MAP or mockup line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
