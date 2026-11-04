# Ace Your Course

Formula flash cards, notebooks and posters for Philippine board exams, made by
board passers. This repo is one Next.js app with three **Surfaces**:

- **The Website** (`/`) — the public catalogue and brand home. Every Product,
  organised by Exam, with Reviews, an FAQ and legal pages. It sells nothing
  itself: every buy button opens the Product's Marketplace Listing.
- **The Member App** (`/app`, from Phase 3) — a signed-in study app.
  Reviewees sign in with Google and study flashcards, quizzes and Reviewer PDFs.
- **The Admin** (`/admin`, from Phase 2) — the staff-only Surface where Owners
  and Editors manage content without a developer.

The product spec is [`docs/specs/2026-10-29-ayc-v1.md`](docs/specs/2026-10-29-ayc-v1.md).
Shared vocabulary is in [`CONTEXT.md`](CONTEXT.md), and the decisions behind
the stack are in [`docs/adr/`](docs/adr). Contributor and agent conventions are
in [`AGENTS.md`](AGENTS.md).

Stack: **Next.js 15** (App Router, React 19, TypeScript) · **Tailwind CSS v4 +
shadcn/ui** · **Supabase** (Google sign-in from Phase 2) · **Drizzle** · Vitest,
Testing Library and Playwright · GitHub Actions CI.

---

## Quickstart

```bash
pnpm install
cp .env.example .env      # the defaults run the Website with no backend
pnpm dev                  # http://localhost:3000
```

Requirements: **Node 22**, **pnpm 10** (both pinned via Volta and
`packageManager`).

### Mock-first

Every screen reads through a typed **Service Seam** in `src/services/*`. With
no `DATABASE_URL`, the seams return in-memory seed data, so the Website runs
with no database. A seam's Drizzle arm is chosen when `DATABASE_URL` is set,
and the pages don't change. The Catalogue and Admin seams have their Drizzle
arms: the Website reads Postgres, and the Admin reads and writes it. With
Supabase configured too, Staff sign in with Google (see Admin). See [ADR 0003](docs/adr/0003-mock-first-service-seam.md)
and [ADR 0006](docs/adr/0006-drizzle-data-layer.md).

### Local database (Supabase)

**Development uses the hosted project** (spec Phase 2: Environments): with no
Docker, `.env` points `pnpm dev` at it (see Admin → Signing in locally). No
test touches it: `pnpm test` runs on the mock, `pnpm test:e2e` on the
in-memory sample data, and the database tests and the live-mode Admin e2e run
in CI, on a throwaway local Supabase. Until launch the hosted data is working
data; after launch, every Admin save from your machine is a live edit.

A **local Supabase** in Docker is optional: it's what CI runs, and what
`pnpm test:db` needs on your machine. To run it:

1. Install **Docker** (Docker Desktop, or Colima) and start it.
2. Start Supabase and apply `supabase/migrations`:

   ```bash
   pnpm db:start            # supabase start (the first run pulls the images)
   supabase status          # prints the local URL and keys
   ```

3. Put the local values in `.env`:

   | Variable                               | Value                                                     |
   | -------------------------------------- | --------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | the **API URL** (`http://127.0.0.1:54321`)                |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the **Publishable** key (`sb_publishable_…`)              |
   | `SUPABASE_SECRET_KEY`                  | the **Secret** key (`sb_secret_…`); server-only           |
   | `DATABASE_URL`                         | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
   | `TEST_DATABASE_URL`                    | the same local database, for `pnpm test:db`               |
   | `TEST_SUPABASE_SECRET_KEY`             | the same Secret key, for the Storage tests in `test:db`   |

4. Build the database and load the catalogue:

   ```bash
   pnpm db:reset            # supabase db reset, then pnpm catalogue:seed --local
   ```

**Updating an older `.env`:** the anon key variable is now
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, with no fallback. Rename that line.

`pnpm db:stop` stops the containers. `pnpm db:reset` rebuilds the local
database from `supabase/migrations` and loads the Phase 1 seed into it, with
the sample Staff for "Sign in as".

**Loading the catalogue.** `pnpm catalogue:seed` checks the seed, then writes
it in one transaction and prints what it wrote (Exams, Subjects, Products Live
and Coming Soon, Reviews, FAQs, photos). Every Product photo is uploaded from
`public/products/<slug>/` into the Storage bucket, at
`products/<product id>/<file>`, and the Products are loaded with the bucket
URLs; `public/products/` stays, for the sample data and the tests. The command
needs `SUPABASE_SECRET_KEY`, and `NEXT_PUBLIC_SUPABASE_URL` except with
`--local` (which uses local Supabase); a load without `--production` only
uploads to a local Supabase. A missing photo file stops it before anything is
written. A local load also replaces the Admin's data (the staff list, Staff
Activity, save stamps) with the sample Staff; `--production` never adds Staff.

| Command                            | Loads into                  | When data is there           |
| ---------------------------------- | --------------------------- | ---------------------------- |
| `pnpm catalogue:seed --local`      | the local Supabase database | replaces it, with the Staff  |
| `pnpm catalogue:seed`              | `DATABASE_URL` (local only) | replaces it, with the Staff  |
| `pnpm catalogue:seed --production` | `DATABASE_URL`              | refuses, and changes nothing |

`pnpm catalogue:seed --production --check` is that load's dry run: it
validates the seed and reads its photos, then says what it would load into
an empty catalogue, or "would refuse" (exit 1), and writes nothing.

`--production` is for the one load into the empty hosted database; it never
deletes. The command never prints `DATABASE_URL` or the secret key: a failure
shows only its error code. The Website caches its reads, so restart `pnpm dev` after
`pnpm db:reset`, `pnpm catalogue:seed` or `pnpm test:db` to see the new data.

**Migrations.** The Drizzle schema (`src/lib/db/schema.ts`) is the source of
truth. `pnpm db:generate` writes a timestamped migration into
`supabase/migrations`; hand-written SQL sits beside it (`pnpm db:generate
--custom --name=<name>` makes an empty one). Production applies them with
`supabase db push`. Every table enables RLS with no policies: the server
checks access, and the browser keys reach nothing.

**Photos (Storage).** Product photos and Exam share images live in the public
`catalogue` bucket, which a migration creates. The bucket itself refuses
anything but a JPEG, PNG or WebP of up to 10 MB, and `storage.objects` has no
policy for the browser keys. An upload goes straight from the browser to a
one-time signed upload URL, which the server makes with
`SUPABASE_SECRET_KEY` (`src/lib/supabase/admin.ts`, server-only): an existing
Product's photos go to `products/<id>/`, a new Product's to `products/new/`,
and share images to `exam-pages/<code>/`. Once a save commits, the files of
the photos it removed, of a deleted Product and of a replaced share image are
deleted; a failed delete is logged and never fails the save. With the
database configured but no secret key, an upload fails with "Storage isn't
configured on this server." next/image loads the bucket's files from
`NEXT_PUBLIC_SUPABASE_URL`'s host.

**Database tests** (`*.db.test.ts`) run against `TEST_DATABASE_URL`, never
`DATABASE_URL`. Without it, or with Supabase stopped, they are skipped with
the reason, so `pnpm test` needs no Docker. They run the Catalogue seam's
whole behaviour suite on the database, and with `TEST_DATABASE_URL` set,
`pnpm test:db` also runs every Admin suite (`src/services/admin.*.test.ts`)
over the Admin's database arm. They replace the local catalogue and staff list
as they go. The Storage tests (the bucket's rules, the upload seam, the seed's
photos and the clean-up after a save) also need `TEST_SUPABASE_SECRET_KEY`;
with it, the Admin suites upload through Storage too.

`supabase/config.toml` is for local Supabase only. Its Postgres major version
matches the hosted project. Its Google provider is off unless
`SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED=true` is set, with the client id and
secret read from the shell (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`,
`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`, never written down); off,
"Continue with Google" says "Google sign-in isn't set up on this server".
Email/password is on for the e2e test Users only. The hosted project has Google
only, with Email turned off, set in its dashboard (the runbook, step 8).

---

## Admin

The Admin (`/admin`) runs in one of three modes (`src/lib/admin/mode.ts`):

| Mode       | When                                                                      | Staff sign in                 |
| ---------- | ------------------------------------------------------------------------- | ----------------------------- |
| **live**   | `DATABASE_URL` and Supabase both set, local or hosted, any build          | with Google, through Supabase |
| **sample** | otherwise, outside production, with no database or a local one            | from the "Sign in as" list    |
| **closed** | otherwise: production without both, or a hosted database with no Supabase | nobody: every route is 404    |

Live, "Continue with Google" runs Supabase's OAuth flow (PKCE) and comes back
through `/auth/callback`. The Staff Guard reads the verified Google email
from `supabase.auth.getUser()`, never from the session cookie alone or
`user_metadata`, and checks the staff list on every request. Saves show on
the Website on its next load; on the database, each save and its Staff
Activity are written in one transaction.

**Signing in locally.** Two ways:

1. **Live, on the hosted project** (`.env` as `.env.example` describes):
   once the runbook's steps 6 to 8 are done (the first Owner, Google, and
   `http://localhost:3000/**` in the redirect URLs), `pnpm dev`, open
   http://localhost:3000/admin, and "Continue with Google" signs you in. Every
   save is a real edit to the hosted data.
2. **Sample, in memory:** comment out `DATABASE_URL` and the three Supabase
   lines in `.env`, then restart `pnpm dev`. "Sign in as" comes back, on an
   in-memory copy of the seed that a restart throws away. Uploaded photos
   stay in the dev server's memory too, served from `/api/dev/uploads/`, and
   never reach Storage.

Locally, `DATABASE_URL` must be the **Session pooler** string (Dashboard →
Connect → Session pooler, IPv4). The direct connection (`db.<ref>.supabase.co`)
is IPv6-only, which many home networks can't reach. Vercel uses the
Transaction pooler on port 6543 (the runbook, step 9).

**The first Owner.** `pnpm staff:add-owner <email>` makes the email an
active Owner on `DATABASE_URL`'s staff list, from nothing, an Editor or an
Invite, recorded in Staff Activity by `deployment`. Running it again changes
nothing. It prints the staff counts as `pnpm db:check` does, and never the
connection string. Type the email at the terminal; it never goes in the repo.
Production does this at the runbook's step 6.

**Sample mode's "Sign in as".** On the sign-in screen, "Continue with
Google" opens a development-only **Sign in as** list:

| User                 | Email                        | What happens                                     |
| -------------------- | ---------------------------- | ------------------------------------------------ |
| Angel Rose L. Lepaña | `angel@aceyourcourse.ph`     | Owner: every screen, Settings included           |
| AYC Content Team     | `content@aceyourcourse.ph`   | Editor: every screen but Settings                |
| Kim Reyes            | `kim.reyes@gmail.com`        | Invite: activates on first sign-in, as an Editor |
| Expired Invite       | `expired.invite@example.com` | 403: the Invite expired                          |
| Juan Dela Cruz       | `juan.delacruz@gmail.com`    | 403: not on the staff list                       |

The list's "Other email" field signs in with any address, such as one you've
just invited from Settings. Sample mode runs on the local database instead
when `DATABASE_URL` points at one with no Supabase set; `pnpm db:reset` puts
these Users on its staff list. "Sign in as" asks for no real sign-in, so it
never reaches a database off this machine.

**Reset.** In sample mode, the header's **Reset** button (beside SAMPLE
DATA) starts the sample data again from the seed, for every screen and the
Website. Tests do the same with `POST /api/dev/sample-data/reset`. On the
database, both re-seed it as `pnpm db:reset` does (the catalogue, the sample
Staff, no Staff Activity), and refuse unless `DATABASE_URL` points at this
machine (`localhost` or `127.0.0.1`). Live, the route works only on a local
database outside production, for a signed-in Staff User (CI's e2e), and is
404 everywhere else.

**Restarts.** Without a database, the sample data lives only in the dev
server's memory, so stopping `pnpm dev` loses every change: it starts again
from the seed.

**End-to-end tests.** `pnpm test:e2e` runs every Website and Admin journey
on the **in-memory sample data**, with no Docker. Its server gets the
database, Supabase and secret-key variables set to empty, so `.env`'s hosted
values never reach it (Next never replaces a variable that is set). When it
reuses a `pnpm dev` you started, that one must be in sample mode too, or the
setup step's reset fails with 404. In CI, the `PLAYWRIGHT_DATABASE_URL`,
`PLAYWRIGHT_SUPABASE_URL`, `PLAYWRIGHT_SUPABASE_PUBLISHABLE_KEY` and
`PLAYWRIGHT_SUPABASE_SECRET_KEY` variables point the run at the runner's
local Supabase instead, and the Admin journeys run live: a global setup loads
the seed and makes the sample Staff password Users with the secret key, and
each spec signs in with a password and writes the session cookie into the
browser. The config refuses any of those that names a host off this machine.
CI runs both: every journey on the sample data, then the Admin ones live.

## Environment variables

Every variable the app reads (`src/env.ts`, and the server-only
`src/env.server.ts`). Locally they go in `.env` (copy `.env.example`); in
production, in Vercel's Production environment only (the runbook's step 9).
Secrets are server-only, and never get a `NEXT_PUBLIC_` name.

| Variable                               | Local (`.env`)                            | Production (Vercel)                       | Secret  |
| -------------------------------------- | ----------------------------------------- | ----------------------------------------- | ------- |
| `NEXT_PUBLIC_SITE_URL`                 | `http://localhost:3000`                   | the site URL                              | no      |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<ref>.supabase.co`               | `https://<ref>.supabase.co`               | no      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the project's `sb_publishable_…`          | the project's `sb_publishable_…`          | no      |
| `SUPABASE_SECRET_KEY`                  | the project's `sb_secret_…` (Storage)     | the project's `sb_secret_…`               | **yes** |
| `DATABASE_URL`                         | the Session pooler, or unset for the mock | the transaction pooler, port 6543         | **yes** |
| `MEMBER_APP_LIVE`                      | `false`                                   | unset (off) until the Member App launches | no      |
| `NEXT_PUBLIC_LOG_LEVEL`                | `ALL`                                     | `WARN`                                    | no      |
| `NEXT_PUBLIC_AUTH_STRATEGY`            | `SUPABASE`, the only one                  | unset (`SUPABASE`)                        | no      |
| `NEXT_PUBLIC_SITE_VERSION`             | empty                                     | optional, e.g. the git sha                | no      |
| `NEXT_PUBLIC_POSTHOG_KEY`              | unset (analytics off)                     | the PostHog project token, when live      | no      |
| `NEXT_PUBLIC_POSTHOG_HOST`             | unset                                     | the PostHog ingestion host, with the key  | no      |

Locally, `DATABASE_URL` is the hosted project's **Session pooler** (IPv4),
not the IPv6-only direct connection; with a local Supabase, its values from
`supabase status` go in the same places. Vercel sets `NEXT_PUBLIC_VERCEL_URL`
itself. The tests' variables (`TEST_DATABASE_URL`, `TEST_SUPABASE_SECRET_KEY`,
and the `PLAYWRIGHT_*` ones) name a local Supabase only, and never go in
Vercel. A test (`src/env-names.test.ts`)
checks this table, `.env.example` and the runbook list every variable, and
another (`src/repo-secrets.test.ts`) that no file in the repo holds a
secret key, a Google client secret or a connection string with a real
password.

## Scripts

| Command                          | What it does                                |
| -------------------------------- | ------------------------------------------- |
| `pnpm dev`                       | Start the dev server (Turbopack)            |
| `pnpm build` / `pnpm start`      | Production build / serve                    |
| `pnpm lint`                      | ESLint                                      |
| `pnpm type:check`                | TypeScript, no emit                         |
| `pnpm test` / `pnpm test:watch`  | Vitest unit + component tests               |
| `pnpm test:coverage`             | Vitest with the coverage thresholds CI runs |
| `pnpm test:e2e`                  | Playwright end-to-end tests                 |
| `pnpm test:db`                   | The database tests alone (local Supabase)   |
| `pnpm db:start` / `pnpm db:stop` | Start / stop local Supabase (Docker)        |
| `pnpm db:reset`                  | Rebuild the local database, load the seed   |
| `pnpm catalogue:seed`            | Load the seed into the catalogue tables     |
| `pnpm db:check`                  | Read-only health check of `DATABASE_URL`    |
| `pnpm staff:add-owner <email>`   | Make the email an Owner on `DATABASE_URL`   |
| `pnpm db:generate`               | Generate a Drizzle migration (no DB needed) |
| `pnpm format`                    | Prettier                                    |

---

## Architecture

```
src/
  app/
    (website)/           The public Website (route group)
    auth/callback/       OAuth PKCE callback, kept for Phase 2's Google sign-in
  components/
    ui/                  shadcn components (owned, edit freely)
    website/             Website components
  content/               Website copy
  services/              Service seams: typed, mock-by-default data access
    catalogue.ts         The Reference Feature — copy it to build your own
  lib/
    supabase/            Browser / server / middleware clients
    auth/                getSession, sign-out action
    db/                  Drizzle client and schema (empty until Phase 2)
  config.ts  paths.ts  middleware.ts
```

**Data flow.** Server Components read through `src/services/*`. Mutations run
in zod-validated Server Actions. To go live, a seam gains a database arm — the
signatures stay the same. See
[ADR 0004](docs/adr/0004-rsc-server-actions-first.md).

**Adding a feature.** Copy the Catalogue: a `services/<name>.ts` seam with
`.mock.ts`, `.types.ts` and `.schema.ts`, pages under `app/(website)/` (or,
later, `app/admin/`), and components under `components/website/<feature>/`.
The template's Server Action, data-table and RLS-integration-test examples
(Customers) live in git history at commit `aea34ea`.

---

## Deploy

**Vercel** — production runs on Vercel and the hosted Supabase project, both
in Singapore ([ADR 0012](docs/adr/0012-vercel-and-supabase-singapore.md)).
Switching it on (the migrations, the one-time seed, the first Owner, Google
sign-in, the Vercel variables and a smoke checklist) is in the runbook,
[`docs/runbooks/production.md`](docs/runbooks/production.md).

`pnpm db:check` checks any database read-only, inside a READ ONLY
transaction: the Postgres version against `supabase/config.toml`, the
migrations applied against `supabase/migrations`, that every table is
deny-all (RLS on, no policy or grant for `anon` or `authenticated`), the
`catalogue` bucket's limits, and the catalogue and staff counts. It exits 1
when a check fails, naming what's wrong, and never prints `DATABASE_URL`.

**Self-host (Docker)** — the app builds to a standalone server:

```bash
docker compose up --build      # serves on :3000, reads .env
```

For a reverse-proxy setup, see the commented block in `docker-compose.yml`.

---

## License

MIT — see [LICENSE](LICENSE).
