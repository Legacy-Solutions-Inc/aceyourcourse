# React 19 (reference)

Load-on-demand companion to **nextjs-app-router**. React **19.1.0** is installed
(`react` / `react-dom`). These are the features the App Router write path leans
on. Distilled from the official React 19 release notes — cite, don't copy.

## Actions & form state

- **Actions**: async functions passed to `<form action>` / `<button formAction>`
  run inside a transition automatically, tracking pending/error/result.
- **`useActionState(action, initialState)`** → `[state, dispatchAction, isPending]`.
  The action receives `(previousState, formData)` and returns the next state.
  This is exactly the shape of `CustomerFormState` in
  `src/app/dashboard/customers/actions.ts`.
- **`useFormStatus()`** (from `react-dom`) reads the enclosing form's `pending`
  without prop-drilling — ideal for a shared submit button.
- **`useOptimistic(current)`** shows an optimistic value during an async action
  and reverts on error.

## `use()` API

- `use(promise)` reads a promise during render (suspends until it resolves);
  `use(Context)` reads context and may be called conditionally. Useful for
  streaming a Server Component promise into a Client Component.

## ref as a prop

- Function components accept `ref` directly — **`forwardRef` is no longer
  required**. Prefer `function C({ ref, ...props })` for new components. (Vendored
  shadcn/ui components may still use `forwardRef`; leave them as generated.)

## Document metadata

- React 19 can hoist `<title>`/`<meta>`/`<link>` rendered anywhere in the tree.
  In this app, prefer Next's **Metadata API** (see the root layout) over inline
  metadata so Next controls `<head>` consistently.

## Context as provider

- `<Context value={...}>` works without `.Provider`. Providers must still live in
  a `"use client"` module (context is not available in Server Components) — see
  `ThemeProvider` used by `src/app/layout.tsx`.

## Source

- React 19 — https://react.dev/blog/2024/12/05/react-19
- `useActionState` — https://react.dev/reference/react/useActionState
- `useFormStatus` — https://react.dev/reference/react-dom/hooks/useFormStatus
- `use` — https://react.dev/reference/react/use
