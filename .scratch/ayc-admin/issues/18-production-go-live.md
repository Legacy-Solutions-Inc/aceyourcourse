# 18 — Production go-live

**What to build:** Everything the user needs to switch production on safely: a runbook, plus the read-only checks it uses. The user runs every production step; the executer never touches production.

- **Database:** `supabase link` and `supabase db push`.
- **Seeding:** `pnpm catalogue:seed --production`, run once.
- **The first Owner:** `pnpm staff:add-owner <email>`.
- **Google sign-in:**
  - the Google Auth Platform setup
  - the Supabase Google provider
  - the URL configuration
  - Email turned off in the hosted project
- **Vercel env vars:**
  - the transaction pooler `DATABASE_URL` on port 6543
  - the publishable key and the secret key
  - the site URL
  - `MEMBER_APP_LIVE` left unset
- **A smoke checklist.**

**Blocked by:** 16 — Real Staff sign-in, 17 — Photo storage

**Status:** ready-for-agent

Spec: Implementation Decisions → Architecture, Phase 2 (Environments, Keys, Migrations, Catalogue goes real, Staff access); Further Notes (launch). ADR 0012 (Vercel and Supabase, Singapore). Conventions: §7.

- [ ] **The runbook** (`docs/runbooks/production.md`) is in order and copy-pasteable, with what to check after each step. It covers:
  - linking the project, and checking the Postgres version matches local
  - `db push`
  - the one-time seed
  - the first Owner
  - the Google OAuth client: the Google Auth Platform branding, audience (External, published), the openid, email and profile scopes, the Web client, its origins, and the redirect URI `https://<ref>.supabase.co/auth/v1/callback`
  - the Supabase Google provider, Email off, and the Site URL and redirect URLs
  - every Vercel env var, saying which are secret
  - a rollback note
- [ ] **`pnpm db:check`** is a read-only check against any `DATABASE_URL`. It reports:
  - migrations applied vs local
  - the deny-all status of every table
  - whether the bucket exists, with its limits
  - the catalogue counts

  It never writes and never prints secrets. Tested against local Supabase.

- [ ] **`catalogue:seed --production --check`** dry-runs the one-time seed: it validates and reports what would be inserted, without writing.
- [ ] **The smoke checklist:**
  - the Owner signs in with Google
  - invite an Editor, and the Editor signs in
  - edit a Product's price, and it's live on the Website
  - the Editor is refused Settings
  - a non-Staff Google account gets the 403 screen
  - the publishable key reads nothing through the REST API
  - photos load from Storage
- [ ] **Docs.** The README's environment table and `.env.example` match the final env vars. Nothing in the repo contains a real production secret, password or email address. A test greps tracked files for `sb_secret_`, `postgres://…:…@` with a password, and the like.
- [ ] **Sad paths:**
  - `db:check` exits 1 on a deny-all failure, with the offending table named
  - `--check` with a non-empty database reports "would refuse"
  - each script without `DATABASE_URL` exits 1 with a clear message
