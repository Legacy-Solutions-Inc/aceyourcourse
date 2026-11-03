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

Every screen reads through a typed **Service Seam** in `src/services/*`. Today
the seams return in-memory seed data, so the Website runs with no database. In
Phase 2 a seam gains a Drizzle arm, chosen when `DATABASE_URL` is set, and the
pages don't change. See [ADR 0003](docs/adr/0003-mock-first-service-seam.md)
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

**Updating an older `.env`:** the anon key variable is now
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, with no fallback. Rename that line,
and replace any hosted values (`NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL`)
with the local ones above.

`pnpm db:stop` stops the containers, and `pnpm db:reset` rebuilds the local
database from `supabase/migrations`.

**Migrations.** The Drizzle schema (`src/lib/db/schema.ts`) is the source of
truth. `pnpm db:generate` writes a timestamped migration into
`supabase/migrations`; hand-written SQL sits beside it (`pnpm db:generate
--custom --name=<name>` makes an empty one). Production applies them with
`supabase db push`. Every table enables RLS with no policies: the server
checks access, and the browser keys reach nothing.

**Database tests** (`*.db.test.ts`) run against `TEST_DATABASE_URL`, never
`DATABASE_URL`. Without it, or with Supabase stopped, they are skipped with
the reason, so `pnpm test` needs no Docker.

The session plumbing and the OAuth callback (`/auth/callback`) are kept for
Phase 2's Google sign-in. A minimal `supabase/config.toml` is included; its
Postgres major version matches the hosted project.

---

## Admin prototype

Until the database work (Stage B), the Admin runs on **sample data**: an
editable, in-memory copy of the Website's seed, held by the dev server. Saves
in the Admin show on the Website on its next load. There is no database and no
Google sign-in yet.

**Run it**

```bash
pnpm dev                  # then open http://localhost:3000/admin
```

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
the same with `POST /api/dev/sample-data/reset`.

**Restarts.** The sample data lives only in the dev server's memory, so
stopping `pnpm dev` loses every change: it starts again from the seed.

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
| `pnpm db:reset`                  | Rebuild the local database from migrations  |
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
