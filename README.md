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

### Connect Supabase (optional in Phase 1)

The Website needs no Supabase. The session plumbing and the OAuth callback
(`/auth/callback`) are kept for Phase 2's Google sign-in. To point them at a
project — hosted or local:

**Hosted**

1. In your Supabase project, open **Settings → Data API** and copy the **Project
   URL** into `NEXT_PUBLIC_SUPABASE_URL`.
2. Open **Settings → API Keys** and copy the **anon/public** key into
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Under **Authentication → URL Configuration**, set the Site URL to
   `http://localhost:3000` and add `http://localhost:3000/**` as a redirect URL.

**Local (Supabase CLI)**

```bash
supabase start           # prints the API URL and anon key
```

Copy the printed values into `.env`. A minimal `supabase/config.toml` is
included; run `supabase init` to regenerate a full one for your CLI version.

---

## Scripts

| Command                         | What it does                                |
| ------------------------------- | ------------------------------------------- |
| `pnpm dev`                      | Start the dev server (Turbopack)            |
| `pnpm build` / `pnpm start`     | Production build / serve                    |
| `pnpm lint`                     | ESLint                                      |
| `pnpm type:check`               | TypeScript, no emit                         |
| `pnpm test` / `pnpm test:watch` | Vitest unit + component tests               |
| `pnpm test:coverage`            | Vitest with the coverage thresholds CI runs |
| `pnpm test:e2e`                 | Playwright end-to-end tests                 |
| `pnpm db:generate`              | Generate a Drizzle migration (no DB needed) |
| `pnpm format`                   | Prettier                                    |

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
Supabase variables once Phase 2 needs them. See
[ADR 0012](docs/adr/0012-vercel-and-supabase-singapore.md).

**Self-host (Docker)** — the app builds to a standalone server:

```bash
docker compose up --build      # serves on :3000, reads .env
```

For a reverse-proxy setup, see the commented block in `docker-compose.yml`.

---

## License

MIT — see [LICENSE](LICENSE).
