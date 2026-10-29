# Phase 1 (Website): tickets and executer prompts

Source: [`docs/specs/2026-10-29-ayc-v1.md`](../../docs/specs/2026-10-29-ayc-v1.md) (Phase 1), [`CONTEXT.md`](../../CONTEXT.md), ADRs 0008–0012, [`docs/mockup/website/BUILD-MAP.md`](../../docs/mockup/website/BUILD-MAP.md).

- `issues/NN-*.md`: one ticket per file. Each says what it delivers and lists its acceptance criteria.
- `prompts/NN-*.md`: one executer prompt per ticket, written with prompt-architect using RISEN:
  - **Role**: the opening line
  - **Instructions**: Goal and Context
  - **Steps**: Approach
  - **End goal**: Acceptance criteria and Report back
  - **Narrowing**: Scope and Guardrails

  Paste the fenced block into a fresh executer session.

Every prompt has concrete **happy and sad paths** in its acceptance criteria, and requires a test for each sad path. Every executer works on a feature branch off `main` and **never commits or pushes**. It reports back with the evidence from `pnpm lint && pnpm type:check && pnpm test && pnpm build`, `pnpm test:coverage` and `pnpm test:e2e`.

## Before ticket 01

The executers branch off `main` and read the planning docs, so those docs must be **on `main` first**. Commit these on a branch (for example `docs/planning-ayc-v1`) and merge it:

- `CONTEXT.md`
- `docs/adr/0005-multi-tenancy.md`, `0007-analytics-posthog.md`, `0008`–`0012`
- `docs/specs/2026-10-29-ayc-v1.md`
- `docs/mockup/`
- `.prettierignore` and `eslint.config.mjs` (they keep `docs/mockup` verbatim)

`.scratch/` isn't gitignored. Either commit it with the docs, or add `.scratch/` to `.gitignore`. Each prompt's pre-flight ignores an untracked `.scratch/`.

## Order

Each ticket starts only when its blockers are **merged to `main`**. Each prompt's pre-flight checks this and stops if they aren't.

| #   | Ticket                                                       | Blocked by                     |
| --- | ------------------------------------------------------------ | ------------------------------ |
| 01  | Branded Website shell and Exams menu                         | —                              |
| 02  | Product page (and the full Product and Review seam contract) | 01                             |
| 03  | Products page                                                | 02                             |
| 04  | Exam pages                                                   | 02                             |
| 05  | Home, top half                                               | 02                             |
| 06  | Home, bottom half                                            | 05                             |
| 07  | Reviews page                                                 | 02                             |
| 08  | FAQ page                                                     | 01                             |
| 09  | About page                                                   | 01, 02                         |
| 10  | Legal pages                                                  | 01                             |
| 11  | Sitemap, robots, Organization data and site-wide checks      | 02, 03, 04, 06, 07, 08, 09, 10 |
| 12  | Catalogue spreadsheet template and seed converter            | 02                             |
| 13  | Template cleanup                                             | 01                             |

**Parallel lanes:**

1. Ticket 01.
2. After 01: tickets 02, 08, 10 and 13.
3. After 02: tickets 03, 04, 05, 07, 09 and 12.
4. After 05: ticket 06.
5. Last: ticket 11.

**Changes from the breakdown you approved:**

- **12 is now blocked by 02**, because it needs the Product and Review model and the seed validation.
- **09 is now blocked by 01 and 02**, because its Product count and store buttons come from the Product contract.
- **02 also ships the shared Marquee and the `/products` URL builder**, so 03–06 don't build competing copies in parallel.

**Merge-conflict hotspots** (small and expected):

- The Catalogue seam files: 02 and 08 both add to them.
- `src/paths.ts` and the middleware: 13 touches both.
- `e2e/a11y.spec.ts`: 11 and 13 both edit it.
- `src/app/(website)/page.tsx`: 05, then 06.

Merge in ticket order when two land close together.

## Phase 1 launch checklist (not build blockers)

- [ ] The client's full catalogue spreadsheet, converted with `pnpm catalogue:import <dir>` (ticket 12).
- [ ] The client's lawyer reviews Legal v1.0. Then set its status to `final` and confirm the effective date.
- [ ] The client confirms:
  - the Subject alias mappings (ticket 02)
  - the app-free copy variants (tickets 05 and 06)
  - the rewritten FAQ copy (ticket 08)
  - the About mission tab prices (ticket 09)
- [ ] PostHog: set `NEXT_PUBLIC_POSTHOG_KEY` and turn on **"Discard client IP data"** in the project settings (ADR 0009).
- [ ] `NEXT_PUBLIC_SITE_URL` is set to the live domain. `MEMBER_APP_LIVE` stays unset (off).
- [ ] Captions for the promo video, if it has spoken words (ticket 06).
- [ ] Vercel Pro project with functions in `sin1` (ADR 0012).
