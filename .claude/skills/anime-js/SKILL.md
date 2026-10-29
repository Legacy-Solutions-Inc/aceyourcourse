---
name: anime-js
description: Use when JS-driven animation is needed — complex timelines, sequencing, staggering, SVG, or scroll-driven motion. anime.js is NOT installed here; this skill says when to add it and how to use v4 safely in this Next.js app.
---

# anime.js (this repo — install-on-demand)

## 1. When to use

Reach for this ONLY for animation that CSS can't express cleanly: multi-step
**timelines**, **sequencing**, **staggering**, **SVG** draw/morph, spring/physics,
or **scroll-driven** choreography. For simple enter/exit and micro-interactions,
stay on the already-installed `tw-animate-css` + Tailwind transitions (see
**tailwind-v4**) — CSS is cheaper and SSR-friendly. Pair with
**nextjs-app-router** for the client boundary.

## 2. Version

**Not installed by default** (absent from `package.json`). Current major is
**v4.x**. Add only when a project genuinely needs JS-driven animation:

```bash
pnpm add animejs @types/animejs
```

This skill documents v4 so it's used correctly if/when added; adding it is a
deliberate, separate change — do not add it just to satisfy this skill.

## 3. Core standards

**v4 uses ESM named exports — not v3's default `anime()`:**

```ts
import { animate, createTimeline, stagger, createScope, svg, onScroll } from "animejs";
```

- `animate(targets, params)` — targets are selectors/elements/objects.
- `createTimeline()` — sequence with `.add()` / `.call()`.
- `stagger()` — staggered and grid-based delays.
- `createScope()` — an isolated context whose `.revert()` cleans up ALL its
  animations at once (the React-friendly cleanup path).

**Client boundary (critical in the App Router).** anime.js touches the DOM, so it
runs ONLY in a Client Component: `"use client"`, drive it inside `useEffect`
against a `useRef` element, and **revert on unmount**. Never import it into a
Server Component or run it at module top level.

```tsx
"use client";
import { useEffect, useRef } from "react";
import { animate, createScope } from "animejs";

export function Reveal() {
  const root = useRef<HTMLDivElement>(null);
  const scope = useRef<ReturnType<typeof createScope>>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // respect the user
    scope.current = createScope({ root }).add(() => {
      animate(".item", { opacity: [0, 1], translateY: [8, 0], duration: 400 });
    });
    return () => scope.current?.revert(); // cleanup on unmount
  }, []);
  return <div ref={root}>{/* .item children */}</div>;
}
```

**Respect `prefers-reduced-motion`.** Guard with `matchMedia` (as above) — skip or
zero-out non-essential motion when the user asked for reduced motion.

**CSP-friendly here.** anime.js animates via inline `style` / the Web Animations
API — allowed by this repo's `style-src 'self' 'unsafe-inline'` (see
`src/lib/csp.ts`). As a normal ESM import it needs NO `eval` and adds no inline
`<script>`, so it does not violate the nonce-based `script-src`. Keep it that way
— don't inject `<script>` or `eval`.

## 4. In this template

- Not present — there is no anime.js anchor file to cite. The motion already
  available: `tw-animate-css` imported in `src/app/globals.css` and Tailwind
  transition/animation utilities (see **tailwind-v4**). Prefer these first.
- CSP that governs any animation approach: `src/lib/csp.ts` (`style-src`
  `'unsafe-inline'` permits inline-style/WAAPI animation; `script-src` is
  nonce + `'strict-dynamic'`).
- Client-boundary patterns to follow: `src/components/theme/theme-provider.tsx`
  for the minimal `"use client"` wrapper, and `src/components/ui/sidebar.tsx` for
  the `"use client"` + `useEffect`/`useRef` shape anime.js needs.

## 5. Red flags

- Adding `animejs` to `package.json` when the task doesn't actually need JS-driven
  animation (this is install-on-demand; CSS/`tw-animate-css` first).
- Using the v3 default-export API (`import anime from "animejs"; anime({...})`) —
  v4 is named exports.
- Importing or animating in a Server Component / at module top — must be
  `"use client"` inside `useEffect`.
- No cleanup on unmount (`scope.revert()` / `animation.revert()`) → leaks and
  stale animations across route changes.
- Ignoring `prefers-reduced-motion`.
- Reaching for anime.js for simple fades/hovers that `tw-animate-css` or Tailwind
  transitions already handle.
- Introducing inline `<script>` or `eval` for animation — would break the nonce
  CSP; a module import does not.

## 6. Sources

- anime.js v4 docs — https://animejs.com/documentation
- Animation basics — https://animejs.com/documentation/animation
- Timeline — https://animejs.com/documentation/timeline
- Stagger — https://animejs.com/documentation/stagger
- Scope (cleanup) — https://animejs.com/documentation/scope
- `prefers-reduced-motion` — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
