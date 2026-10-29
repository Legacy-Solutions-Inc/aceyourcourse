---
name: forms-validation
description: Use when building or changing a form — react-hook-form + zod, the shadcn Form primitives, client-side validation, or the matching server-side zod validation in a Server Action.
---

# Forms & validation (this repo)

## 1. When to use

Any form work: a new form, a field, validation rules, error display, or the
server-side check behind a submit. Pair with **shadcn-ui** (the Form primitives),
**nextjs-app-router** (the action write path), and **supabase-auth** (auth forms).

## 2. Version

- `react-hook-form` **7.55.0**, `zod` **3.24.2**, `@hookform/resolvers` **4.1.3**
  (from `package.json` / installed).

## 3. Core standards

**react-hook-form drives client forms.** `useForm({ resolver: zodResolver(schema),
defaultValues })` → `handleSubmit(onSubmit)`; read errors from
`formState.errors`. RHF keeps inputs uncontrolled to minimize re-renders. Use
`register` for plain inputs and **`Controller`** for controlled/UI-library inputs.

**zod is the single source of truth.** Define one schema, derive the TS type with
`z.infer<typeof schema>`, and feed it to RHF via `zodResolver` (from
`@hookform/resolvers/zod`).

**Validate at BOTH boundaries.**

- **Client** — `zodResolver` for instant UX feedback.
- **Server** — re-validate the SAME shape inside the Server Action with
  `schema.safeParse` and return field errors. Client validation is UX, not
  security; a Server Action is a directly-reachable POST endpoint (see
  **nextjs-app-router**), so it must never trust client input.

**Use the shadcn Form primitives, don't hand-wire.** `Form` is RHF's
`FormProvider`; `FormField` wraps `Controller`; `FormItem`/`FormLabel`/
`FormControl`/`FormMessage` auto-wire `id`, `aria-invalid`, `aria-describedby`,
and render the field's error — accessibility comes for free.

## 4. In this template

- `src/components/ui/form.tsx` — the shadcn Form layer over RHF: `Form =
FormProvider`, `FormField = Controller`, and `useFormField()` wires field
  state + a11y ids into `FormControl`/`FormMessage`.
- `src/components/dashboard/settings/profile-form.tsx` — reference client form:
  `useForm({ resolver: zodResolver(schema), defaultValues })`, `FormField` +
  `render`, `form.handleSubmit(onSubmit)`, toast on result.
- `src/components/auth/sign-in-form.tsx` — two-field form (email/password) with a
  `z.object` schema + `zodResolver`; same pattern.
- `src/app/dashboard/customers/actions.ts` — the SERVER half: `"use server"` +
  `customerSchema.safeParse(Object.fromEntries(formData))` returning
  `error.flatten().fieldErrors` — the two-boundary rule in action.
- More forms follow the same shape: `password-form.tsx`, `sign-up-form.tsx`,
  `reset-password-form.tsx`, `update-password-form.tsx`,
  `src/components/dashboard/customer/customer-form.tsx`.

## 5. Red flags

- Validating only on the client — always re-validate in the Server Action.
- Raw `<input>` + `useState` instead of RHF + the shadcn Form primitives.
- Wiring a controlled/UI-lib input with `register` instead of
  `Controller`/`FormField`.
- Duplicating a schema for client vs server instead of one schema + `z.infer`.
- Hand-rolling error text or `aria-*` wiring instead of `FormMessage`/
  `FormControl`.
- Omitting `defaultValues` (uncontrolled→controlled warnings, buggy resets).

## 6. Sources

- react-hook-form get started — https://react-hook-form.com/get-started
- `useForm` API — https://react-hook-form.com/docs/useform
- Schema validation with resolvers — https://github.com/react-hook-form/resolvers
- Zod — https://zod.dev
- shadcn/ui Form — https://ui.shadcn.com/docs/components/form
