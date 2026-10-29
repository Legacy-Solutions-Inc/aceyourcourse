# Server Actions — the repo pattern (reference)

Load-on-demand companion to **nextjs-app-router**. This documents the exact
read/write shape this repo uses, so new features copy it verbatim. The reference
feature is Customers (`src/app/dashboard/customers/`).

## The pattern

1. **Read (RSC)** — `page.tsx` is an async Server Component. `await searchParams`
   / `await params`, then call the service seam (`listCustomers`, `getCustomer`).
   No `"use client"`, no direct DB/Supabase access.

2. **Write (`"use server"`)** — `actions.ts` starts with `"use server"`, so every
   export is a Server Action. Each action:
   - parses `FormData` with a `zod` schema (`safeParse`) and returns field errors
     on failure — **validation before any mutation**;
   - re-checks authorization if the mutation is privileged (actions are directly
     reachable POST endpoints, not just UI callbacks);
   - calls the seam (`createCustomer` / `updateCustomer` / `deleteCustomer`);
   - `revalidatePath(...)` the affected routes (via `src/paths.ts`);
   - `redirect(...)` to the result page (throws control flow — put revalidation
     before it).

3. **Form state** — actions return a `CustomerFormState` (`{ ok, errors? }`) so a
   client form can wire them with React 19 `useActionState`. `updateCustomerAction`
   is bound with the id via `action.bind(null, id)` in the detail page.

## Skeleton (mirrors actions.ts)

```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createCustomer } from "@/services/customers";
import { paths } from "@/paths";

const schema = z.object({/* ...fields... */});

export interface CustomerFormState {
  ok: boolean;
  errors?: Record<string, string[]>;
}

export async function createCustomerAction(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const created = await createCustomer(parsed.data);
  revalidatePath(paths.dashboard.customers.list);
  redirect(paths.dashboard.customers.details(created.id));
}
```

## Anchor files

- `src/app/dashboard/customers/page.tsx` — RSC list read.
- `src/app/dashboard/customers/[customerId]/page.tsx` — RSC detail read + `notFound()`.
- `src/app/dashboard/customers/actions.ts` — create/update/delete actions.
- `src/paths.ts` — routes used by `revalidatePath`/`redirect`.

## Source

- Mutating data — https://nextjs.org/docs/app/getting-started/mutating-data
- Server Actions guide — https://nextjs.org/docs/app/guides/server-actions
- `redirect` behavior — https://nextjs.org/docs/app/api-reference/functions/redirect
