---
name: nextjs-app-router
description: Use when adding or changing routes, pages, layouts, Server/Client Components, Server Actions, middleware, or metadata in this Next.js 15 App Router app — i.e. anything under src/app/** or src/middleware.ts.
---

# Next.js App Router (this repo)

## 1. When to use

Any work touching `src/app/**`, `src/middleware.ts`, routing, rendering, data
reads/writes at the page/action level, or metadata. Pair with **supabase-auth**
for gating, **drizzle-data**/the service seam for data, and **forms-validation**
(batch 2B) for the write path.

## 2. Version

- `next` **15.5.20**, `react` **19.1.0**, `react-dom` **19.1.0** (from
  `package.json` / installed in `node_modules`).
- TypeScript strict is repo-wide — see [`AGENTS.md`](../../../AGENTS.md); this
  skill does not restate it.

## 3. Core standards

**Server Components are the default.** Layouts and pages render on the server —
fetch data close to the source, keep secrets server-side, ship less JS. Reach for
`"use client"` ONLY when you need state/effects, event handlers, browser APIs, or
React context. `"use client"` marks a _boundary_: every module it imports and
every component it directly renders is pulled into the client bundle, so push it
as deep in the tree as possible.

**Next 15 async request APIs — await them.** `headers()`, `cookies()`, and
`draftMode()` are async; `params` and `searchParams` are `Promise`s in pages,
layouts, and route handlers. Always `await` them. Reading any of these opts the
route into **dynamic rendering**.

**Reads = RSC, writes = Server Actions** (the repo contract, in `AGENTS.md`):

- Read data in a Server Component through the service seam (`src/services/*`),
  never by calling Supabase/the DB directly from a component.
- Mutate in a `"use server"` action: validate input with `zod` FIRST, call the
  seam, then `revalidatePath`/`revalidateTag`, then `redirect`.
- Server Actions are real POST endpoints reachable directly, not only via your
  UI — **re-check auth/authz inside every action**.
- `redirect()` throws a framework control-flow exception; nothing after it runs,
  so revalidate before calling it.

**Environment isolation.** Only `NEXT_PUBLIC_*` vars reach the client; others are
replaced with `""` in the client bundle. Guard server-only modules with
`import "server-only"` (used by the DB layer — see **drizzle-data**).

**Metadata.** Use the Metadata API (`export const metadata` / `generateMetadata`)
rather than hand-writing `<head>`; the root layout sets `metadataBase`, a title
template, and OpenGraph/Twitter defaults.

## 4. In this template

- `src/app/layout.tsx` — root layout `await headers()` on purpose: it forces
  every route to render dynamically so the per-request CSP nonce (below) applies
  to Next's own framework scripts. It also declares the `metadata` object and
  wraps children in the client `ThemeProvider` + `Toaster` (the only client
  boundary in the shell).
- `src/middleware.ts` + `src/lib/csp.ts` — Edge middleware mints a per-request
  nonce with Web Crypto (`btoa(crypto.randomUUID())`, no Node `Buffer`), builds a
  strict nonce CSP via the pure `buildCsp()`, threads it onto forwarded request
  headers AND the response, and does auth gating. The `matcher` excludes static
  assets. Middleware runs on the Edge runtime — Web APIs only.
- `src/app/dashboard/customers/page.tsx` — reference RSC read: `await
searchParams`, then `listCustomers({ q, pageSize })` through the seam.
- `src/app/dashboard/customers/actions.ts` — reference writes: `"use server"`,
  `zod` schema parse → seam call → `revalidatePath(...)` → `redirect(...)`,
  returning a `CustomerFormState` for `useActionState`.
- `src/app/dashboard/customers/[customerId]/page.tsx` — `await params`, seam
  `getCustomer`, `notFound()` when missing.
- `src/paths.ts` — the single typed route registry; link and redirect through it.

See [`references/react-19.md`](references/react-19.md) for the React 19 features
the write path relies on, and [`references/server-actions.md`](references/server-actions.md)
for the action ↔ form wiring pattern.

## 5. Red flags

- Using `headers()`/`cookies()`/`params`/`searchParams` synchronously — removed
  in Next 15; must be awaited.
- Calling Supabase or Drizzle directly from a component instead of the seam.
- A Server Action that mutates without validating input or without re-checking
  auth (actions are directly reachable POST endpoints).
- Hard-coding route strings instead of `src/paths.ts`.
- Putting `"use client"` high in the tree and dragging server-only code / large
  deps into the client bundle.
- Reading a non-`NEXT_PUBLIC_*` secret from a Client Component.
- Making a page static that needs the nonce — the root layout is dynamic by
  design; do not "optimize" that away.

## 6. Sources

- Server and Client Components — https://nextjs.org/docs/app/getting-started/server-and-client-components
- Mutating data (Server Functions/Actions) — https://nextjs.org/docs/app/getting-started/mutating-data
- Server Actions guide — https://nextjs.org/docs/app/guides/server-actions
- `revalidatePath` — https://nextjs.org/docs/app/api-reference/functions/revalidatePath
- `redirect` — https://nextjs.org/docs/app/api-reference/functions/redirect
- Metadata API — https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- React 19 release — https://react.dev/blog/2024/12/05/react-19
