---
name: clean-architecture
description: Use when reviewing architecture, module boundaries, dependency direction, or a refactor — the durable Clean Architecture / SOLID principles distilled for THIS repo and reconciled with its pragmatic service-seam pattern (ADR 0003), not a textbook 4-layer rewrite.
---

# Clean architecture (this repo)

## When to use

Reviewing where a boundary should go, which way dependencies point, whether a
module is doing too much, or a refactor's shape. This is a **methodology** skill
(Robert C. Martin's Clean Architecture + SOLID + Kent Beck refactoring) — there
is no package to pin. It sharpens `coding-standards` **Category 1 (Architecture &
data flow)**; the enforceable repo contract still lives in
[`AGENTS.md`](../../../AGENTS.md) and ADR 0003.

## Core principles (and how this repo already applies them)

**The Dependency Rule — the one that matters.** Source-code dependencies point
**inward**, toward higher-level policy. Concentric layers: _Entities_ (enterprise
rules) → _Use Cases_ (application rules) → _Interface Adapters_ → _Frameworks &
Drivers_. Inner layers know nothing of outer ones.

- In our stack the inward target is the **service seam** (`src/services/*`) and
  the domain types it speaks (`src/services/types.ts`). UI (RSC/Client
  Components), Server Actions, Drizzle, and Supabase are all **outer** — they
  depend on the seam, never the reverse. → **drizzle-data**, **nextjs-app-router**.

**Dependency Inversion at the boundary.** Cross a boundary through an abstraction
the inner layer owns, not a concrete outer detail (DIP).

- Realized by the seam selector: `src/services/customers.ts` defines the
  `CustomersService` contract; `customers.mock.ts` and `customers.db.ts` are
  swappable implementations chosen at runtime. Callers depend on the contract,
  so mock ↔ Drizzle is a one-file change (ADR 0003).

**DTOs at the boundary, not raw rows.** Actions/RSCs return domain DTOs
(`Customer`), never Drizzle/Supabase records — the pure `rowToCustomer` mapper is
the translation point. Keep secrets and `process.env` inside the seam
(server-only) — only the DAL reads env.

**SOLID, briefly:** single responsibility per module; open for extension via the
seam contract; Liskov-safe implementations (both impls satisfy `CustomersService`
identically); interface segregation (narrow seam signatures); DIP as above.

**Refactoring (Kent Beck).** Make the change easy, then make the easy change.
Watch for smells — long functions, feature envy, primitive obsession, shotgun
surgery, duplicated logic across the mock/db impls. Tidy in small, green steps
(test-driven-development); refactoring is a review-stage activity, not part of
the red→green loop.

## Where we deliberately diverge from textbook Clean Architecture

Do **not** "correct" these — they are decisions (ADR 0003), not gaps:

- **No separate Entities / Use-Case interactor layers.** The **service seam IS
  our single boundary**; a full four-ring structure is overkill for this
  template's scope. Domain "entities" are plain typed interfaces
  (`src/services/types.ts`), not a ceremony layer.
- **Pragmatic over dogmatic.** Reads happen directly in Server Components through
  the seam (not funneled through interactor objects); writes are thin Server
  Actions delegating to the seam. That satisfies the Dependency Rule without the
  boilerplate.
- Treat generic "add a UseCase/Entities layer" advice as **out of scope** unless
  a new ADR supersedes 0003.

## In this template

- `src/services/*` — the seam (the boundary); `customers.ts` (contract +
  selector), `customers.mock.ts` / `customers.db.ts` (swappable impls),
  `types.ts` (domain DTOs), `customers.db.ts#rowToCustomer` (boundary mapper).
- `src/env.server.ts` / `src/lib/db/*` — outer "Frameworks & Drivers"; reached
  only via the seam.
- `src/app/**` (RSC + Server Actions) — outer "Interface Adapters"; depend inward
  on the seam, never on Drizzle/Supabase directly.
- `docs/adr/0003-mock-first-service-seam.md` — the decision this skill reconciles.

## Red flags

- A dependency pointing **outward** — the seam importing from `src/app/**`, or a
  domain type importing a Drizzle/Supabase type.
- A component or Server Action calling Drizzle/Supabase/`process.env` directly
  instead of through the seam (breaks the Dependency Rule; see AGENTS.md).
- Returning raw DB rows across the boundary instead of DTOs.
- A concrete outer detail leaking inward (e.g. the seam contract typed in terms
  of a Drizzle row shape).
- Over-correcting our pragmatic seam into a full Entities/UseCases 4-layer stack —
  that contradicts ADR 0003.
- Bundling refactors into a red→green TDD step instead of the review stage.

## See also

Per-component depth: **drizzle-data** (the seam impl), **nextjs-app-router**
(RSC/Actions boundaries), **coding-standards** (Category 1 enforcement).
Contract + decisions: [`AGENTS.md`](../../../AGENTS.md), ADR 0003.

## Sources

- The Clean Architecture (Robert C. Martin) — https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- The Dependency Rule / SOLID overview — https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html
- Refactoring & code smells (Martin Fowler) — https://refactoring.com/
- Distilled/adapted (not installed) from the community plugin
  `nathankim0/clean-architecture-skills` (MIT) — https://github.com/nathankim0/clean-architecture-skills
