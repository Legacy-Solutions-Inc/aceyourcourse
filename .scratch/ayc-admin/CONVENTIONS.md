# Phase 2 (Admin) shared conventions

Every Phase 2 executer prompt points here. These names and rules are decided, so use them exactly and don't invent parallel ones. If the code already does something differently when your ticket starts, follow the code and say so in your report. If this file and the spec disagree, the spec (`docs/specs/2026-10-29-ayc-v1.md`, Phase 2) wins.

## 1. Stages and the Admin mode

- **Stage A (tickets 01–12): sample data.**
  - The Admin works on an editable in-memory copy of the Phase 1 seed, held by the dev server.
  - Sign-in is a development-only "Sign in as" list.
- **Stage B (tickets 13–18): the database.**
  - Each seam gets a database arm behind the same contract.
  - Sign-in is Google through Supabase.
  - Photos go to Supabase Storage.
- **The Admin mode.** `src/lib/admin/mode.ts` (server-only) exports the pure function `computeAdminMode({ nodeEnv, databaseConfigured, supabaseConfigured })` and `adminMode`.
  - Stage A: `"sample"` when `NODE_ENV !== "production"`, otherwise `"closed"`.
  - Ticket 16 adds `"live"`, used when the database and Supabase are both configured. Development without them stays `"sample"`, and production without them stays `"closed"`.
  - `"closed"`: every `/admin` route answers 404, every Admin Server Action refuses, and the dev-only routes answer 404.
- In `"sample"` mode, `/admin` requests make **no Supabase round trip**. The middleware still sets the CSP on every response.

## 2. Routes

All routes go in `src/paths.ts` under `paths.admin`. Never hard-code a path.

| Screen                                                       | Path                       | Selection (search params)                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                                                     | `/admin`                   |                                                                                                                                                                                                                                                                                  |
| Sign-in                                                      | `/admin/sign-in`           | `?next=` (an `/admin` path only)                                                                                                                                                                                                                                                 |
| 403                                                          | `/admin/denied`            | `?reason=not-staff \| invite-expired \| owners-only`                                                                                                                                                                                                                             |
| Pages & promo (was Exam pages & promo; renamed in ticket 20) | `/admin/exam-pages` (kept) | `?exam=ce&section=header`, `?page=promo`, `?page=announcement`; from ticket 20 `?page=site&site=home` (home, about, products, faq, reviews), from ticket 21 `?page=site&site=about&section=story`, and from ticket 23 `?page=exam&add=exam` (the "+ Add exam" form, Owners only) |
| Products & store links                                       | `/admin/products`          | `?product=<id> \| new`                                                                                                                                                                                                                                                           |
| Reviews & FAQs                                               | `/admin/reviews`           | `?review=<id> \| new`; `?tab=faqs&group=<group>&faq=<id> \| new`                                                                                                                                                                                                                 |
| Settings (Owner)                                             | `/admin/settings`          |                                                                                                                                                                                                                                                                                  |

- **Folders.**
  - `src/app/admin/(shell)/…` holds the signed-in screens, with the sidebar, header and drawer in `(shell)/layout.tsx`.
  - `src/app/admin/sign-in/` and `src/app/admin/denied/` sit outside the shell.
- **Indexing.** Every Admin page sets `robots: { index: false, follow: false }`, and `src/app/robots.ts` disallows `/admin`.
- **Development-only route handlers** (404 unless the mode is `"sample"`):
  - `POST /api/dev/sample-data/reset`: resets the sample store and clears every catalogue tag.
  - `PUT` and `GET /api/dev/uploads/[id]`: the sample arm of the upload seam (ticket 06).

## 3. Modules

### The sample store (`src/services/mock/sample-store.ts`)

- `getSampleStore()` and `resetSampleStore(seed?)`.
- The store lives on `globalThis`, so every route module and HMR reload share one copy.
- It holds:
  - `catalogue`: a deep copy of `CATALOGUE_SEED`
  - `staff`, `invites` and `deniedSignIns`
  - `staffActivity`
  - `uploads`
  - a "last saved" stamp per editable record: `{ savedAt: ISO, savedBy: name | null }`
  - a `generation` id that changes on boot and on every reset
- **Vitest gotcha:** `globalThis` survives `vi.resetModules()`. Tests that edit the seed must call `resetSampleStore(editedSeed)` (or something equivalent). Never rely on module reloading.

### The Catalogue seam

- **The mock arm reads the sample store,** never the static seed. That way an Admin save shows up on the Website.
- **Cache tags** live in `src/services/catalogue.tags.ts`:
  - `CATALOGUE_TAG = "catalogue"` goes on every read.
  - Each read also gets one or more of `catalogue:exams`, `catalogue:products`, `catalogue:reviews`, `catalogue:faqs`, `catalogue:settings`, `catalogue:exam-pages` and, from ticket 20, `catalogue:site-pages`.
- **Wrapping.** The selector `src/services/catalogue.ts` wraps each read once with `unstable_cache` from `next/cache`. Don't use `"use cache"`, which is experimental in Next 15.
  - In sample mode, the key parts include the store `generation`, so a restart never serves cached data from before the restart.
- **Vitest.** `vitest.setup.ts` mocks `next/cache`: `unstable_cache` passes through, and `revalidateTag` and `revalidatePath` are spies.

### The Admin seam (`src/services/admin.ts`)

- **Files.**
  - `admin.ts`: the contract and the selector
  - `admin.types.ts`
  - `admin.schema.ts`: zod input schemas, shared with the forms
  - `admin.mock.ts`: re-exports the area files in `src/services/mock/admin/<area>.ts`
- **Areas.** Each ticket adds its own: `settings`, `staff`, `products`, `photos`, `reviews`, `faqs`, `examPages`, `promo`, `overview` and `activity`. Ticket 20 adds `sitePages`, and ticket 21 extends it with About. Ticket 23 adds Exam and Subject creation and deletion to `examPages`, Owner only (`role: "owner"`), recorded under the Staff Activity entity `exam` like `rename-subjects` (for example `add`, `delete`, `add-subject` and `delete-subject`).
- **Reads** return fresh data, are never cached, and carry each record's stamp.
- **Writes** have the form `(actor: StaffActor, input, expected?: { savedAt: string }) => Promise<AdminResult<T>>`, where:

  ```ts
  type StaffActor = { email: string; name: string; role: "owner" | "editor" };
  type AdminError =
    | { kind: "invalid"; fieldErrors: Record<string, string[]>; formError?: string }
    | { kind: "conflict"; savedBy: string | null; savedAt: string }
    | { kind: "not-found" }
    | { kind: "forbidden"; message: string };
  type AdminResult<T> = { ok: true; value: T; tags: string[] } | { ok: false; error: AdminError };
  ```

- **Every write, in both arms:**
  1. Checks the actor's Staff Role. The seam checks it too, not only the action.
  2. Validates the input with zod.
  3. Runs the conflict check against `expected.savedAt`. Single toggles pass no `expected` and always save.
  4. Applies the change.
  5. Appends one Staff Activity record per entity changed: `{ id, at, actor: { email, name }, entity, entityId, action, before, after }`.
  6. Updates the record's stamp.
  7. Returns the cache tags to clear.
- **The sample arm** applies every write to a draft copy, re-validates the whole catalogue with `validateCatalogueSeed`, and commits only when that passes, so the Website can never break. In Stage B (ticket 15), the change and its Staff Activity go in one transaction.
- **Reuse the seed rules** in `src/services/catalogue.schema.ts`, such as the Coming Soon rules, Listing domains and quotes that must match word for word. Don't duplicate them.

### The Staff Guard (`src/lib/admin/guard.ts`)

- `getStaff(): Promise<StaffActor | null>`.
- `requireStaff()`: redirects to `paths.admin.signIn` when signed out, and to `paths.admin.denied` when the User isn't Staff.
- `requireOwner()`: an Editor is sent to `denied?reason=owners-only`.
- Every Admin page and every Admin Server Action calls the Guard. The staff list is read on every call.
- **Identity** (`src/lib/admin/identity.ts`) gives the signed-in User's email and name.
  - Sample arm: the `ayc_admin_sample` cookie (httpOnly, `sameSite=lax`, `path=/`), honoured only in `"sample"` mode.
  - Supabase arm: added in ticket 16 (Google). Ticket 19 adds the development password sign-in.
  - **The sign-in method counts too (ticket 19).** It's read from the session's verified `amr` claim. `oauth` always counts, `password` counts only under `pnpm dev` (`NODE_ENV === "development"`), and nothing else counts. So production is Google-only, whatever Supabase's Email setting says. Phase 3's Member sign-in keeps the same rule.

### Server Actions

- They live in `src/app/admin/(shell)/<area>/actions.ts`.
- Each is built with `adminAction({ role: "staff" | "owner", schema }, handler)` from `src/lib/admin/action.ts`. That runs the Guard, then zod, then the seam, then `revalidateTag` for each returned tag, and returns a serialisable result for `useActionState`.

### The upload seam (`src/services/uploads.ts`, with `.mock.ts` and `.types.ts`; ticket 06)

- `createUpload(actor, { purpose: "product-photo" | "share-image" | "site-page-share-image", owner, contentType, size })` returns `{ uploadUrl, path, publicUrl }`. Ticket 20 added `site-page-share-image`, whose `owner` is the Site page (`home`, `about`, `products`, `faq`, `reviews`); Storage files it at `site-pages/{page}/share-{uuid}.{ext}`.
- It accepts JPEG, PNG or WebP, up to 10 MB.
- The browser `PUT`s the file to `uploadUrl`. The save then records `path`.

### Pure helpers and components

- `src/lib/admin/`: `seo-check.ts`, `slug.ts`, `needs-attention.ts`, `copy-invite.ts`, and similar. Each one has a test.
- `src/components/admin/`:
  - the shell pieces
  - `save-state.tsx`
  - the conflict notice
  - the "Couldn't save" toast, using sonner
  - the typed-DELETE dialog
  - toggle rows, chip filters and counters
- Reuse `src/components/ui/*` (shadcn): `sheet` for the drawer, plus `dialog`, `tabs`, `select`, `sonner` and `table`. No other UI kit.

## 4. Look and copy

- **Look.** The Admin mockup (`docs/mockup/admin/AdminDashboard_v2.dc.html`, mapped in `docs/mockup/admin/BUILD-MAP.md`) uses the Website's tokens:
  - cream `#F6F1E7` and navy `#0E1A2E`
  - orange `#FF881F` and blue `#005AA5`
  - Schibsted Grotesk and JetBrains Mono
  - hard 1.5 px borders and offset shadows

  Follow its layouts, spacing, labels and copy closely: the 268 px sidebar, mono uppercase labels, chips, toggles and save-state lines. The Admin is light-only.

- **Mobile.** Below 760 px, the floating "Menu" button opens the slide-in drawer. Escape and the scrim close it.
- **Copy overrides** (where our decisions win over the mockup):
  - Invites are shared by hand: "Copy invite message". "Resend" becomes "Renew". There's no "They get an email".
  - No "Paid today" card, sales tiles, chart or member panels.
  - No "Send test email" and no default subject line.
  - The 403 button says "Go to the website" until the Member App switch is on.
  - "course", meaning an Exam, becomes "Exam".
  - "Removal signs them out" becomes "loses access right away".
- **Vocabulary.** Use the CONTEXT.md terms in code and in any new copy: Product, Marketplace, Listing, Review, Staff, Staff Role, Invite, Staff Activity, Exam and Subject.

## 5. Sample Users (Stage A "Sign in as")

The list shows these Users, plus an "Other email" field for any address:

| User                 | Email                      | On the staff list as                               |
| -------------------- | -------------------------- | -------------------------------------------------- |
| Angel Rose L. Lepaña | angel@aceyourcourse.ph     | Owner, active                                      |
| AYC Content Team     | content@aceyourcourse.ph   | Editor, active (last signed in 2 days before boot) |
| Kim Reyes            | kim.reyes@gmail.com        | Invite, Editor, expires 6 days after boot          |
| Expired Invite       | expired.invite@example.com | Invite, Editor, expired 1 day before boot          |
| Juan Dela Cruz       | juan.delacruz@gmail.com    | not on the staff list                              |

Never put a real person's address beyond these mockup samples into the repo. The first production Owner is added at deployment with `pnpm staff:add-owner`.

## 6. Tests

- **Behaviour first.** Use test-driven development through the seam's public contract.
  - Admin seam suites go in `src/services/admin.<area>.test.ts`.
  - Write each suite with `describe.each(ADMIN_ARMS)` over a list of arms, so Stage B only adds the database arm. Stage A has the sample arm only.
  - Reset the sample store in `beforeEach`.
- **Sad paths.** Every acceptance criterion's sad path gets a test: invalid input, conflict, forbidden for an Editor, not found, and boundary values.
- **Playwright.**
  - Admin specs go in `e2e/admin/*.spec.ts`, in a Playwright project `admin` that depends on the existing Website project and runs one worker at a time. Use the project's `workers: 1` if the installed Playwright supports it; otherwise run the admin project in a second `playwright test` invocation inside `test:e2e`.
  - Each admin test resets the sample data first, through `POST /api/dev/sample-data/reset`.
  - Helpers go in `e2e/admin/helpers.ts`: `signInAs(page, "owner" | "editor" | "invited" | "expired" | "not-staff")` and `resetSampleData(request)`.
- **Accessibility.** Add every new Admin screen, signed in, to the axe check: serious and critical issues block.
- **Verification** for every ticket:
  - `pnpm lint && pnpm type:check && pnpm test && pnpm build`, then `pnpm test:coverage` and `pnpm test:e2e`
  - from ticket 13, also the database tests against local Supabase. **Since 2026-11-04 those run in CI only.** The user's machine has no Docker, and `.env` points at the hosted project, which no test may touch.
  - repo gotchas:
    - `pnpm build` breaks a dev server running on :3000. If :3000 answers 200, run e2e against it, and run the build in a scratchpad copy (rsync without `node_modules`, `.next` and `.git`; `cp -cR` the `node_modules` back for Turbopack).
    - Never kill the user's server.
    - Don't add throwaway probe specs to `e2e/`.

## 7. Workflow (every ticket)

- **Branch.** Work on `docs/ayc-v1-planning`, the one shared branch, and create no branch of your own. The pre-flight stops if the tree has uncommitted changes other than an untracked `.scratch/`, or if a blocker isn't committed.
- **Never** run `git commit`, `git push`, `git stash`, `git reset --hard` or `git rebase`, and don't open a PR. Leave every change uncommitted; the user reviews and commits each ticket. This overrides the commit rules in CLAUDE.md, AGENTS.md and `.claude/commands/handoff.md`.
- **Read-only docs.** Don't edit `docs/mockup/`, `docs/specs/` or `docs/adr/`. Edit `CONTEXT.md` only if your ticket says so.
- **New dependencies** only where a prompt allows them by name. Otherwise stop and ask.
