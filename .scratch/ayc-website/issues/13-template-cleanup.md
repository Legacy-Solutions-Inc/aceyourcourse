# 13 — Template cleanup

**What to build:** The repo stops carrying the B2B template the Website doesn't use:

- the tenancy model: Organizations, Memberships, invitations, their migration and policies, and the workspace and role model
- the Customers Reference Feature
- the demo dashboard
- the email and password auth pages
- the old superadmin, admin, manager and member roles

The Catalogue seam becomes the documented Reference Feature. Nothing a Visitor can reach exposes a sign-up, password or demo screen. The Supabase session plumbing and the OAuth callback stay for Phase 2's Google sign-in.

**Blocked by:** 01 — Branded Website shell and Exams menu (the Catalogue seam must exist to become the Reference Feature).

**Status:** ready-for-agent

Spec: Implementation Decisions → Architecture and cross-cutting (Template cleanup; Google OAuth only); ADR 0008 (supersedes 0005).

- [ ] The dashboard routes, the auth pages (sign-in, sign-up, sign-up confirm, reset and update password) and their components are gone. Visiting any of them gives a 404.
- [ ] The OAuth callback route still exists and, after exchanging the code, redirects to Home.
- [ ] Customers, team, roles and metrics services, mocks and tests are gone, along with the tenancy migration, the Drizzle schema tables and snapshot for tenancy and Customers, and the role helpers and RoleGuard.
- [ ] The Drizzle config, database client and Supabase clients still build with an empty schema.
- [ ] Middleware: the CSP is unchanged. There's no dashboard gating. The session refresh runs only for the Member App, the Admin and the auth callback.
- [ ] Docs:
  - AGENTS.md "Where things live" points to the Catalogue seam as the pattern to copy
  - the Reference Feature entry in CONTEXT.md names the Catalogue
  - the old multi-tenancy spec is marked superseded by ADR 0008
  - README template references are updated
- [ ] Unused template assets in `public/` are removed. Assets the Website uses stay.
- [ ] Coverage thresholds are re-measured and ratcheted to just below the new baseline. CI's coverage step passes.
- [ ] The e2e smoke tests are updated: the dashboard, sign-up and sign-in pages each return 404; Home still renders; the a11y suite drops the sign-in page.
- [ ] Sad paths are tested: the removed routes 404; the middleware makes no Supabase call on Website routes and still sets the CSP; the callback without a code redirects Home safely.
- [ ] If any evidence shows the tenancy migration was applied to a hosted Supabase project, stop and report instead of deleting it.
