# 16 — Real Staff sign-in

**What to build:** Staff sign in with Google through Supabase.

- **The new mode.** `computeAdminMode` gains `"live"`, used when the database and Supabase are both configured.
- **In live mode:**
  - "Continue with Google" starts the Supabase OAuth flow and returns through `/auth/callback`.
  - The Guard reads the verified Google email and name, then checks the staff list.
  - The "Sign in as" list is gone.
- **`pnpm staff:add-owner <email>`** adds the first Owner at deployment.
- **Tests.** e2e signs in with local password Users, which exist only in the local config, using the local secret key. The app gets no test route.

**Blocked by:** 15 — Admin writes on the database

**Status:** ready-for-agent

> **Planner note, 2026-11-04.**
>
> - There's no Docker on the user's machine. `pnpm dev` uses the hosted project, and no test touches it.
> - Locally, e2e runs on the in-memory sample data.
> - The live-mode e2e and the database tests below are met in CI, against a local Supabase on the runner.
> - The prompt has the details.

Spec: Phase 2 stories 51–58; Implementation Decisions → Phase 2 (Staff access, Invites, Seams: Staff Guard, Environments); Testing Decisions → Seam 5 (Admin). Conventions: §1 (mode), §3 (Staff Guard, identity). Skills: supabase-auth, supabase.

- [ ] **The mode has a pure test:**
  - development without the database stays "sample"
  - development with the database and Supabase is "live"
  - production with them is "live"
  - production without them is "closed"
- [ ] **Sign-in flow.** The live sign-in calls `signInWithOAuth` with Google, PKCE, and `redirectTo` pointing at `/auth/callback?next=…`. The `next` value is sanitised the same way as ticket 01. The callback exchanges the code and lands on `next`.
- [ ] **"Use another account"** signs out, then sends Google `prompt=select_account`.
- [ ] **The Guard's Supabase arm:**
  - It uses `getUser()`, never `getSession()`, for decisions.
  - It requires a verified email.
  - It matches the staff list case-insensitively.
  - It activates an Invite and records denied sign-ins, as the sample arm does.
  - It takes the display name from the Google profile, for display only.
  - It never uses `user_metadata` for authorisation.
- [ ] **The middleware** refreshes the Supabase session for `/admin` in live mode only. Public pages still make no Supabase call.
- [ ] **`pnpm staff:add-owner <email>`:**
  - validates the email
  - creates, or upgrades to, an active Owner entry
  - is idempotent
  - records Staff Activity with the actor "deployment"
  - never prints `DATABASE_URL`
  - refuses when `DATABASE_URL` isn't set
- [ ] **Local auth config** (`supabase/config.toml`, local only):
  - the Google provider reads its client id and secret from env, e.g. `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)`
  - email/password sign-in is enabled for test Users
  - the redirect URLs include the local callback

  The README notes that the hosted project has Google only, with Email turned off.

- [ ] **e2e** creates the sample staff as local auth Users with the local secret key (admin API), then signs in by password from the test and writes the `@supabase/ssr` session cookie into the browser context. Every Stage A Admin sign-in journey passes in live mode.
- [ ] **Sad paths:**
  - Google not configured locally shows "Google sign-in isn't set up on this server", with no crash
  - an unverified email is denied
  - a callback with no code, or a bad code, returns to sign-in with an error message
  - a removed Staff User is denied on their next request
  - live mode never honours the sample cookie
  - `staff:add-owner` with an invalid email exits 1
