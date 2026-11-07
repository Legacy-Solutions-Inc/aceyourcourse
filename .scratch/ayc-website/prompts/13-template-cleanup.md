# Executer prompt — 13 Template cleanup

Ticket: `.scratch/ayc-website/issues/13-template-cleanup.md` · Blocked by: 01 · Branch: `chore/website-13-template-cleanup`

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 / TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first where you change behaviour, and stop to ask whenever the brief or the code doesn't settle a decision.

GOAL
Remove the B2B template code that Ace Your Course doesn't use, so no Visitor can reach a sign-up, password or demo screen and no future agent copies the wrong pattern. That means:
- the tenancy model
- the Customers Reference Feature
- the demo dashboard
- the email and password auth pages
- the old role model
Then point the docs at the Catalogue seam as the Reference Feature. Keep the Supabase session plumbing and the OAuth callback for Phase 2's Google sign-in.

CONTEXT
- ADR 0008 (it supersedes ADR 0005, multi-tenancy): AYC is single-brand. There are no Organizations, Memberships, invitations, workspace switcher, Org Roles or Superadmin.
  - Every User is a Member.
  - Staff (Phase 2) is a staff list keyed by email with Staff Role owner or editor. It is NOT auth app_metadata.
- Sign-in is Google OAuth only, from Phase 2. The email and password flows (sign-up, sign-up confirm, reset and update password) and the email/password sign-in page go away now. Phase 2 builds the Admin's Google sign-in screen.
- The Catalogue seam (src/services/catalogue.ts, .mock.ts, .types.ts, .schema.ts, mock/catalogue.ts) and the Website pages under src/app/(website)/ are on main. They're the new Reference Feature.
- src/lib/session-routes.ts (needsSession) currently treats /dashboard, /auth, /app and /admin as session routes. src/middleware.ts creates a Supabase client only for those, and still gates /dashboard and redirects signed-in users away from /auth.
- Inventory to remove (check each with a grep for importers before you delete it):
  - src/app/dashboard/** (Overview, Customers, Team, Role settings, Settings, Blank, layout, loading, error)
  - src/app/auth/layout.tsx and src/app/auth/{sign-in,sign-up,sign-up-confirm,reset-password,update-password}/. KEEP src/app/auth/callback/route.ts.
  - src/components/auth/** (the forms and role-guard.tsx) and src/components/dashboard/**
  - src/services/customers.ts, customers.mock.ts, customers.db.ts and every customers*.test.ts (including customers.rls.integration.test.ts); src/services/mock/customers.ts; metrics.ts, team.ts and roles.ts; and src/services/types.ts if nothing else imports it
  - src/lib/authz.ts, authz.server.ts and authz.test.ts
  - supabase/migrations/20260715132833_init_multitenancy.sql
  - drizzle/0000_nifty_norman_osborn.sql and drizzle/meta/0000_snapshot.json. Reset drizzle/meta/_journal.json "entries" to []. Phase 2 generates the first real migration.
  - the tables and enums in src/lib/db/schema.ts. Leave a valid, empty schema module with a comment that Phase 2 adds the catalogue tables. src/lib/db/client.ts and drizzle.config.ts must still type-check and build.
  - template images in public/assets/ and public/{file,globe,next,vercel,window}.svg that nothing references
- Keep: src/lib/supabase/*, src/lib/auth/session.ts and strategy.ts, src/lib/auth/actions.ts (signOut now redirects to paths.home), config.ts (computeAuthDisabled and authDisabled; update their comments), every vendored src/components/ui/* (the Admin will use them), and the dependencies (list any now unused in the report; don't remove them).
- The removed Customers code was the prior art for Phase 2's Server Actions, data tables and RLS integration tests. It stays available in git history at commit aea34ea.

SCOPE
Delete: the inventory above.
Modify:
- src/paths.ts: remove `auth` (except a `callback` entry, which you can move to paths.auth.callback alone) and `dashboard`. Keep `home` and every Website and memberApp entry.
- src/lib/session-routes.ts and its test: session prefixes become /app, /admin and /auth (the callback only exists there). "/dashboard" is now false.
- src/middleware.ts:
  - remove the /dashboard gating, the /auth redirect and the hasRole import
  - for session routes, only refresh the Supabase session (and pass through with the CSP); for everything else, passThrough()
  - keep the production fail-closed branch working without dashboard paths: with Supabase unconfigured, it simply passes through
  - keep the matcher and the /relay exclusion unchanged
- src/app/auth/callback/route.ts and a new route.test.ts (`// @vitest-environment node`, mocking @/lib/supabase/server):
  - `next` is honoured only when it starts with a single "/" and not "//" or "/\"; otherwise it's paths.home
  - with no code, or when the exchange fails, redirect to paths.home
- src/app/robots.ts / src/lib/seo.ts:
  - if buildRobots takes { hasDashboard }, pass false; otherwise remove the "/dashboard/" rule
  - if SITEMAP_ROUTES still lists /auth/sign-in or /auth/sign-up, remove them
  - update the seo tests to match
- vitest.config.ts: remove the customers.db.ts coverage exclusion. Run `pnpm test:coverage`, then set each threshold to just below the newly measured value (floor to a whole number, minus 1). Never set one above the measured value, and update the "Measured:" comments.
- e2e/auth-smoke.spec.ts: rename it to e2e/smoke.spec.ts. The tests:
  - Home renders its H1
  - /dashboard returns 404
  - /dashboard/customers returns 404
  - /auth/sign-in returns 404
  - /auth/sign-up returns 404
  - /auth/reset-password returns 404
  - /auth/callback with no code ends on "/"
  - /auth/callback?next=//evil.example ends on "/" (same origin)
  In e2e/a11y.spec.ts, remove /auth/sign-in.
- AGENTS.md:
  - the reference in "Data goes through the seam" becomes src/services/catalogue.ts and a Website page such as src/app/(website)/products/[slug]/
  - "Auth is Supabase-only…": keep the Supabase clients and getSession guidance, and replace the app_metadata role sentence with "Authorization (from Phase 2) comes from the staff list on the server, never client-settable metadata (ADR 0008)"
  - "Where things live": a new feature copies the Catalogue (services/<name>.ts with .mock.ts, .types.ts and .schema.ts; pages under app/(website)/ or later app/admin/; components in components/website/<feature>/)
  - add one line: "The template's Server Action, data-table and RLS-integration-test examples (Customers) live in git history at commit aea34ea; reuse them when the Admin needs those patterns."
- CONTEXT.md, the Reference Feature entry only: it is now the Catalogue Service Seam with the Website pages that read it, demonstrating the seam, typed seed validation, RSC reads and tests. Keep it a glossary definition with no implementation detail. Mention that Customers was the template's example and is retired.
- docs/specs/2026-07-15-multi-tenancy.md: add a first line "Status: superseded by ADR 0008 (no tenancy). Not built." Don't change anything else in it.
- README.md: remove or rewrite the template-only sections (Customers reference, email/password sign-up, tenancy) so it describes Ace Your Course: its three Surfaces, mock-first, how to run it, and links to the spec, CONTEXT.md and the ADRs. Keep the setup commands accurate.
- .claude/skills/*/SKILL.md: where a skill points at a removed file as its worked example (grep "customers"), make a text-only edit that points to the Catalogue equivalent, or to commit aea34ea for Server Action, form and data-table patterns. List every file you touched.
Leave untouched: src/app/(website)/** and src/components/website/** (except imports that break), the Catalogue seam, docs/mockup/, docs/adr/ and every other spec.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if src/services/catalogue.ts is missing on main.
   - Check for evidence that the tenancy migration reached a hosted database: a supabase/.temp/project-ref file, or a SUPABASE_DB_URL / DATABASE_URL pointing at a non-local host in .env. If you find any, STOP and ask before deleting migrations.
   - Run `git switch -c chore/website-13-template-cleanup main`.
2. Read:
   - AGENTS.md, CONTEXT.md and ADR 0008
   - in the spec: "Architecture and cross-cutting" (Template cleanup; Google OAuth only)
   - src/middleware.ts, src/lib/session-routes.ts, src/paths.ts and src/app/auth/callback/route.ts
3. Skills: test-driven-development (for the middleware, session-routes and callback behaviour), systematic-debugging (for anything the removal breaks), testing-unit, testing-e2e and coding-standards.
4. Write the failing tests first: the callback (safe next, no code, failed exchange), session-routes (/dashboard false), the middleware (no Supabase client for "/" and "/products"; a client for "/app"; CSP present on both), and the smoke e2e (the 404s).
5. Delete in small steps, running `pnpm type:check` after each group (routes, components, services, authz, db and migrations, assets) so breakages are local. Grep for importers before each deletion.
6. Update the docs and skills, then the coverage thresholds.
7. Verify. Run requesting-code-review on your diff and fix in-scope findings. Report.

ACCEPTANCE CRITERIA
Happy paths:
- Home and every Website page still render, and the Website e2e suites still pass.
- /auth/callback?code=valid&next=/products redirects to /products (unit test with the Supabase exchange mocked as succeeding).
- The middleware sets the CSP on "/" and "/app". It creates the Supabase client for "/app" and "/admin/x" only.
- `pnpm build` succeeds with an empty Drizzle schema. drizzle.config.ts and src/lib/db/client.ts still compile.
- AGENTS.md, CONTEXT.md, README.md and the touched skills point to the Catalogue seam (or commit aea34ea). A grep for "src/services/customers" and "app/dashboard" in non-history docs and code returns nothing.
Sad paths (each one needs a test):
- /dashboard, /dashboard/customers, /auth/sign-in, /auth/sign-up, /auth/sign-up-confirm, /auth/reset-password and /auth/update-password each return 404.
- The callback:
  - with no code it redirects to "/"
  - when the exchange fails it redirects to "/"
  - with next=//evil.example, next=/\evil.example or next=https://evil.example it redirects to "/" on the same origin
- needsSession("/dashboard") is false. The middleware never creates a Supabase client for "/", "/products", "/exams/ce" or "/dashboard".
- No file outside git history imports from @/lib/authz, @/services/customers, @/components/auth or @/components/dashboard (the type-check proves it).
- The coverage thresholds pass in CI mode (`pnpm test:coverage`) and none is higher than the measured value.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage`
- `pnpm test:e2e`
All must pass. Follow verification-before-completion. Include the new measured coverage numbers.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on chore/website-13-template-cleanup. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never run a migration, `supabase db push` or `drizzle-kit migrate`, and never connect to a hosted database.
- Don't edit docs/mockup/ or docs/adr/. In docs/specs/, only add the one superseded line to the multi-tenancy spec.
- Don't change the CSP, the /relay matcher exclusion or the Website pages' behaviour.
- Don't remove dependencies or vendored shadcn components. List the unused ones instead.
- If a deletion breaks something you can't fix without changing Website behaviour, stop and report it.

REPORT BACK
Reply with:
1. the branch and `git status --short` (deletions included)
2. each acceptance criterion marked ✅ or ❌, with the proving test or spec
3. the happy-path and sad-path tests you added
4. the results of each verification command, and the old and new coverage thresholds
5. the unused dependencies, the skills and docs you touched, deviations and follow-ups
6. the line "Nothing committed or pushed."
```
