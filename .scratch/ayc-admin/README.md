# Phase 2 (Admin, Website part): tickets and executer prompts

**Sources:**

- [`docs/specs/2026-10-29-ayc-v1.md`](../../docs/specs/2026-10-29-ayc-v1.md), Phase 2, grilled on 2026-11-01
- [`CONTEXT.md`](../../CONTEXT.md)
- ADRs 0002, 0003, 0006, 0008 and 0012
- [`docs/mockup/admin/BUILD-MAP.md`](../../docs/mockup/admin/BUILD-MAP.md)

**What's here:**

- `CONVENTIONS.md`: the shared names, modules, routes and rules every Phase 2 ticket uses. Every prompt tells the executer to read it.
- `issues/NN-*.md`: one ticket per file, saying what it delivers and listing its acceptance criteria.
- `prompts/NN-*.md`: one executer prompt per ticket, written with prompt-architect using RISEN.
  - **Role**: the opening line
  - **Instructions**: Goal and Context
  - **Steps**: Approach
  - **End goal**: Acceptance criteria and Report back
  - **Narrowing**: Scope and Guardrails

  Paste the fenced block into a fresh executer session.

**How every ticket runs:**

- Each prompt lists concrete **happy and sad paths** and requires a test for each sad path.
- Every executer works on the shared branch `docs/ayc-v1-planning`, creates no branch, and **never commits or pushes**.
- You review and commit each ticket before starting the next.

## Two stages

- **Stage A, tickets 01–12: the Admin on sample data.**
  - Every Admin screen and rule works against an editable in-memory copy of the Phase 1 seed, on your machine.
  - "Continue with Google" opens a development-only "Sign in as" list.
  - The SAMPLE DATA tag has a Reset button, and restarting the dev server also resets.
  - Production keeps the Admin closed.
- **Stage B, tickets 13–18: the database.** The same seams get a database arm, followed by real Google sign-in through Supabase, Storage for photos, and then the production runbook. No screen changes.

## Order

Run them one at a time:

01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18

| #   | Ticket                                      | Blocked by             |
| --- | ------------------------------------------- | ---------------------- |
| 01  | Admin shell and Staff sign-in (sample data) | —                      |
| 02  | Settings, and the shared save path          | 01                     |
| 03  | Staff and Invites                           | 02                     |
| 04  | Products list                               | 02                     |
| 05  | Product editor                              | 04                     |
| 06  | Product photos, and the upload seam         | 05                     |
| 07  | Reviews                                     | 02                     |
| 08  | FAQs                                        | 07                     |
| 09  | Exam pages                                  | 06                     |
| 10  | Home promo banner and announcement bar      | 09                     |
| 11  | Overview                                    | 05, 10                 |
| 12  | Admin-wide checks on the prototype          | 03–11                  |
| 13  | Local Supabase foundation                   | — (by choice after 12) |
| 14  | Catalogue on the database                   | 12, 13                 |
| 15  | Admin writes on the database                | 14                     |
| 16  | Real Staff sign-in                          | 15                     |
| 17  | Photo storage                               | 15                     |
| 18  | Production go-live                          | 16, 17                 |

**Merge-conflict hotspots** (expected, and small when the tickets run in order):

- `src/services/admin.ts` and `admin.types.ts`: every ticket adds an area.
- The sample store.
- `e2e/admin/helpers.ts`.
- The Reviews & FAQs screen: tickets 07 and 08.
- The Exam pages & promo screen: tickets 09 and 10.

## What you do yourself

- [ ] **Before ticket 01:** commit or drop the current `CONTEXT.md` change and the spec update. Commit `.scratch/ayc-admin/`, or ignore `.scratch/`.
- [ ] **Before ticket 13:**
  - Install and start Docker Desktop.
  - Have your hosted Postgres major version ready (Dashboard → Settings → Infrastructure). Ticket 13 asks for it.
- [ ] **During ticket 13:** update your `.env` to the **local** values the executer gives you:
  - the renamed publishable key
  - the secret key
  - the local `DATABASE_URL`

  Your hosted values move to Vercel in ticket 18. Never paste keys or passwords into chat.

- [ ] **Before production (ticket 18's runbook):**
  - the Google Auth Platform client and the Supabase Google provider
  - Email turned off in the hosted project
  - the Vercel env vars
  - `pnpm staff:add-owner <your email>`, typed at deployment and never written in the repo
