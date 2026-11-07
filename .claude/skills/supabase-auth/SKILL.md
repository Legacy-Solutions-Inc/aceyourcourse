---
name: supabase-auth
description: Use when working on authentication, sessions, cookies, route protection, or authorization — touching src/lib/supabase/*, src/lib/auth/*, src/lib/session-routes.ts, the OAuth callback, or the session refresh in src/middleware.ts.
---

# Supabase auth (this repo)

## 1. When to use

Anything auth: Google sign-in (from Phase 2), session refresh, protecting
routes, reading the current user, or authorization checks. Auth is the ONE thing wired directly to Supabase
(ADR 0002); everything else goes through the service seam (see **drizzle-data**).

## 2. Version

- `@supabase/ssr` **0.6.1**, `@supabase/supabase-js` **2.49.4** (from
  `package.json` / installed).
- Env vars used here: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (validated in `src/env.ts`; both `.optional()` so the app runs with auth
  disabled). There is no fallback to the old anon key name. The server-only
  `SUPABASE_SECRET_KEY` (`src/env.server.ts`) is for Storage only.

## 3. Core standards

**Three client-creation contexts** with `@supabase/ssr`:

- **Browser** (Client Components) → `createBrowserClient(url, publishableKey)`.
- **Server** (Server Components, Server Actions, Route Handlers) →
  `createServerClient(url, publishableKey, { cookies })` bound to Next's `cookies()`.
- **Middleware** → `createServerClient` bound to `req`/`res` cookies, so it can
  refresh the session and write cookies back.

**Cookie adapter.** `@supabase/ssr` needs a cookies adapter. Current Supabase
docs use `getAll`/`setAll`; **this repo uses the `get`/`set`/`remove` shape**
(still supported in 0.6.x) in `server.ts` and `middleware.ts`. Match the existing
shape when editing those files.

**Authorize with `getUser()`, never `getSession()` in server code.**
`getSession()` reads the cookie without contacting the Auth server and is not safe
for authorization. `supabase.auth.getUser()` revalidates the token — use it to
gate pages/actions/middleware. (Newer setups may use `getClaims()` for local JWT
verification; this repo standardizes on `getUser()`.)

**Session refresh in middleware.** Server Components can't write cookies, so
middleware refreshes the token on every session route (`needsSession`) and must
persist the refreshed cookies onto BOTH the request (for downstream reads) and
the response (back to the browser).

**Authorization comes from the server, never client-settable metadata.** From
Phase 2, Staff access is decided on the server from the staff list (a table keyed
by email with Staff Role `owner` or `editor`), not auth `app_metadata` (ADR
0008). **Never trust client-supplied metadata** (`user_metadata` is
user-editable). The template's `app_metadata.role` helpers (`authz.ts`,
`RoleGuard`) are retired; they live in git history at commit `aea34ea`.

**Configured-or-disabled.** When Supabase env vars are absent the app runs with
auth **disabled in development** (browsable) but **fails closed in production**
(Phase 2's Member App and Admin gates must keep their routes shut). This policy
lives in `src/config.ts`.

## 4. In this template

- `src/lib/supabase/client.ts` — `createBrowserClient` for Client Components.
- `src/lib/supabase/server.ts` — `createServerClient` bound to `cookies()`, with
  the repo's cookie options (`sb`, `sameSite: lax`, secure in prod) and
  `get`/`set`/`remove`.
- `src/lib/supabase/middleware.ts` — `createServerClient` over `req`/`res`;
  rebuilds the response on each cookie write so refreshed cookies survive; also
  threads the CSP nonce (see **nextjs-app-router**).
- `src/lib/auth/session.ts` — `getSession()` returns the `User` via
  `supabase.auth.getUser()`, or `null` when Supabase isn't configured.
- `src/config.ts` — `isSupabaseConfigured`, `computeAuthDisabled`, `authDisabled`
  (dev bypass; prod fail-closed with a loud warning).
- `src/lib/session-routes.ts` — `needsSession()`: only `/app`, `/admin` and
  `/auth` need a session; every other route is the public Website.
- `src/middleware.ts` — sets the CSP everywhere and refreshes the session on the
  session routes only. It gates nothing yet; Phase 2 adds the Member App and
  Admin gates.
- `src/app/auth/callback/route.ts` — OAuth code-exchange callback; honours a
  same-origin `next` only, otherwise lands on Home. The sign-out action is in
  `src/lib/auth/actions.ts`. There are no email/password screens (ADR 0008).

## 5. Red flags

- Using `getSession()` (or trusting a decoded cookie) for authorization in server
  code — use `getUser()`.
- Authorizing from `user_metadata`, `app_metadata` or any client-settable value —
  authorize on the server from the staff list (ADR 0008).
- Creating a server/middleware Supabase client without the cookie adapter, or
  failing to write refreshed cookies back to the response — sessions won't
  refresh.
- Putting the service-role key in the client or a `NEXT_PUBLIC_*` var.
- Routing app (non-auth) data through Supabase directly instead of the seam.
- Assuming auth is enforced when Supabase is unconfigured — it's a dev-only
  bypass; verify prod env is set (prod fails closed).

## 6. Sources

- Server-side auth for Next.js — https://supabase.com/docs/guides/auth/server-side/nextjs
- Creating a client (`@supabase/ssr`) — https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Sessions & `getUser` vs `getSession` — https://supabase.com/docs/guides/auth/sessions
- User metadata / `app_metadata` — https://supabase.com/docs/guides/auth/managing-user-data
