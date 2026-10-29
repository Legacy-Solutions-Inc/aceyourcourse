# Project skills

Docs-grounded **convention skills** — one per stack layer. Each distills the
layer's official standards, pinned to the version THIS repo has installed,
anchored to real files here, and citing canonical docs. They tell Claude how to
work _in this codebase_; they don't restate the docs.

TypeScript-strict and the **service-seam contract** are NOT duplicated here — they
live in [`AGENTS.md`](../../AGENTS.md); skills reference it.

Each skill is a directory with a `SKILL.md` (frontmatter `name` + `description`,
then: When to use · Version · Core standards · In this template · Red flags ·
Sources). Some carry a load-on-demand `references/` folder.

## Skills (batch 2A)

| Skill                                             | Covers                                                                                                            | Trigger (when it fires)                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`nextjs-app-router`](nextjs-app-router/SKILL.md) | App Router routing, Server/Client Components, Server Actions, middleware, metadata (Next 15 async APIs, React 19) | Working under `src/app/**` or `src/middleware.ts` — routes, pages, layouts, actions, rendering |
| [`tailwind-v4`](tailwind-v4/SKILL.md)             | Tailwind v4 CSS-first config, `@theme` tokens, semantic colors, class-based dark mode                             | Writing/changing styles, theme tokens, colors, dark mode, or `src/app/globals.css`             |
| [`shadcn-ui`](shadcn-ui/SKILL.md)                 | shadcn/ui CLI + copy-in primitives, `components.json`, `cn()`/`cva`, lucide icons                                 | Adding/updating/composing UI primitives or editing `src/components/ui/*`                       |
| [`supabase-auth`](supabase-auth/SKILL.md)         | `@supabase/ssr` clients, session refresh, route protection, `app_metadata` roles, auth-disabled mode              | Auth, sessions, cookies, gating, roles — `src/lib/supabase/*`, `src/lib/auth/*`, `authz*.ts`   |
| [`drizzle-data`](drizzle-data/SKILL.md)           | Drizzle behind the seam, mock-default selector, lazy client, `prepare:false` pooler, migrations                   | Data layer — `src/services/*`, `src/lib/db/*`, schema/migrations, `DATABASE_URL`               |

Sub-references: `nextjs-app-router/references/{react-19,server-actions}.md`,
`tailwind-v4/references/theming.md`,
`drizzle-data/references/drizzle-rls.md` (reference-only; future tenancy track).

## Skills (batch 2B)

| Skill                                           | Covers                                                                                                                    | Trigger (when it fires)                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [`forms-validation`](forms-validation/SKILL.md) | react-hook-form + zod, shadcn Form primitives, client + server (Server Action) validation                                 | Building/changing a form, field, validation rule, or the server check behind a submit      |
| [`data-tables`](data-tables/SKILL.md)           | TanStack Table v8 (headless) column defs, row models, filter/paginate/sort, rendered with shadcn `Table`                  | Building/changing a data table — columns, filtering, pagination, sorting                   |
| [`testing-unit`](testing-unit/SKILL.md)         | Vitest + React Testing Library + jsdom, accessible queries, coverage ratchet & offline excludes                           | Writing/changing `*.test.ts(x)` or `vitest.config.ts`                                      |
| [`testing-e2e`](testing-e2e/SKILL.md)           | Playwright specs, `webServer` + placeholder Supabase env, user-facing locators, axe a11y gates                            | Writing/changing Playwright specs under `e2e/**` or the Playwright config                  |
| [`anime-js`](anime-js/SKILL.md)                 | anime.js **v4** for complex timelines/SVG/scroll motion; RSC→client boundary, reduced-motion, CSP — **install-on-demand** | Needing JS-driven animation beyond CSS/`tw-animate-css` (add `animejs` only when required) |

> `anime-js` is **install-on-demand**: it is documented here but NOT a
> dependency — add `animejs` + `@types/animejs` only when a project needs it.

## Integrations

| Skill                         | Covers                                                                                                                                                                                                                                   | Trigger (when it fires)                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`posthog`](posthog/SKILL.md) | PostHog analytics (opt-in/inert by default), `/relay` reverse proxy + the middleware-matcher gotcha, client vs server feature flags (`evaluateFlags`), the replay `worker-src` CSP delta, privacy/consent, serverless flush/`shutdown()` | Analytics, product events, feature flags, session replay, or consent — `src/instrumentation-client.ts`, `src/lib/analytics/*`, `/relay` |

## Cross-cutting

| Skill                                               | Covers                                                                                                                                                                                                          | Trigger (when it fires)                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`coding-standards`](coding-standards/SKILL.md)     | Cross-cutting **12-category checker** — architecture, auth & authorization, data & RLS, web security (headers/CSP/cookies), TypeScript, React, UI, routing, testing, accessibility, lint/format/commits, docs   | Before calling any change done, reviewing a diff, or an explicit "check standards" request      |
| [`clean-architecture`](clean-architecture/SKILL.md) | Clean Architecture / SOLID / refactoring **methodology** — the Dependency Rule, DIP-at-the-seam, DTOs at boundaries — distilled for our service seam and reconciled with ADR 0003 (no textbook 4-layer rewrite) | Reviewing boundaries, dependency direction, module responsibilities, or the shape of a refactor |

## Global skills

This repo also relies on the **global** skills from the root
[`CLAUDE.md`](../../CLAUDE.md) — `prompt-architect` (the standing handoff rule) and
the superpowers workflow skills (`brainstorming`, `writing-plans`,
`test-driven-development`, `systematic-debugging`,
`verification-before-completion`), plus `code-review` — rather than duplicating
them here. Add a project skill only when a need is genuinely local to this repo.
