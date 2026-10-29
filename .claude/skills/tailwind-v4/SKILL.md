---
name: tailwind-v4
description: Use when writing or changing styles, theme tokens, colors, dark mode, or CSS in this app — editing src/app/globals.css, adding design tokens, or applying utility classes under Tailwind CSS v4.
---

# Tailwind CSS v4 (this repo)

## 1. When to use

Any styling work: utility classes, semantic color tokens, dark mode, adding or
overriding theme values, or touching `src/app/globals.css` / `postcss.config.mjs`.
Pair with **shadcn-ui** (its components consume these tokens).

## 2. Version

- `tailwindcss` **4.3.2**, `@tailwindcss/postcss` **4.3.2**, `tw-animate-css`
  **1.4.0** (from `package.json` / installed).
- **There is NO `tailwind.config.js`** — v4 is CSS-first, and `components.json`
  sets `tailwind.config: ""` to confirm it.

## 3. Core standards

**CSS-first configuration.** v4 has no JS config by default. Import Tailwind and
declare theme in CSS:

```css
@import "tailwindcss"; /* replaces @tailwind base/components/utilities */
@theme {
  --color-brand-500: oklch(0.7 0.15 250);
} /* also emits bg-brand-500 etc. */
```

- `@theme` both defines a native CSS variable AND generates the matching
  utilities/variants. Design tokens are real CSS custom properties at runtime.
- **`@theme inline`** emits utilities that reference the variable _inline_ — use
  it when the token's value is itself a `var()` (this repo maps `--color-*` to the
  raw `--background`/`--foreground`/… tokens, so `inline` is correct).
- **Automatic content detection** — no `content: [...]` array to maintain.
- **`@tailwindcss/postcss`** is the build plugin (in `postcss.config.mjs`); v4 has
  built-in `@import` handling, so no `postcss-import`/`autoprefixer` wiring.
- **`@custom-variant`** defines variants in CSS (e.g. class-based dark mode).
- `@apply` still works inside `@layer base` for element defaults.
- New in v4 and available without config: container queries (`@container`, `@sm`),
  3D transforms, `bg-linear-*`/`bg-radial-*` gradients, `@starting-style`,
  `not-*`, and a modernized oklch color palette.

**Migration gotchas** (v3 → v4, so Claude doesn't emit v3-isms): use
`@import "tailwindcss"` not `@tailwind ...`; gradients are `bg-linear-*` not
`bg-gradient-*`; there is no JS config to "extend".

## 4. In this template

- `src/app/globals.css` is the whole config:
  - `@import "tailwindcss";` then `@import "tw-animate-css";` (animation utilities).
  - `@custom-variant dark (&:is(.dark *));` — dark mode is **class-based**, driven
    by `next-themes` (`ThemeProvider attribute="class"` in `src/app/layout.tsx`).
  - `:root { … }` and `.dark { … }` hold the raw tokens in **oklch**
    (`--background`, `--primary`, `--radius`, chart + sidebar tokens…).
  - `@theme inline { --color-background: var(--background); … }` maps those raw
    tokens to Tailwind's color/radius scales, which is what makes `bg-background`,
    `text-foreground`, `rounded-lg`, etc. resolve.
  - `@layer base { * { @apply border-border …; } body { @apply bg-background …; } }`.
- `postcss.config.mjs` — `plugins: { "@tailwindcss/postcss": {} }`.
- `components.json` — `tailwind.config: ""`, `tailwind.css: "src/app/globals.css"`,
  `baseColor: "neutral"`, `cssVariables: true`.
- Compose conditional classes with `cn()` from `src/lib/utils.ts`
  (`clsx` + `tailwind-merge`).

See [`references/theming.md`](references/theming.md) to add or change a token.

## 5. Red flags

- Creating a `tailwind.config.js`/`.ts` and expecting it to apply — v4 here is
  CSS-first; put config in `globals.css` `@theme`.
- Using v3 `@tailwind base/components/utilities` directives.
- Hard-coding hex/rgb colors instead of the semantic tokens (`bg-background`,
  `text-muted-foreground`, `border-border`, …).
- Adding `postcss-import`/`autoprefixer` — redundant in v4.
- Toggling dark mode by anything other than the `.dark` class (breaks the
  `@custom-variant` + `next-themes` setup).
- Concatenating class strings by hand instead of `cn()`.

## 6. Sources

- Tailwind v4 announcement — https://tailwindcss.com/blog/tailwindcss-v4
- Theme variables (`@theme`) — https://tailwindcss.com/docs/theme
- Upgrade guide (v3 → v4) — https://tailwindcss.com/docs/upgrade-guide
- Functions & directives (`@import`, `@apply`, `@custom-variant`) — https://tailwindcss.com/docs/functions-and-directives
