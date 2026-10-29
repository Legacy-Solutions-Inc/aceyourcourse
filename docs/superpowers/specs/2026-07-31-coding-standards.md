# Coding standards — `aceyourcourse`

The cross-cutting standard the **`coding-standards`** checker skill enforces.
Grounded in the current (2025–2026) official docs for the stack — pulled and
gap-checked against the repo. Each rule is tagged **[tooling]** (an automated
gate: lint / tsc / test / build / CI) or **[review]** (human/Claude judgment
during review). Many `[review]` items can be _promoted_ to `[tooling]` — see the
remediation backlog at the end.

**How the checker uses this:** before a change is called done, or on an explicit
"check standards" request: (1) run `pnpm lint && pnpm type:check && pnpm test &&
pnpm build` and confirm green; (2) walk this checklist against the **changed
files** (diff-first). A whole-repo audit mode runs the same list across the tree
when explicitly asked. For layer depth, defer to the per-component skills
(`nextjs-app-router`, `supabase-auth`, `drizzle-data`, `testing-unit`, …) and
`AGENTS.md`; this file is the connective completeness list, not a re-teach.

---

## 1. Architecture & data flow [review]

- Data flows through the **server-only Data Access Layer / service seam**
  (`src/services/*`); components and Server Actions never touch Supabase, Drizzle,
  or `process.env` directly — **only the DAL reads env**.
- **Reads = RSC** (async/await in Server Components; never fetch initial data in
  `useEffect`). **Writes = thin Server Functions** that delegate to the DAL.
- Actions return **DTOs, not raw DB rows**. Model expected errors as return
  values (surfaced via `useActionState`); `throw` only for truly exceptional
  cases → `error.js`.
- New feature = copy the `customers` slice shape; seam signatures stay stable.
- Source: <https://nextjs.org/docs/app/guides/data-security>

## 2. Auth & authorization [review] (highest stakes)

- **Every Server Action and Route Handler is a public POST endpoint** — it must
  independently (a) re-authenticate, (b) **authorize the specific resource**
  (ownership check → prevents IDOR), and (c) zod-validate every argument. Page,
  layout, and middleware gating are **optimistic only**, never the enforcement
  point.
- Centralize the session check in one `verifySession()` memoized with React
  `cache()` inside the DAL; call it from RSCs, actions, and route handlers.
- Use a **revalidating** auth check — `getUser()` today (never `getSession()` /
  decoded cookies for authorization). Roles come from **`app_metadata.role`**
  only; never trust client-settable metadata.
- `authDisabled` is dev-only and **fails closed in production** — never widen it
  or gate real authz on `isSupabaseConfigured`.
- Rate-limit abusable actions (auth attempts, email, expensive writes).
- Sources: <https://nextjs.org/docs/app/guides/data-security> ·
  <https://nextjs.org/docs/app/guides/authentication> ·
  <https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html>

## 3. Data, Drizzle & RLS [review] + [tooling] (tests)

- **RLS enabled on every table** in an exposed schema. Scope each policy
  `TO authenticated`/`anon`, fail closed (`auth.uid() IS NOT NULL`), wrap
  `auth.uid()`/subqueries as `(select …)`, and index the policy columns.
- **Drizzle / postgres.js bypasses RLS** (a direct pooler connection runs as the
  table owner). Either scope tenancy explicitly in app-layer `WHERE` clauses, or
  `SET LOCAL request.jwt.claims` + `SET ROLE authenticated` per transaction so
  RLS applies. Decide this before multi-tenancy ships.
- Every RLS'd table gets a **cross-tenant denial test** [tooling] proving user A
  cannot read/write user B's rows.
- Prefer `SECURITY DEFINER` helper functions (never in an exposed schema).
- Sources: <https://supabase.com/docs/guides/database/postgres/row-level-security> ·
  <https://supabase.com/docs/guides/database/drizzle>

## 4. Web security: headers, CSP, cookies [tooling] + [review]

- Keep the strict **nonce + `strict-dynamic`** CSP; **no `unsafe-inline` /
  `unsafe-eval` in `script-src`** (dev-only `unsafe-eval` gated on `NODE_ENV`).
  `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`,
  `form-action 'self'`, `upgrade-insecure-requests`.
- **`style-src 'unsafe-inline'` is an accepted trade-off** — nonces/hashes cannot
  cover the inline `style="…"` attributes Radix/shadcn emit. Never widen inline
  to `script-src`.
- Ship the full header set: HSTS (prod, `max-age=63072000; includeSubDomains;
preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, deny-by-default `Permissions-Policy`,
  `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy:
same-site`, `poweredByHeader: false`. (COEP/`require-corp` is out of scope —
  it breaks cross-origin resources. Enforced Trusted Types is not feasible with
  React/Next today — report-only at most.)
- Auth cookies: `Secure` (prod) + `SameSite=Lax` + `Path=/`, no `Domain`
  (consider the `__Host-` prefix). No secrets in URLs / query strings.
- **Document the load-bearing rationale** so nobody "optimizes" it away: a nonce
  CSP **forces dynamic rendering** (no static/ISR/PPR/CDN-HTML caching), and
  `@supabase/ssr` cookies are **not `HttpOnly` by design** — so the strict
  `script-src` CSP is the **primary defense against session-token theft**.
- Sources: <https://web.dev/articles/strict-csp> ·
  <https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html> ·
  <https://nextjs.org/docs/app/guides/content-security-policy> ·
  <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>

## 5. TypeScript & type-safety [tooling] + [review]

- Honor the enabled flags **honestly**: `strict`, `noUncheckedIndexedAccess`
  (indexed access is `T | undefined` — guard/destructure, don't assume),
  `useUnknownInCatchVariables` (narrow `catch (e: unknown)` before use),
  `isolatedModules` (use `import type` for type-only imports),
  `moduleResolution: bundler` + `@/*` alias (no deep relative chains).
- **No `any`** (→ `unknown` + narrow), **no non-null `!`**, **no `as`** used to
  silence a real error. Prefer discriminated unions, `satisfies`, `as const`, and
  `never`-based exhaustiveness.
- **zod is the single source of truth**: `z.infer` for types, `safeParse` at
  boundaries (form/action input, external responses), `parse` at boot (env).
- Read env via the typed `env` / `serverEnv`, never `process.env.X!`. Avoid
  internal barrel (`index.ts`) re-exports (tree-shaking + import-cycle cost).
- Sources: <https://www.typescriptlang.org/tsconfig/> ·
  <https://typescript-eslint.io/rules/>

## 6. React & component architecture [review]

- `"use client"` on **interactive leaves only** — keep layouts/pages as Server
  Components; a `"use client"` file pulls all its imports into the client bundle.
- Compose by passing **Server Components as `children`/props** into client
  wrappers; only **serializable** data crosses the boundary (no functions/class
  instances/raw DB records — pass narrow prop interfaces).
- React 19: **`ref` as a normal prop** (no `forwardRef`), `<Context>` as provider
  (no `<Context.Provider>`), `useActionState` (not `useFormState`),
  `useFormStatus`, `useOptimistic`, `use()` for reading promises/context.
- Reject the anti-patterns: effect-for-data-fetch, derived-state-mirrored-in-
  state, cascading effect chains, array-index keys on dynamic/reorderable lists,
  whole-tree `"use client"`, providers wrapping the whole `<html>`.
- Place `<Suspense>`/`loading.js` at the loading sequence you actually want;
  parallelize independent awaits with `Promise.all`.
- Sources: <https://react.dev/blog/2024/12/05/react-19> ·
  <https://nextjs.org/docs/app/getting-started/server-and-client-components> ·
  <https://react.dev/learn/you-might-not-need-an-effect>

## 7. UI & styling [review]

- **shadcn/ui + Tailwind v4 only** — no other UI kit. Add primitives with
  `pnpm dlx shadcn@latest add <name>`; compose with `cn()`.
- Tokens and dark mode via `@theme` CSS variables in `globals.css` — **no
  `tailwind.config.js`**, no hard-coded hex where a token exists. Let
  `prettier-plugin-tailwindcss` sort classes; respect `prefers-reduced-motion`.
- Depth: `tailwind-v4` / `shadcn-ui` skills.

## 8. Routing & config [review]

- Never hard-code paths — use `src/paths.ts`. App config → `src/config.ts`.
  Env → `src/env.ts` (client) / `src/env.server.ts` (server-only) + `.env.example`.

## 9. Testing [tooling] + [review]

- **Add a test when you add behavior**; TDD (red→green) for pure logic.
- RTL: query by user-facing role/label first (`getByRole`/`ByLabelText`,
  test-ids last resort); `userEvent.setup()` + `await`; `queryBy*` for absence,
  `findBy*` for async appearance; use `screen` + `@testing-library/jest-dom`; no
  manual `act`/`cleanup`; `waitFor` callbacks single-assertion, side-effect-free.
- Playwright: user-facing locators + **web-first assertions**
  (`await expect(locator).toBeVisible()`); **no `waitForTimeout`**; test
  isolation; `trace: 'on-first-retry'`; mock third parties (network), no real
  external calls; deterministic (no wall-clock / `Math.random`).
- Don't lower the coverage ratchet to pass; exclude only genuinely-unrunnable
  code, documented. Coverage measures executed lines, not assertion quality.
- Sources: <https://testing-library.com/docs/guiding-principles> ·
  <https://playwright.dev/docs/best-practices>

## 10. Accessibility [tooling] + [review]

- axe **zero violations** [tooling] (labels, discernible names, color contrast
  4.5:1 text / 3:1 large & UI, `html lang`, one `<title>`, heading order, valid
  ARIA — prefer native semantics over ARIA).
- **Plus a documented manual gate** [review] for what axe cannot catch (~57%
  ceiling): focus order + visible focus, full keyboard operability (no traps),
  meaningful reading sequence, and whether alt text is _meaningful_.
- Target **WCAG 2.2 AA**, including net-new criteria: target size ≥ 24×24px,
  focus-not-obscured, dragging alternative, accessible authentication (allow
  paste / password managers), redundant entry, consistent help. Hold at **AA**,
  not AAA; don't target obsolete **4.1.1 Parsing**.
- Sources: <https://www.w3.org/WAI/standards-guidelines/wcag/> ·
  <https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/> ·
  <https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md>

## 11. Formatting, lint & commits [tooling]

- **TypeScript** is the type authority (`pnpm type:check` = `tsc --noEmit`).
- **ESLint** (`pnpm lint`) — flat config extends `next/core-web-vitals` +
  `next/typescript`. NOTE the current regression: `@typescript-eslint/no-unused-vars`
  is **off** and tsconfig sets no `noUnusedLocals`, so **nothing flags unused
  imports/vars** — remove dead code yourself until that's fixed (see backlog T1).
- **Prettier** owns formatting (`pnpm format`): double quotes, semicolons,
  `trailingComma: "all"`, `printWidth: 100`, tailwind class auto-sort. Don't
  hand-format or add stylistic ESLint rules.
- **Commits are gated**: husky `pre-commit` runs `lint-staged` (`eslint --fix` +
  `prettier --write` on staged files) then `pnpm type:check`; `commit-msg` runs
  commitlint. Messages must be **Conventional Commits** (lowercase subject, no
  trailing period). **Branch off `main`; never commit to `main`.** Never bypass
  hooks with `--no-verify`.
- **Definition of done**: `pnpm lint && pnpm type:check && pnpm test && pnpm build`
  all green.
- Sources: <https://www.typescriptlang.org/tsconfig> ·
  <https://nextjs.org/docs/app/api-reference/config/eslint> ·
  <https://prettier.io/docs/options> · <https://www.conventionalcommits.org/en/v1.0.0/>

## 12. Docs & decisions [review]

- Hard-to-reverse choices → a **new ADR** (don't edit existing ADRs). Domain
  terms → `CONTEXT.md`. `AGENTS.md` stays the source for cross-cutting rules;
  skills reference it.

---

## Remediation backlog (template divergences the research found)

The checker documents the target; these bring the repo to it. Separate from the
skill.

| #   | Fix                                                                                                                                                | Effort | Status             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------ |
| S1  | Supabase clients: deprecated `get/set/remove` → `getAll`/`setAll`                                                                                  | Low    | in Handoff #5      |
| S4  | CSP: `base-uri 'none'` + `upgrade-insecure-requests`                                                                                               | Low    | in Handoff #5      |
| S5  | `next.config`: `poweredByHeader:false`, COOP, CORP, wider Permissions-Policy                                                                       | Low    | in Handoff #5      |
| T1  | ESLint: turn `no-unused-vars` back on (`^_` ignore)                                                                                                | Low    | in Handoff #5      |
| S2  | In-action authz + ownership + DTO returns via DAL                                                                                                  | Med    | backlog            |
| S3  | Drizzle-vs-RLS decision + cross-tenant RLS tests                                                                                                   | Med    | backlog (needs DB) |
| T2  | Typed linting → `no-floating-promises`, `switch-exhaustiveness-check`, `no-non-null-assertion`, import-cycle/alias rules; low-noise tsconfig flags | Med    | backlog            |
| Q1  | Test/a11y lint plugins (`testing-library`, `playwright`, `jsx-a11y`)                                                                               | Med    | backlog            |
| C1  | Supabase project: asymmetric JWT keys; `__Host-` cookie prefix                                                                                     | Low    | backlog (config)   |
