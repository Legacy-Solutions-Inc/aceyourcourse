---
name: coding-standards
description: Use before calling any change done, when reviewing a diff, or on an explicit "check standards" request — the cross-cutting checklist across architecture, auth & authorization, data & RLS, web security (headers/CSP/cookies), TypeScript, React, UI, routing, testing, accessibility, lint/format/commits, and docs. Not just lint/format.
---

# Coding standards — checker (this repo)

The cross-cutting completeness checklist for `aceyourcourse`. It sits ABOVE the
per-component skills: this file is the connective list of what "done" means across
every layer; the per-component skills carry the depth. Rules are tagged
**[tooling]** (an automated gate — lint / tsc / test / build) or **[review]**
(Claude/human judgment on the diff). Distilled from
`docs/superpowers/specs/2026-07-31-coding-standards.md`; defer to that spec and
`AGENTS.md` for rationale.

## When to use

- Before calling ANY change done (self-review the diff).
- When reviewing a branch/PR/diff.
- On an explicit "check standards" / "does this follow our conventions" request.

## How to check

1. **Gate [tooling]** — run and confirm green:
   `pnpm lint && pnpm type:check && pnpm test && pnpm build`. (Playwright e2e
   `pnpm test:e2e` when the change touches routing/auth/UI paths.)
2. **Walk the Checklist against the CHANGED files (diff-first)** — only the
   categories the diff touches, but never skip Auth or Web-security when the diff
   is near them.
3. **Whole-repo audit mode** — run the full checklist across the tree ONLY when
   explicitly asked; it is slower and noisier than the diff-first default.

Report findings by category with `[tooling]`/`[review]` tags; cite files by path.

## Checklist

### 1. Architecture & data flow [review]

- Data flows through the server-only **service seam** (`src/services/*`);
  components/Server Actions never touch Supabase, Drizzle, or `process.env`
  directly — only the seam reads env. → **drizzle-data**, **nextjs-app-router**,
  **clean-architecture** (dependency direction / boundaries).
- Reads = RSC (`async`/`await` in Server Components, not `useEffect`); writes =
  thin Server Actions delegating to the seam.
- Actions return DTOs, not raw DB rows; model expected errors as return values
  (`useActionState`), `throw` only for the exceptional → `error.js`.
- New feature copies the `customers` slice; seam signatures stay stable.

### 2. Auth & authorization [review] — highest stakes

- Every Server Action / Route Handler is a public POST endpoint: it must
  independently **re-authenticate**, **authorize the specific resource**
  (ownership check → prevents IDOR), and **zod-validate every argument**. Page /
  layout / middleware gating is optimistic only. → **supabase-auth**,
  **forms-validation**.
- Authorize with a **revalidating** check — `getUser()` today, **never
  `getSession()`** or decoded cookies. Roles from **`app_metadata.role`** only.
- `authDisabled` is dev-only and **fails closed in production**; never widen it or
  gate real authz on `isSupabaseConfigured`.
- Rate-limit abusable actions (auth, email, expensive writes). [review]

### 3. Data, Drizzle & RLS [review] + [tooling]

- **RLS enabled on every exposed-schema table**; policies scoped
  `TO authenticated`/`anon`, fail closed (`auth.uid() IS NOT NULL`),
  `auth.uid()`/subqueries wrapped `(select …)`, policy columns indexed.
- **Drizzle/postgres.js bypasses RLS** (direct pooler = table owner): scope
  tenancy in app-layer `WHERE`, or `SET LOCAL request.jwt.claims` + `SET ROLE`
  per txn. Decide before multi-tenancy ships. → **drizzle-data**.
- Every RLS'd table gets a **cross-tenant denial test** [tooling] (A cannot
  read/write B's rows). Prefer `SECURITY DEFINER` helpers (not in an exposed schema).

### 4. Web security: headers, CSP, cookies [tooling] + [review]

- Keep the strict **nonce + `strict-dynamic`** CSP; **no `unsafe-inline`/
  `unsafe-eval` in `script-src`** (dev-only `unsafe-eval` gated on `NODE_ENV`).
  `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`,
  `form-action 'self'`, `upgrade-insecure-requests` (prod). → **supabase-auth** (nonce),
  `src/lib/csp.ts`.
- `style-src 'unsafe-inline'` is an accepted trade-off (Radix/shadcn inline
  styles); **never widen inline to `script-src`**.
- Full header set: HSTS (prod), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, deny-by-default
  `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`,
  `Cross-Origin-Resource-Policy: same-site`, `poweredByHeader: false`. No
  COEP/`require-corp`.
- Auth cookies: `Secure` (prod) + `SameSite=Lax` + `Path=/`, no `Domain`; no
  secrets in URLs/query strings.
- **Load-bearing rationale [review]:** the nonce CSP forces dynamic rendering, and
  `@supabase/ssr` cookies are not `HttpOnly` — so the strict `script-src` is the
  primary defense against session-token theft. Don't "optimize" it away.

### 5. TypeScript & type-safety [tooling] + [review]

- Honor the enabled flags honestly: `strict`, `noUncheckedIndexedAccess`
  (guard/destructure indexed access), `useUnknownInCatchVariables` (narrow
  `catch`), `isolatedModules` (`import type`), `moduleResolution: bundler` + `@/*`
  (no deep relative chains).
- **No `any`** (→ `unknown` + narrow), **no non-null `!`**, **no `as`** to silence
  a real error. Prefer discriminated unions, `satisfies`, `as const`,
  `never`-exhaustiveness.
- **zod is the single source of truth**: `z.infer` for types, `safeParse` at
  boundaries, `parse` at boot (env). Read env via typed `env`/`serverEnv`, never
  `process.env.X!`.

### 6. React & component architecture [review]

- `"use client"` on **interactive leaves only**; a client file pulls all its
  imports into the client bundle. Compose Server Components as `children`/props;
  only serializable data crosses the boundary. → **nextjs-app-router**,
  **shadcn-ui**.
- React 19: `ref` as a normal prop (no `forwardRef`), `<Context>` as provider,
  `useActionState` (not `useFormState`), `useFormStatus`, `useOptimistic`, `use()`.
- Reject: effect-for-data-fetch, state-mirroring-derived-state, cascading effects,
  array-index keys on reorderable lists, whole-tree `"use client"`, providers
  wrapping `<html>`. Place `<Suspense>`/`loading.js` deliberately; `Promise.all`
  independent awaits.

### 7. UI & styling [review]

- **shadcn/ui + Tailwind v4 only** — no other kit; add via
  `pnpm dlx shadcn@latest add <name>`; compose with `cn()`. → **shadcn-ui**,
  **tailwind-v4**.
- Tokens/dark mode via `@theme` in `globals.css` — **no `tailwind.config.js`**, no
  hard-coded hex where a token exists; let `prettier-plugin-tailwindcss` sort
  classes; respect `prefers-reduced-motion` (→ **anime-js**).

### 8. Routing & config [review]

- Never hard-code paths — use `src/paths.ts`. App config → `src/config.ts`. Env →
  `src/env.ts` (client) / `src/env.server.ts` (server-only) + `.env.example`.

### 9. Testing [tooling] + [review]

- **Add a test when you add behavior**; TDD (red→green) for pure logic. →
  **testing-unit**, **testing-e2e**.
- RTL: user-facing `getByRole`/`getByLabelText` first (test-ids last),
  `userEvent.setup()` + `await`, `queryBy*` for absence / `findBy*` for async, no
  manual `act`/`cleanup`.
- Playwright: user-facing locators + web-first assertions; **no `waitForTimeout`**;
  isolated, deterministic; mock third parties.
- **Don't lower the coverage ratchet to pass**; exclude only genuinely-unrunnable
  code, documented.

### 10. Accessibility [tooling] + [review]

- axe **zero violations** [tooling] (labels/names, contrast 4.5:1 text / 3:1 large
  & UI, `html lang`, one `<title>`, heading order, valid ARIA — native over ARIA).
- **Manual gate [review]** for what axe can't catch: focus order + visible focus,
  full keyboard operability (no traps), meaningful reading order, meaningful alt.
- Target **WCAG 2.2 AA** (incl. target size ≥24×24, focus-not-obscured, dragging
  alternative, accessible auth / allow paste, redundant entry, consistent help);
  hold at AA, skip obsolete 4.1.1 Parsing. → **testing-e2e** (axe gate).

### 11. Formatting, lint & commits [tooling]

- **TypeScript** is the type authority (`pnpm type:check` = `tsc --noEmit`).
- **ESLint** (`pnpm lint`) — flat config extends `next/core-web-vitals` +
  `next/typescript`; `@typescript-eslint/no-unused-vars` is **on** (`error`, with
  `^_` ignore for intentional throwaways) — fix dead code, don't disable it.
- **Prettier** owns formatting (`pnpm format`): double quotes, semicolons,
  `trailingComma: "all"`, `printWidth: 100`, tailwind class auto-sort. Don't
  hand-format or add stylistic ESLint rules.
- **Commits gated**: husky `pre-commit` = `lint-staged` (`eslint --fix` +
  `prettier --write`) then `pnpm type:check`; `commit-msg` = commitlint. Messages
  are **Conventional Commits** (lowercase subject, no trailing period). **Branch
  off `main`; never commit to `main`; never `--no-verify`.**

### 12. Docs & decisions [review]

- Hard-to-reverse choices → a **new ADR** (don't edit existing ADRs). Domain terms
  → `CONTEXT.md`. `AGENTS.md` stays the source for cross-cutting rules; skills
  reference it.

## Red flags (never ship)

- A Server Action/Route Handler missing **in-action authz / ownership** check
  (IDOR), or authorizing via `getSession()`/decoded cookies.
- Weakening the CSP — any `unsafe-inline`/`unsafe-eval` in `script-src`, or
  removing the nonce / dynamic rendering that protects the non-`HttpOnly` session.
- Secrets in a Client Component, a `NEXT_PUBLIC_*` var, or a URL/query string.
- **RLS off** on an exposed table, or Drizzle reading/writing tenant data without
  scoping (it bypasses RLS).
- Trusting client-set metadata for roles; widening `authDisabled` or gating real
  authz on `isSupabaseConfigured`.
- `any`/`!`/`as`-to-silence, or `process.env.X!` instead of typed `env`.
- Lowering the coverage ratchet or shipping axe violations to go green.

## See also

Per-component skills for depth: **nextjs-app-router**, **tailwind-v4**,
**shadcn-ui**, **supabase-auth**, **drizzle-data**, **forms-validation**,
**data-tables**, **testing-unit**, **testing-e2e**, **anime-js**. Cross-cutting
rules (TS-strict, service seam, commits/branching): [`AGENTS.md`](../../../AGENTS.md).

## Sources

- Next.js data security — https://nextjs.org/docs/app/guides/data-security
- Next.js authentication — https://nextjs.org/docs/app/guides/authentication
- OWASP IDOR prevention — https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html
- Supabase RLS — https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase + Drizzle — https://supabase.com/docs/guides/database/drizzle
- Strict CSP — https://web.dev/articles/strict-csp
- OWASP HTTP headers — https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- Next.js CSP — https://nextjs.org/docs/app/guides/content-security-policy
- OWASP session management — https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- TypeScript tsconfig — https://www.typescriptlang.org/tsconfig/
- typescript-eslint rules — https://typescript-eslint.io/rules/
- React 19 — https://react.dev/blog/2024/12/05/react-19
- Server & Client Components — https://nextjs.org/docs/app/getting-started/server-and-client-components
- You Might Not Need an Effect — https://react.dev/learn/you-might-not-need-an-effect
- Testing Library guiding principles — https://testing-library.com/docs/guiding-principles
- Playwright best practices — https://playwright.dev/docs/best-practices
- WCAG — https://www.w3.org/WAI/standards-guidelines/wcag/
- What's new in WCAG 2.2 — https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- axe rule descriptions — https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md
- Conventional Commits — https://www.conventionalcommits.org/en/v1.0.0/
