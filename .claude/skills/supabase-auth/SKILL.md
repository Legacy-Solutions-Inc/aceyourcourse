---
name: supabase-auth
description: Use when working on authentication, sessions, cookies, route protection, or roles — touching src/lib/supabase/*, src/lib/auth/*, src/lib/authz*.ts, the auth routes, or the auth gating in src/middleware.ts.
---

# Supabase auth (this repo)

## 1. When to use

Anything auth: sign-in/up flows, session refresh, protecting routes, reading the
current user, or role checks. Auth is the ONE thing wired directly to Supabase
(ADR 0002); everything else goes through the service seam (see **drizzle-data**).

## 2. Version

- `@supabase/ssr` **0.6.1**, `@supabase/supabase-js` **2.49.4** (from
  `package.json` / installed).
- Env vars used here: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (validated in `src/env.ts`; both `.optional()` so the app runs with auth
  disabled).

## 3. Core standards

**Three client-creation contexts** with `@supabase/ssr`:

- **Browser** (Client Components) → `createBrowserClient(url, anonKey)`.
- **Server** (Server Components, Server Actions, Route Handlers) →
  `createServerClient(url, anonKey, { cookies })` bound to Next's `cookies()`.
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
middleware refreshes the token on every matched request and must persist the
refreshed cookies onto BOTH the request (for downstream reads) and the response
(back to the browser).

**Roles come from server-set metadata.** Read the role from the user's
`app_metadata.role` — set via the service-role key or a SQL trigger. **Never
trust client-supplied metadata** (`user_metadata` is user-editable).

**Configured-or-disabled.** When Supabase env vars are absent the app runs with
auth **disabled in development** (browsable) but **fails closed in production**
(protected routes redirect to sign-in). This policy lives in `src/config.ts`.

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
- `src/lib/authz.ts` — pure, **edge-safe** primitives: `ROLES`, `DEFAULT_ROLE`
  (`member`), `roleFromUser` (reads `app_metadata.role`), `hasRole`.
- `src/lib/authz.server.ts` — server-only `getRole()` / `requireRole(...)` that
  redirect; honors `authDisabled`.
- `src/config.ts` — `isSupabaseConfigured`, `computeAuthDisabled`, `authDisabled`
  (dev bypass; prod fail-closed with a loud warning).
- `src/middleware.ts` — refreshes the session, protects `/dashboard`, gates
  role-restricted areas, and keeps signed-in users off the auth screens.
- `src/app/auth/callback/route.ts` — OAuth/code-exchange callback; other auth
  screens live under `src/app/auth/*`, actions in `src/lib/auth/actions.ts`.

## 5. Red flags

- Using `getSession()` (or trusting a decoded cookie) for authorization in server
  code — use `getUser()`.
- Reading a role from `user_metadata` or any client-supplied value — use
  server-set `app_metadata.role`.
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
