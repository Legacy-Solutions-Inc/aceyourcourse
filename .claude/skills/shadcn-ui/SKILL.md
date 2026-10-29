---
name: shadcn-ui
description: Use when adding, updating, or composing UI primitives in this app — running the shadcn CLI, editing src/components/ui/*, choosing icons, or building components on top of the design system.
---

# shadcn/ui (this repo)

## 1. When to use

Any UI-primitive work: adding a component, composing existing ones, picking an
icon, or wiring a variant. Pair with **tailwind-v4** (components consume its
tokens) and **data-tables**/**forms-validation** (batch 2B) for the table/form
primitives.

## 2. Version

shadcn/ui is a **CLI + copy-in registry, not a runtime dependency** — there is no
`shadcn` package to pin in `package.json`; you own the component source under
`src/components/ui/`. The primitives it generates against, installed here:

- `radix-ui` **1.6.2**, `@radix-ui/react-slot` **1.3.0** (behavior)
- `lucide-react` **0.469.0** (icons — the configured `iconLibrary`)
- `class-variance-authority` **0.7.1** (variants), `tailwind-merge` **3.0.1** +
  `clsx` **2.1.1** (via `cn()`)

Config style: **new-york**, base color **neutral**, RSC on — see `components.json`.

## 3. Core standards

**Components are copied into your repo, not imported from a library.** The CLI
writes source you can read and own. Add primitives with:

```bash
pnpm dlx shadcn@latest add <name>      # e.g. button, dialog, table
```

The CLI reads `components.json` to place files and match your setup.

**`components.json` fields** (several are immutable after init — changing them
desyncs already-generated components):

- `style: "new-york"` — immutable.
- `rsc: true` — the CLI adds `"use client"` to interactive components as needed.
- `tsx: true` — generates `.tsx`.
- `tailwind.config: ""` — Tailwind v4, no JS config (see **tailwind-v4**).
- `tailwind.baseColor: "neutral"` and `tailwind.cssVariables: true` — immutable.
- `aliases` — where files land (`components`, `ui`, `utils`, `lib`, `hooks`).
- `iconLibrary: "lucide"`.

**Composition:** merge classes with `cn()`; express variants with `cva`; use
`asChild` (Radix `Slot`) to render a primitive as a different element (e.g. a
Button wrapping a `next/link`). Icons come from `lucide-react`.

**Treat `src/components/ui/*` as generated.** Prefer wrapping/composing over
heavy edits so a future `add`/update stays clean.

## 4. In this template

- `components.json` — `new-york` / `neutral` / `rsc: true` / `tsx: true`,
  `css: src/app/globals.css`, aliases `@/components`, `@/components/ui`,
  `@/lib/utils`, `@/lib`, `@/hooks`, `iconLibrary: lucide`.
- `src/components/ui/*` — vendored primitives already present: `button`, `card`,
  `table`, `form`, `input`, `select`, `checkbox`, `textarea`, `label`, `dialog`,
  `dropdown-menu`, `sheet`, `sidebar`, `tabs`, `tooltip`, `badge`, `avatar`,
  `breadcrumb`, `separator`, `skeleton`, `chart`, `sonner`.
- `src/components/ui/button.tsx` — the reference pattern: `cva` variants +
  `asChild` via `@radix-ui/react-slot`, composed with `cn()`.
- `src/lib/utils.ts` — `cn()` (`twMerge(clsx(...))`).
- `src/app/layout.tsx` — mounts the `sonner` `<Toaster />`; toast via `sonner`.
- Icons: `lucide-react` (e.g. `Plus`, `ArrowLeft` in the Customers pages).

## 5. Red flags

- Trying to `pnpm add` a shadcn component as a package — there is none; use the
  CLI to copy source in.
- Changing `style` / `baseColor` / `cssVariables` in `components.json` after init
  (immutable — desyncs components).
- Introducing another UI kit or component library — `AGENTS.md` mandates
  shadcn/ui + Tailwind only.
- Using a non-lucide icon set instead of the configured `iconLibrary`.
- Hand-concatenating className strings instead of `cn()`; hand-rolling variant
  logic instead of `cva`.
- Heavily rewriting a vendored `ui/*` file (makes CLI updates painful) — wrap or
  compose instead.

## 6. Sources

- shadcn/ui docs — https://ui.shadcn.com/docs
- `components.json` — https://ui.shadcn.com/docs/components-json
- CLI (`init` / `add`) — https://ui.shadcn.com/docs/cli
- Tailwind v4 support — https://ui.shadcn.com/docs/tailwind-v4
- Theming — https://ui.shadcn.com/docs/theming
