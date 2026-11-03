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
arms: the Website reads Postgres, and the Admin reads and writes it. Sign-in
stays on the sample "Sign in as" list until Google sign-in lands (see Admin
prototype). See [ADR 0003](docs/adr/0003-mock-first-service-seam.md)
and [ADR 0006](docs/adr/0006-drizzle-data-layer.md).

### Local database (Supabase)

Development and every test use a **local Supabase** in Docker. The hosted
project is production only; its values live in Vercel, never in `.env`.

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

4. Build the database and load the catalogue:

   ```bash
   pnpm db:reset            # supabase db reset, then pnpm catalogue:seed --local
   ```

**Updating an older `.env`:** the anon key variable is now
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, with no fallback. Rename that line,
and replace any hosted values (`NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL`)
with the local ones above.

`pnpm db:stop` stops the containers. `pnpm db:reset` rebuilds the local
database from `supabase/migrations` and loads the Phase 1 seed into it, with
the sample Staff for "Sign in as".

**Loading the catalogue.** `pnpm catalogue:seed` checks the seed, then writes
it in one transaction and prints what it wrote (Exams, Subjects, Products Live
and Coming Soon, Reviews, FAQs). Photos keep their `/products/…` paths for now.
A local load also replaces the Admin's data (the staff list, Staff Activity,
save stamps) with the sample Staff; `--production` never adds Staff.

| Command                            | Loads into                  | When data is there           |
| ---------------------------------- | --------------------------- | ---------------------------- |
| `pnpm catalogue:seed --local`      | the local Supabase database | replaces it, with the Staff  |
| `pnpm catalogue:seed`              | `DATABASE_URL` (local only) | replaces it, with the Staff  |
| `pnpm catalogue:seed --production` | `DATABASE_URL`              | refuses, and changes nothing |

`--production` is for the one load into the empty hosted database; it never
deletes. The command never prints `DATABASE_URL`: a failure shows only its
error code. The Website caches its reads, so restart `pnpm dev` after
`pnpm db:reset`, `pnpm catalogue:seed` or `pnpm test:db` to see the new data.

**Migrations.** The Drizzle schema (`src/lib/db/schema.ts`) is the source of
truth. `pnpm db:generate` writes a timestamped migration into
`supabase/migrations`; hand-written SQL sits beside it (`pnpm db:generate
--custom --name=<name>` makes an empty one). Production applies them with
`supabase db push`. Every table enables RLS with no policies: the server
checks access, and the browser keys reach nothing.

**Database tests** (`*.db.test.ts`) run against `TEST_DATABASE_URL`, never
`DATABASE_URL`. Without it, or with Supabase stopped, they are skipped with
the reason, so `pnpm test` needs no Docker. They run the Catalogue seam's
whole behaviour suite on the database, and with `TEST_DATABASE_URL` set,
`pnpm test:db` also runs every Admin suite (`src/services/admin.*.test.ts`)
over the Admin's database arm. They replace the local catalogue and staff list
as they go.

The session plumbing and the OAuth callback (`/auth/callback`) are kept for
Phase 2's Google sign-in. A minimal `supabase/config.toml` is included; its
Postgres major version matches the hosted project.

---

## Admin prototype

The Admin runs on the **local database** when `DATABASE_URL` is set, and on
**sample data** otherwise: an editable, in-memory copy of the Website's seed,
held by the dev server. Either way, saves in the Admin show on the Website on
its next load. On the database, each save and its Staff Activity are written
in one transaction. There is no Google sign-in yet: Staff sign in from the
sample list below, which `pnpm db:reset` puts on the local staff list.

**Run it**

```bash
pnpm dev                  # then open http://localhost:3000/admin
```

Run `pnpm db:reset` first to work on the local database (Docker running), or
leave `DATABASE_URL` unset for the in-memory sample data. With `DATABASE_URL`
pointing anywhere else (such as the hosted database), the Admin stays closed
(404): "Sign in as" asks for no real sign-in, so it never reaches a database
off this machine.

Playwright (`pnpm test:e2e`) runs on the local database: its server's
`DATABASE_URL` is the local Supabase database, whatever `.env` says, and a
setup step resets it through the reset route before any spec. Start Supabase
first (`pnpm db:start`). `PLAYWRIGHT_DATABASE_URL` points the run at another
local database. When it reuses a `pnpm dev` you started, that one must use a
local database too, or the reset step fails with 403.

**Sign in as a sample User.** On the sign-in screen, "Continue with Google"
opens a development-only **Sign in as** list:

| User                 | Email                        | What happens                                     |
| -------------------- | ---------------------------- | ------------------------------------------------ |
| Angel Rose L. Lepaña | `angel@aceyourcourse.ph`     | Owner: every screen, Settings included           |
| AYC Content Team     | `content@aceyourcourse.ph`   | Editor: every screen but Settings                |
| Kim Reyes            | `kim.reyes@gmail.com`        | Invite: activates on first sign-in, as an Editor |
| Expired Invite       | `expired.invite@example.com` | 403: the Invite expired                          |
| Juan Dela Cruz       | `juan.delacruz@gmail.com`    | 403: not on the staff list                       |

The list's "Other email" field signs in with any address, such as one you've
just invited from Settings.

**Reset.** The header's **Reset** button (beside SAMPLE DATA) starts the
sample data again from the seed, for every screen and the Website. Tests do
the same with `POST /api/dev/sample-data/reset`. On the database, both re-seed
it as `pnpm db:reset` does (the catalogue, the sample Staff, no Staff
Activity), and refuse with 403 unless `DATABASE_URL` points at this machine
(`localhost` or `127.0.0.1`).

**Restarts.** Without a database, the sample data lives only in the dev
server's memory, so stopping `pnpm dev` loses every change: it starts again
from the seed. On the database, changes stay until a reset. Uploaded photos
stay in the dev server's memory either way until photo storage lands.

**Production keeps the Admin closed.** In a production build (`pnpm build`,
`pnpm start`), every `/admin` page and the development-only routes under
`/api/dev/` answer 404, and every Admin action is refused. The Admin opens in
production only in Stage B, with the database and Google sign-in.

---

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

**Vercel** — import the repo and deploy. Set `NEXT_PUBLIC_SITE_URL`, and the
Supabase variables once Phase 2 needs them: the hosted project's URL,
publishable key, secret key and transaction-pooler `DATABASE_URL`. In the hosted
project, under **Authentication → URL Configuration**, set the Site URL to the
production domain and add `<domain>/**` as a redirect URL. Apply migrations
with `supabase db push`. See
[ADR 0012](docs/adr/0012-vercel-and-supabase-singapore.md).

**Self-host (Docker)** — the app builds to a standalone server:

```bash
docker compose up --build      # serves on :3000, reads .env
```

For a reverse-proxy setup, see the commented block in `docker-compose.yml`.

---

## License

MIT — see [LICENSE](LICENSE).
