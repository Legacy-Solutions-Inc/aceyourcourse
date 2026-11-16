# Production go-live

How to switch production on: the hosted Supabase project (database, Storage
and Google sign-in) and the Vercel deployment. You run every step yourself.
Work through it in order, and do each step's **Check** before moving on.

Hosting is Vercel Pro and Supabase Pro, both in Singapore
([ADR 0012](../adr/0012-vercel-and-supabase-singapore.md)). The other launch
items (the client's catalogue spreadsheet, the lawyer's review of Legal v1.0,
the PostHog key) are listed in the spec under **Further Notes → Launch
blockers and checklist** ([`docs/specs/2026-10-29-ayc-v1.md`](../specs/2026-10-29-ayc-v1.md)).

**Placeholders.** Replace each one with your own value as you go. Never
commit any of these values, or paste them into a file in the repo.

| Placeholder         | What it is                                                               |
| ------------------- | ------------------------------------------------------------------------ |
| `<ref>`             | the Supabase project's reference ID (Project Settings → General)         |
| `<site-url>`        | the production site URL, e.g. `https://<domain>`, with no trailing slash |
| `<password>`        | the database password (Project Settings → Database)                      |
| `<pooler-host>`     | the pooler's host, e.g. `aws-0-ap-southeast-1.pooler.supabase.com`       |
| `<owner-email>`     | the first Owner's Google email, typed at step 6 only                     |
| `<publishable-key>` | the project's publishable key (`sb_publishable_…`): not a secret         |

**Keeping secrets out of files.** The scripts read `.env`, but a variable
already set in your shell wins over `.env`. So put production values in the
shell for this session only, with `read -s` (nothing is echoed or kept in your
shell history), and unset them at the end (step 12). In zsh:

```sh
read -rs "DATABASE_URL?Transaction pooler connection string: " && export DATABASE_URL
```

In bash, `read -rsp "Transaction pooler connection string: " DATABASE_URL && export DATABASE_URL`.

---

## 0. Before you start

- The Supabase CLI is installed and signed in: `supabase --version`, then
  `supabase login`.
- The hosted Supabase project is on Pro, in Southeast Asia (Singapore)
  (`ap-southeast-1`).
- The Vercel project is imported from this repo, with its functions in
  Singapore (`sin1`): Project Settings → Functions → Function Region.
- You're on the commit you're deploying, with a clean tree:

  ```sh
  git status --short
  pnpm install
  ```

**Check:** `git status --short` prints nothing, and `supabase --version`
prints a version.

## 1. Link the project

```sh
supabase link --project-ref <ref>
```

It asks for the database password (`<password>`).

**Check:** it ends with `Finished supabase link.` If it warns that the local
database version differs from the linked project, stop: see step 2.

## 2. Check the Postgres version

Local Supabase runs the major version in `supabase/config.toml`
(`[db] major_version = 17`). The hosted project must run the same major
version, so migrations behave the same in both.

**Check:** Project Settings → Infrastructure shows Postgres 17.x. If it shows
another major version, stop and decide (upgrade the hosted project, or change
`major_version` and rerun the database tests locally) before pushing. Step 4's
`pnpm db:check` checks this again.

## 3. Apply the migrations

First see what would be applied, then apply it:

```sh
supabase db push --dry-run
supabase db push
```

The project's direct connection (`db.<ref>.supabase.co:5432`) is IPv6 only,
and fails with `ENOTFOUND` on an IPv4-only network. If the push fails like
that, use the **Session pooler** connection string instead (Connect → Session
pooler, port 5432):

```sh
read -rs "SESSION_URL?Session pooler connection string: "
supabase db push --dry-run --db-url "$SESSION_URL"
supabase db push --db-url "$SESSION_URL"
unset SESSION_URL
```

A password with characters such as `@`, `:` or `/` must be percent-encoded
in a connection string (`@` is `%40`), here and in `DATABASE_URL`.

**Check:** `supabase migration list` shows every migration in both the Local
and Remote columns.

## 4. Check the database

Put the **Transaction pooler** connection string in the shell (Connect →
Transaction pooler, port 6543). It has this form:
`postgresql://postgres.<ref>:<password>@<pooler-host>:6543/postgres`.

```sh
read -rs "DATABASE_URL?Transaction pooler connection string: " && export DATABASE_URL
pnpm db:check
```

`pnpm db:check` only reads, inside a READ ONLY transaction. It never prints
the connection string.

**Check:** it exits 0, and prints:

```text
Checking a database on another machine (read-only):
✓ Postgres 17.x, the same major version as supabase/config.toml (17)
✓ Migrations: all N in supabase/migrations are applied
✓ Deny-all: N tables in public, each with RLS on and no policy or grant for the browser roles
✓ Storage bucket "catalogue": public, 10 MB limit, image/jpeg, image/png, image/webp
  Catalogue: 0 Exams, 0 Subjects, 0 Products (0 Live, 0 Coming Soon), …
  Staff: 0 Owners, 0 Editors, 0 Invites
All checks passed. Nothing was written.
```

A `✗` line names what's wrong (a migration not applied, a table with RLS off
or a policy for `anon`, the bucket's limits). It exits 1 then. Fix that
before going on.

## 5. Load the catalogue, once

The seed's photos go into the hosted project's Storage, so the command needs
the hosted URL and secret key too. Put them in the shell, so `.env`'s local
values can't be used:

```sh
export NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
read -rs "SUPABASE_SECRET_KEY?Secret key (sb_secret_…): " && export SUPABASE_SECRET_KEY
```

The secret key is in Project Settings → API Keys → Secret keys. Create one
named for this, e.g. `vercel`.

First the dry run, which validates the seed, reads every photo and checks the
catalogue is empty. It writes and uploads nothing:

```sh
pnpm catalogue:seed --production --check
```

**Check:** it exits 0, and prints `Dry run: would load into the production
database:`, the counts, the number of photos, then `Nothing was written.` If
it prints `Dry run: would refuse: catalogue data exists`, the database isn't
empty: stop, and find out why before going on.

Then load it:

```sh
pnpm catalogue:seed --production
```

The load runs in one transaction: a failure writes nothing to the database,
and it's safe to run again. Photos it uploaded before failing stay in the
bucket, and the next run overwrites them at the same paths.

**Check:** it prints `Loaded the catalogue into the production database:`
with the same counts. Then `pnpm db:check` shows those counts, and a second
`pnpm catalogue:seed --production --check` says `would refuse`.

## 6. Add the first Owner

With the step 4 `DATABASE_URL` still in the shell:

```sh
pnpm staff:add-owner <owner-email>
```

Type the Owner's Google email in the terminal only; never write it in the
repo, this runbook, or `.env`. It makes that email an active Owner on the
staff list, recorded in Staff Activity by `deployment`. It's safe to run
again: an Owner already is left as they are. It never prints the connection
string.

**Check:** it exits 0, and prints:

```text
On a database on another machine:
✓ Added <owner-email> as an Owner.
  Staff: 1 Owner, 0 Editors, 0 Invites
```

(Run again, the second line says `is an Owner already. Nothing was
changed.`) Then `pnpm db:check` shows the same `Staff: 1 Owner, 0 Editors, 0
Invites` line. The Owner's name shows as their email until they sign in with
Google the first time. That sign-in names them from their Google profile (for
display only, with no Staff Activity), and Settings shows it.

### While you develop, before go-live

Until go-live, `pnpm dev` on this project can sign in with a password: the
sign-in screen's **Development only** box, under "Continue with Google". It
shows only under `pnpm dev`, and only while this project has its Email
provider on. Production builds never count a password sign-in, whatever
Supabase's settings say, unless you turn on testing on the deployed site
(below). The app has no sign-up and no password reset, so you
make each password User by hand:

1. **Your own User:** Supabase dashboard → **Authentication → Users → Add
   user → Create new user**, with `<owner-email>` and a password of your
   own, and **Auto Confirm User** ticked. Sign in with it on
   http://localhost:3000/admin/sign-in.
2. **Test Editors:** in the Admin, **Settings → Staff & Invites**, invite
   plus-addresses of your own (`you+editor@…`), then create each the same way
   (Add user → Create new user, Auto Confirm User ticked). The Invite
   activates on its first sign-in.
3. Keep **Confirm email** on (**Authentication → Sign In / Providers →
   Email**). Sign-ups stay open, because a first Google sign-in is a sign-up
   too, so Confirm email is what keeps a stranger's sign-up from counting.
4. Never click a "Confirm your signup" email you didn't ask for.

Steps 7 and 8 can wait until go-live.

#### Testing on the deployed site

While you test the deployed site, its sign-in screen can show the same box,
headed **TESTING ONLY**, under "Continue with Google", so Staff can sign in
with the password Users above. It's temporary, and is removed once testing is done.

1. **Turn it on:** Vercel → Project → **Settings → Environment Variables**,
   environment **Production**: add `ADMIN_PASSWORD_SIGN_IN` with the value
   `true`. Then **Deployments → Redeploy** the latest production deployment:
   a variable changes nothing until the next deploy.
2. Keep this project's **Email** provider on, with **Confirm email** on. The
   box shows only while Supabase says Email is on.
3. Open `<site-url>/admin/sign-in`, and sign in with the **TESTING ONLY**
   box. Only emails on the staff list get in; anyone else lands on the
   "denied" screen, as with Google.
4. **Turn it off:** set `ADMIN_PASSWORD_SIGN_IN` to `false` (or delete it),
   and redeploy. The box is gone, and a password session no longer counts,
   even one already signed in. Turning the Email provider off ends it too.

Only `true` turns it on. Any other value (`yes`, `1`, `TRUE`) stops the
deployment from starting, with a message naming `ADMIN_PASSWORD_SIGN_IN`.

## 7. Set up Google sign-in (Google Cloud console)

In [Google Cloud console](https://console.cloud.google.com/), pick (or
create) the project for Ace Your Course, then open **Google Auth Platform**:

1. **Branding:** the app name (Ace Your Course), the user support email, and
   the app domain (home page, privacy policy `<site-url>/legal/privacy`,
   terms `<site-url>/legal/terms`). Under **Authorized domains**, add the
   site's domain and `<ref>.supabase.co`. Leave the logo out for launch:
   adding one starts Google's brand verification, which takes a few business
   days, even with only the scopes below.
2. **Audience:** User type **External**. Then **Publish app**, so its
   publishing status is **In production** (a "Testing" app only lets listed
   test users sign in).
3. **Data Access:** the scopes `openid`, `.../auth/userinfo.email` and
   `.../auth/userinfo.profile`. Add nothing else: these three need no Google
   verification.
4. **Clients → Create client:** application type **Web application**, named
   e.g. `Ace Your Course (production)`.
   - **Authorized JavaScript origins:** `<site-url>`
   - **Authorized redirect URIs:** `https://<ref>.supabase.co/auth/v1/callback`
     (the Supabase Google provider page shows this exact URL).
   - Create it, then copy the **Client ID** and the **Client secret**. Keep
     the secret out of every file: it goes only into Supabase (step 8).

**Check:** the client lists exactly that one origin and that one redirect URI,
with no `localhost` entries, and the Audience page shows **In production**.

## 8. Set up Supabase Auth (Supabase dashboard)

**First: end development sign-in.** If you signed in with a password while
you developed or tested (after step 6):

1. In Vercel, set `ADMIN_PASSWORD_SIGN_IN` to `false` (or delete it) for
   Production, and redeploy. The deployed site's **TESTING ONLY** box is
   gone, and it counts no password sign-in.
2. Remove the test Editors from the Admin's **Settings → Staff & Invites**.
3. Delete their Users (**Authentication → Users**).
4. Your own User stays: your first Google sign-in attaches Google to it.
5. 8.2 below turns Email off. After that the **Development only** box is
   gone on localhost too.

Then:

1. **Authentication → Sign In / Providers → Google:** enable it, and paste
   the **Client ID** (under Client IDs) and the **Client Secret** from step 7.
   Save.
2. **Authentication → Sign In / Providers → Email:** turn it **off**. Staff
   and Members sign in with Google only.
3. **Authentication → URL Configuration:**
   - **Site URL:** `<site-url>`
   - **Redirect URLs:** `<site-url>/auth/callback`. Use that exact path, with
     no wildcard, for the site.
   - While you develop against this project (`pnpm dev` with `.env` pointing
     at it), add `http://localhost:3000/**` too, so Google sign-in can come
     back to your machine. Supabase sends a sign-in back only to an address
     on this list. Remove it when nobody develops against production any
     more.

**Check:** Google is the only enabled provider, and the redirect list holds
`<site-url>/auth/callback`, plus `http://localhost:3000/**` only while you
develop against this project. Staff & Invites lists no test Editors, and
Authentication → Users has none of their Users. On localhost
(`pnpm dev`), the sign-in screen shows "Continue with Google" and no
**Development only** box.

## 9. Set the Vercel environment variables

Project Settings → Environment Variables. Set the hosted values for the
**Production** environment only, so Preview deployments never reach the
production database or Storage. (A Preview without them serves the built-in
seed, with the Admin closed.) Mark each secret **Sensitive**, so Vercel never
shows its value again.

| Variable                               | Value                                                                           | Secret             |
| -------------------------------------- | ------------------------------------------------------------------------------- | ------------------ |
| `NEXT_PUBLIC_SITE_URL`                 | `<site-url>`                                                                    | no                 |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<ref>.supabase.co`                                                     | no                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `<publishable-key>` (Project Settings → API Keys)                               | no                 |
| `SUPABASE_SECRET_KEY`                  | the secret key from step 5                                                      | **yes, Sensitive** |
| `DATABASE_URL`                         | the Transaction pooler string, port **6543**, from step 4                       | **yes, Sensitive** |
| `MEMBER_APP_LIVE`                      | leave **unset** (off) until the Member App launches                             | no                 |
| `ADMIN_PASSWORD_SIGN_IN`               | `true` only while you test the deployed site (see step 6); **unset** at go-live | no                 |
| `NEXT_PUBLIC_LOG_LEVEL`                | `WARN` (unset logs everything)                                                  | no                 |
| `NEXT_PUBLIC_AUTH_STRATEGY`            | leave unset (`SUPABASE`, the only one)                                          | no                 |
| `NEXT_PUBLIC_SITE_VERSION`             | optional, e.g. the release's git sha                                            | no                 |
| `NEXT_PUBLIC_POSTHOG_KEY`              | the PostHog project token, when analytics go live (ADR 0009)                    | no                 |
| `NEXT_PUBLIC_POSTHOG_HOST`             | `https://us.i.posthog.com`, or the EU host, with the key                        | no                 |

Never set `TEST_DATABASE_URL`, `TEST_SUPABASE_SECRET_KEY` or any
`PLAYWRIGHT_*` variable in Vercel: they're for tests only. Never give
a secret a `NEXT_PUBLIC_` name: that ships it to every browser.

The app needs the transaction pooler's port 6543: its database client turns
off prepared statements for it (`src/lib/db/connect.ts`).

**Check:** the Production environment lists exactly the variables above that
you set, with `SUPABASE_SECRET_KEY` and `DATABASE_URL` marked Sensitive, and
the Preview environment has neither.

## 10. Deploy

Environment variables only reach a new deployment. Deploy the commit from
step 0 to Production (push it to the production branch, or Deployments →
⋯ → **Redeploy**, unticking "Use existing build cache").

**Check:** the build succeeds, `<site-url>` loads, and a Product page shows its
price and photos.

## 11. Smoke checklist

Do these on `<site-url>` in a private window.

- [ ] **The Owner signs in with Google:** open `<site-url>/admin`, choose
      "Continue with Google", and sign in as `<owner-email>`. The Admin's
      Overview opens.
- [ ] **Invite an Editor, and the Editor signs in:** in Staff, invite a second
      Google account as an Editor. Signed in as that account (another private
      window), the Admin opens for it, and Staff shows it as active.
- [ ] **An edit goes live:** as the Owner or Editor, change a Product's price
      and save. The Product's page on the Website shows the new price after a
      reload. Change it back.
- [ ] **The Editor is refused Settings:** signed in as the Editor, Settings
      isn't in the menu, and opening `<site-url>/admin/settings` directly is
      refused.
- [ ] **A non-Staff Google account gets the 403 screen:** signed in with a
      Google account that isn't on the staff list, `/admin` shows "…isn't on
      the admin list. Nothing was changed.", with its time.
- [ ] **The publishable key reads nothing through the REST API:**

  ```sh
  curl -s "https://<ref>.supabase.co/rest/v1/products?select=id&limit=1" \
    -H "apikey: <publishable-key>"
  curl -s "https://<ref>.supabase.co/rest/v1/staff?select=email&limit=1" \
    -H "apikey: <publishable-key>"
  ```

  Each answers with a permission error (`"code":"42501"`) or `[]`, never a
  row.

- [ ] **The publishable key can't list Storage:**

  ```sh
  curl -s -X POST "https://<ref>.supabase.co/storage/v1/object/list/catalogue" \
    -H "apikey: <publishable-key>" -H "Content-Type: application/json" \
    -d '{"prefix":"products"}'
  ```

  It answers `[]`.

- [ ] **Photos load from Storage:** on a Product page, open a photo's address:
      it starts with `https://<ref>.supabase.co/storage/v1/object/public/catalogue/`.
      `curl -sI` on that address answers `200` with an `image/…` content type.
- [ ] **The Member App stays hidden:** no "Sign in" or "Start reviewing" on the
      Website (`MEMBER_APP_LIVE` is unset).

## 12. Clean up

```sh
unset DATABASE_URL SUPABASE_SECRET_KEY NEXT_PUBLIC_SUPABASE_URL
```

`.env` can stay pointed at this project for `pnpm dev` (README → Signing in
to the Admin locally). The development Admin then runs live, signing in with
Google: after launch, every save from your machine is a live edit.

**Check:** `env | grep -c -e DATABASE_URL -e SUPABASE_SECRET_KEY` prints `0`.

---

## Rollback

- **The app:** Deployments → the last good deployment → ⋯ → **Instant
  Rollback**. That brings back its build; check the environment variables are
  still what it needs. After a rollback, Vercel stops promoting new
  production deployments by itself: once a fix is deployed, promote it
  (⋯ → **Promote**), or it won't go live.
- **Take the site off the database:** remove `DATABASE_URL` from the
  Production environment and redeploy. The Website then serves the built-in
  Phase 1 seed and the Admin is closed. Edits made in the Admin stay in the
  database for when it's put back.
- **Migrations** only go forward; there are no down migrations. Fix a bad one
  with a new migration (`pnpm db:generate`, test it locally, `supabase db
push`). To undo data, restore a backup: Database → Backups (Pro keeps daily
  backups; point-in-time recovery is an add-on). Note the time before step 3,
  so you know which backup is from before the push.
- **The seed:** a failed load writes nothing, so run it again. A wrong
  catalogue that's loaded but not yet edited: restore the backup from before
  step 5, then load again. After launch, edit in the Admin instead: there's
  no re-import.
- **The wrong first Owner:** run `pnpm staff:add-owner` with the right email,
  then remove the wrong entry in Admin → Staff.
- **A leaked secret:** rotate it at once, then update Vercel and redeploy.
  - Secret key: Project Settings → API Keys → create a new secret key, put it
    in Vercel, then delete the old one.
  - Database password: Project Settings → Database → **Reset database
    password**, then update `DATABASE_URL` in Vercel.
  - Google client secret: Google Auth Platform → Clients → your client → add a
    new secret, put it in the Supabase Google provider, then delete the old one.
