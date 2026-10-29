# Theming — token architecture (reference)

Load-on-demand companion to **tailwind-v4**. How `src/app/globals.css` is layered
and how to change it safely. Tailwind **4.3.2**.

## Two layers of tokens

1. **Raw tokens** (values) live on `:root` and `.dark` as oklch custom
   properties: `--background`, `--foreground`, `--primary`, `--muted`,
   `--destructive`, `--border`, `--ring`, `--radius`, `--chart-1..5`,
   `--sidebar*`. `.dark` overrides the same names — this is the ONLY place a
   color's light/dark value is defined.
2. **Tailwind mapping** in `@theme inline` binds those raw tokens to Tailwind's
   scales: `--color-background: var(--background)`, `--color-primary:
var(--primary)`, the `--radius-sm/md/lg/xl` scale off `--radius`, etc. This is
   what generates `bg-background`, `text-primary`, `rounded-lg`, and friends.

`inline` is used because each `--color-*` value is itself a `var(--token)`; inline
keeps utilities pointing at the live token so dark mode (which swaps the raw
token) just works.

## Dark mode

`@custom-variant dark (&:is(.dark *));` + `next-themes`
(`ThemeProvider attribute="class"` in `src/app/layout.tsx`) toggling the `.dark`
class on `<html>`. Never introduce a second dark-mode mechanism.

## Adding a new semantic color

1. Add the raw token to BOTH `:root` and `.dark` in oklch:
   `--success: oklch(...)` in each block.
2. Map it under `@theme inline`: `--color-success: var(--success);`.
3. Use it: `bg-success`, `text-success`, `border-success`.

Adding a shadcn component that expects a token? Add the token first, then the
component (see **shadcn-ui**). Keep `baseColor: neutral` (in `components.json`)
consistent with the neutral grays already defined.

## Source

- Theme variables — https://tailwindcss.com/docs/theme
- Colors — https://tailwindcss.com/docs/colors
- Dark mode — https://tailwindcss.com/docs/dark-mode
