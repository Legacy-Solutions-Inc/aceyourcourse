# Security review

**Date:** 28 November 2026
**Commit reviewed:** `5d5230b` on `feat/phase5-video` (Phase 5 up to ticket
04, Lesson progress). The fixes below come after it.
**Scope:** the whole Platform: the Website, the Admin, the Member App,
payments (PayMongo) and video (VdoCipher). This is the "security review" item
of contract Milestone 4.
**How:** a reading of the code and its configuration, the project's automated
tests, a production build checked for leaked secrets, and `pnpm audit`.
Nothing was tested against the live site, the hosted database, PayMongo or
VdoCipher.

## Summary

The Platform is in good shape. The rules that matter most are in place and
covered by tests:

- **Only the server decides who sees what.** Every protected item (flashcard
  decks, quizzes, Reviewer PDF pages, video playback and Lesson progress) is
  checked on the server before anything is sent. The browser can't skip the
  check or talk to the database directly.
- **The database refuses the browser.** All 52 tables refuse direct access
  from the browser. The app reaches them only through the server.
- **Editors can't do what only Owners may.** The server refuses an Editor's
  call to an Owner-only action, even a request made by hand.
- **Secrets stay on the server.** The keys for the database, Supabase,
  PayMongo and VdoCipher never reach a web page. A production build was
  scanned to confirm this.
- **Payments and scheduled jobs check who is calling.** PayMongo's
  notifications must carry a valid signature, and the scheduled jobs need a
  secret.
- **Strong browser protections.** The site can't be framed by other sites,
  only its own scripts (and VdoCipher's player script) run, and VdoCipher's
  player is the only thing it embeds.

**Fixed during this review (2):**

1. The sign-in cookie can no longer be read by scripts on the page.
2. When a sign-in was renewed in the background, the renewed cookie wasn't
   sent back to the browser. That could sign people out about an hour after
   they signed in. It is now sent back.

**Follow-ups (11), most important first:**

1. **High: update Next.js**, the framework the site is built on. The version
   in use has published security problems, including critical ones.
2. **Medium: switch off and then remove the temporary password sign-in**
   before launch, as planned.

The other nine are low risk; see [Follow-ups](#follow-ups).

## Results at a glance

| #   | Area                               | Result                   |
| --- | ---------------------------------- | ------------------------ |
| 1   | Sign-in                            | Passed, with a follow-up |
| 2   | Database rules                     | Passed                   |
| 3   | Access to protected content        | Passed                   |
| 4   | Secrets                            | Passed                   |
| 5   | Browser protections                | Fixed, with follow-ups   |
| 6   | Uploads and form input             | Passed, with a follow-up |
| 7   | Personal data                      | Passed                   |
| 8   | Development routes and sample mode | Passed                   |
| 9   | Dependencies (`pnpm audit`)        | Follow-ups               |

---

## 1. Sign-in

**What was checked:** that Staff and Members sign in with Google only in
production. Also that nothing the browser sends can make someone Staff, and
that the temporary password sign-in is limited as intended.

**Result: passed, with a follow-up.** Google is the only sign-in that counts in
production. The temporary password sign-in counts only while its switch is on
(follow-up 2).

How it works, and how it was checked:

- **Google only.** Every request asks Supabase to verify the session
  (`getUser`) and reads how it signed in from the verified token's `amr`
  claim (`getClaims`). Google (`oauth`) always counts. Anything else (a
  magic link, a one-time code, an anonymous session, a missing claim) never
  counts, and is treated as signed out. See `src/lib/admin/sign-in-method.ts`
  and `src/lib/admin/identity.ts`; tested in `sign-in-method.test.ts` and
  `identity.live.test.ts`.
- **Only a verified email.** The email must be confirmed by Supabase or
  verified by Google. `user_metadata`, which a user can change themselves, is
  never read.
- **Staff come from the staff list, read on every request.** The Staff Guard
  (`src/lib/admin/guard.ts`) asks the staff list each time, so a removed or
  demoted Staff User loses access on their next request. Authorisation never
  comes from the browser.
- **The temporary password sign-in** (`ADMIN_PASSWORD_SIGN_IN`) counts only
  in two cases: in live mode under `pnpm dev`, or on a deployment where the
  switch is exactly `"true"`. A value other than `"true"` or `"false"` stops
  the deployment from starting. Switched off, a password session is signed out in both the
  Admin and the Member App, even one that was already open. It is unchanged
  by this review, as decided, and listed as follow-up 2.
- **Sign-in links can't send people elsewhere.** The address a sign-in
  returns to is sanitised to a path on the same part of the site
  (`safe-next.ts`, tested).
- **The "Sign in as" sample list** exists only with sample data, which can't
  run in production (area 8).

## 2. Database rules

**What was checked:** that every table refuses direct access from the browser.
Also that Members can read only their own data.

**Result: passed.**

- **Row Level Security on every table, with no browser policies.** All 52
  tables in `src/lib/db/schema.ts` enable RLS. No migration creates a policy.
  The first migration removes every privilege the browser roles (`anon`,
  `authenticated`) would get, for tables, sequences and functions, including
  ones created later.
- **Tested on a real database.** `src/lib/db/deny-all.db.test.ts` checks
  every table in `public`, so tables added later are covered too: RLS is on,
  there is no policy for the browser roles, and neither role holds a grant.
  It also names each Member App table, including Phase 5's `courses`,
  `course_modules`, `lessons`, `course_ownerships` and `lesson_progress`, so a
  missing table fails as well. `pnpm db:check` runs the same query against
  any database. _(Database tests run in CI, and skip locally without a test
  database. For this review the deny-all test was also run locally on PGlite,
  an in-memory Postgres, with every migration up to ticket 04: 40 of 40
  passed.)_
- **Storage.** The `content` (card images, imports) and `reviewer-pdfs`
  buckets are private, and only the server reaches them. The `catalogue`
  bucket is public by design: it holds Website product photos. It accepts
  only JPEG, PNG and WebP images up to 10 MB, and only the server can hand
  out an upload link.
- **Members read only their own data.** The app connects to the database on
  the server. Every Member App read and write uses the signed-in Member's
  id, taken from the verified session; no form sends it. The Member service
  tests prove a Member never sees another Member's data. See for example
  `member.billing.test.ts` ("never gives another Member's Orders"),
  `member.payments.test.ts`, `member.lesson-progress.test.ts`,
  `member.progress.test.ts` and `member.quiz.test.ts`.

## 3. Access to protected content

**What was checked:**

- that every protected read goes through the access decision on the server:
  decks, quizzes, Reviewer PDF pages, video playback passes and Lesson
  progress saves;
- that Owner-only actions refuse Editors on the server;
- that Admin pages refuse anyone who isn't Staff.

**Result: passed.**

- **One access decision, on the server.** `src/lib/member-app/access.ts` is
  a single pure rule. In order, it checks the beta gate, the Active Device,
  whether the item is available, Staff, the Access Pass, Course Ownership and
  Free Preview. Its inputs are read on the server for every request
  (`src/lib/member-app/access-check.ts`). It has a table of tests covering
  every case (`access.test.ts`).
- **Every protected read uses it.**
  - Deck cards, quiz questions and Reviewer PDF pages: `study-access.ts`.
    - `flashcards.test.tsx`: "never sends a locked deck's cards to the
      browser", "sends a replaced device to the Active Device screen", and
      "refuses a mark from a replaced device, changing nothing".
    - `quiz.test.tsx`: "never sends a locked quiz's questions to the
      browser", and "sends a replaced device to the Active Device screen".
  - The Reviewer PDF page endpoint (`/app/reviewer-pdfs/<id>/pages/<page>`)
    answers 403 with no image for a locked item. It sends the page only with
    the Member's email and short Member ID stamped into it, never the clean
    page or the original PDF.
    - The service is tested in `member.reviewer.test.ts`: "refuses a locked
      or expired Member's page with no image, recording nothing", and
      "refuses a replaced device, and a request with no device token".
    - The endpoint itself is tested in `reviewer-reader.test.tsx`: "decides
      before it reads the page number: a locked Member isn't told which pages
      exist", "sends a replaced device to “Session ended”, with no page", and
      "sends a request with no device token to “Use the Member App on this
      device”, with no page". That file's image-library setup timed out on the
      review machine, on `5d5230b` too, so it wasn't run for this review.
  - The video playback pass: `openLesson` asks VdoCipher for a pass only
    after the decision allows the Lesson (`member.courses.test.ts`: "refuses
    a locked Lesson, even by its address, and asks for no pass", "gives no
    pass to a replaced device, or a request with no device token").
  - Lesson progress saves (`member.lesson-progress.test.ts`: "refuses a save
    and Mark complete from a replaced device", "refuses a save for a Lesson
    the Member can't open").
- **Every Member App Server Action is listed and tested.**
  `src/app/app/actions.gate.test.ts` calls each one as a browser would. It
  checks four refusals: signed out, refused by the beta gate, without
  consent, and from a device that isn't the Member's Active Device (no token,
  or a replaced one). An action added later that isn't in its list fails the
  test.
- **Every Admin Server Action is listed and tested.**
  `src/app/admin/actions.permissions.test.ts` calls each one signed out, as
  someone who isn't Staff, as an Editor for each Owner-only action, and with
  the Admin closed. Each refusal leaves the data unchanged. An action added
  later that isn't in its list fails the test. Owner-only services also
  check the role again themselves (for example Orders, Users, Privacy
  Requests, Staff Activity and Plans).
- **Admin pages.** Every Admin page calls the Staff Guard: `requireStaff`,
  or `requireOwner` for Owner-only pages. Every Admin download (card images,
  quiz figures, Reviewer PDF pages, import templates, the Orders CSV, a
  Member's data) checks Staff, or Owner, on the server.
- **Member App pages.** Every Member App page runs the gate, consent and the
  Active Device before it reads anything.

## 4. Secrets

**What was checked:**

- that every secret is read on the server only, and none has a
  `NEXT_PUBLIC_` name;
- that none appears in what a browser receives;
- that the PayMongo webhook signature and the cron secret are checked.

**Result: passed.**

- **One server-only place.** The secrets are `DATABASE_URL`,
  `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `PAYMONGO_SECRET_KEY`,
  `PAYMONGO_WEBHOOK_SECRET` and `VDOCIPHER_API_SECRET`, plus the
  `ADMIN_PASSWORD_SIGN_IN` and `MEMBER_APP_LIVE` switches. All of them are
  read only in `src/env.server.ts`, which is marked `server-only`, so
  importing it from browser code fails the build. The clients that use them
  are marked `server-only` too: the database, Supabase Storage and Auth
  admin, PayMongo and VdoCipher. Nothing else in the app reads them. The
  command-line scripts in `scripts/` (for example `pnpm db:check`) read the
  database variables from the shell they're run in, and never run in a
  browser.
- **Tests:**
  - `src/env-names.test.ts`: no secret has a `NEXT_PUBLIC_` name, and no
    browser module imports the server env;
  - `src/repo-secrets.test.ts`: no key, token or password is committed
    anywhere in the repo.
- **The production build was checked.** A production build was made with
  every database, Supabase, PayMongo and VdoCipher variable blank, and
  scanned with the new `pnpm check:bundle`. None of the 8 server-only names
  appears in the 193 files a browser can receive: the static chunks and the
  prerendered pages. The same names do appear in the server's own files,
  which shows the scan finds them where they are.
- **The VdoCipher key never reaches the browser.** The server asks VdoCipher
  for a one-time playback pass that lasts 5 minutes, carrying the Member's
  watermark. Only that pass goes to the browser. VdoCipher video ids are
  checked before they go into a request.
- **PayMongo webhook** (`/api/paymongo/webhook`):
  - The signature is an HMAC-SHA256 of the timestamp and the raw body,
    compared in constant time.
  - A bad or missing signature answers 401 and changes nothing (tested in
    `route.test.ts`: "rejects a body changed after signing with 401, changing
    nothing", and "changes nothing for a refund event with a bad
    signature").
  - With no webhook secret configured, the endpoint doesn't exist (404).
  - An event signed with the other mode's key (a test event signed as live,
    or the reverse) is refused like a bad signature. A properly signed event
    from the mode this server isn't taking is ignored.
  - Each event is recorded once by its id, so a replayed event changes
    nothing ("applies the same event once, however often PayMongo sends
    it").
- **Scheduled jobs** (the Reviewer PDF job and the Order expiry sweep):
  - They require `Authorization: Bearer <CRON_SECRET>`, compared in constant
    time over SHA-256 digests.
  - Without it they answer 401 and do nothing. With no secret configured
    they don't exist (404).
  - Tested in `routes.test.ts` and `expiry-sweep/route.test.ts`.

## 5. Browser protections

**What was checked:** the security headers, the cookies, and what the site may
load, connect to and embed.

**Result: fixed, with follow-ups.**

**Fixed:**

- **The sign-in cookie is now `httpOnly`** (`src/lib/supabase/cookie-options.ts`).
  - **Problem:** Supabase's session cookie holds the session's tokens, and
    Supabase's default leaves it readable by scripts on the page.
  - **Fix:** the Platform reads the session only on the server; no page uses
    a browser Supabase client. So the cookie is now `httpOnly`, and an
    injected script could never read it. It stays `Secure` in production and
    `SameSite=Lax`.
  - **Test:** `src/lib/supabase/session-cookie.test.ts` (fails without the
    fix).
- **A renewed sign-in now reaches the browser** (`src/lib/supabase/middleware.ts`, `src/middleware.ts`).
  - **Problem:** an access token lasts about an hour, and the middleware
    renews an expired one. It kept the response it had made before the
    renewal, so the new cookie was left behind. The browser kept sending a
    renewal token Supabase had already replaced. That can end the session
    and sign the person out.
  - **Fix:** the middleware now returns the response as it stands after the
    renewal.
  - **Test:** `session-cookie.test.ts` ("comes back to the browser refreshed,
    and httpOnly, when the middleware refreshes an expired session"), which
    fails without the fix.

**Checked and passed:**

- **Headers on every route** (`next.config.ts`, now pinned by
  `src/security-headers.test.ts`):
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-site`
  - a `Permissions-Policy` that turns off the camera, microphone, location,
    payment and USB
  - two-year `Strict-Transport-Security` in production
  - no `X-Powered-By`
- **Content Security Policy** (`src/lib/csp.ts`, set per request by
  `src/middleware.ts`, tested in `csp.test.ts` and `middleware.test.ts`):
  - **Scripts:** a fresh nonce per request with `'strict-dynamic'`, and no
    inline scripts. The one host added is VdoCipher's player
    (`https://player.vdocipher.com`), whose script saves where a Member is in
    a Lesson. Browsers that understand `'strict-dynamic'` trust only the
    nonce. `'unsafe-eval'` is allowed only under `pnpm dev`.
  - **Frames:** the only one is VdoCipher's player
    (`https://player.vdocipher.com`), and `frame-ancestors 'none'` means no
    other site can frame ours.
  - **Forms** may post only to the site and to PayMongo's checkout.
  - **Off entirely:** `object-src` and `base-uri` are `'none'`.
  - **Connections:** the site itself, the project's Supabase (https and its
    `wss://` address), and VdoCipher's upload host (see follow-up 7).
- **Other cookies:**
  - The Active Device cookie is `httpOnly`, `SameSite=Lax`, `Secure` outside
    local development, and limited to the Member App. Only its hash is
    stored, and it is compared in constant time.
  - The development-only sample cookie is `httpOnly`. It is ignored outside
    sample mode.
- **Forged requests:**
  - Server Actions check the request's origin (Next.js).
  - Every cookie is `SameSite=Lax`, so another site's form can't post with
    them.
  - The Orders CSV, a download by link, refuses a request started by another
    site (`Sec-Fetch-Site`).
  - A Member's data download is a POST, which `SameSite=Lax` protects.
- **Raw HTML:**
  - Formulas render with KaTeX with `trust` off, so no links or images.
  - Structured data escapes `<`.
  - Everything else is escaped by React.

## 6. Uploads and form input

**What was checked:** that file types, sizes and form input are checked on the
server, not only in the browser.

**Result: passed, with a follow-up.**

- **How uploads work.** Every upload goes straight from the browser to
  Supabase Storage or VdoCipher, using a one-time link only a Staff User can
  get. Before handing it out, the server checks the declared type and size:
  - photos (products, share images, About, Course covers): JPEG, PNG or
    WebP, up to 10 MB;
  - card images and quiz figures: JPEG, PNG or WebP, up to 5 MB;
  - Reviewer PDFs: up to 200 MB;
  - import files: a CSV up to 10 MB, a zip up to 200 MB.

  Tested in `uploads.test.ts` (wrong type, too big, empty, signed out),
  `uploads.reviewer-pdfs.test.ts` and `uploads.content.test.ts`. The buckets
  enforce the same types and sizes as a second check.

- **Contents are checked where they matter.**
  - Card images and imported images are read back and must start with an
    image's signature.
  - A Reviewer PDF's size is checked again by the server before it is
    processed, and the processing fails safely for a file that isn't a PDF.
  - An import's zip is listed without being unpacked, and each image is
    unpacked only up to a card image's size limit, which guards against "zip
    bombs".
  - Product and share photos aren't byte-checked once uploaded (follow-up 6).
- **Form input.** Every Server Action validates what it receives with a
  `zod` schema before it acts:
  - Admin actions through `adminAction`, which also requires the record's
    timestamp so a stale save is refused;
  - Member App actions through `safeParse`.

  Next.js limits a Server Action's request to 1 MB (the default is kept).

- **CSV exports.** A cell that starts like a formula (`=`, `+`, `-`, `@`) is
  neutralised, so the Orders CSV can't run formulas in a spreadsheet.

## 7. Personal data

**What was checked:** where personal data is shown, and who can see it.

**Result: passed.**

| Where                                              | Who can see it | How it's protected                                                                                                      |
| -------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Users list and a Member's detail                   | Owners         | Owner-only pages, and the service checks the role again                                                                 |
| Orders list, detail and CSV                        | Owners         | Owner-only. The CSV is never cached, each export is logged in Staff Activity, and other sites can't trigger it          |
| Privacy Requests and "Download this Member's data" | Owners         | Owner-only. The download is a POST, never cached, and logged                                                            |
| Staff Activity (with before and after)             | Owners         | Owner-only. Deleting a Member's account removes them from earlier entries                                               |
| Reviewer PDF pages                                 | That Member    | Stamped with the Member's email and short Member ID. Only that browser may keep them, briefly, and never a shared cache |
| Lesson videos                                      | That Member    | VdoCipher draws the Member's email and short Member ID across the video, as the contract requires                       |

Editors work on content. The screens with Members' personal data (Users,
Orders, Privacy Requests, Staff Activity, and the Overview's sales tiles)
are Owner-only. The app's own log lines record ids, not emails or names. An
unexpected database error is logged as the database reports it, which can
include the value that clashed. Deleting an account removes its personal
data: Access Passes, Course Ownerships, progress and Staff Activity
mentions. Its Orders stay, detached from the account, for the accounts.

## 8. Development routes and sample mode

**What was checked:** that the development-only routes and the sample data
can't be reached or switched on in production.

**Result: passed.**

- **Sample data never runs in production.** The mode is fixed when the
  server starts (`src/lib/admin/mode.ts`). In production, without both the
  database and Supabase configured, the Admin and the Member App are
  closed: every page answers 404 and every action refuses. Tested in
  `mode.test.ts`.
- **The development routes (`/api/dev/*`)** answer 404 outside sample mode:
  sample uploads, sample card images and the sample data reset. The reset
  also works in live mode, but only on a database on the same machine,
  outside production, for signed-in Staff, and not from another site. Tested
  in each route's tests, including "answers 404 in production, even for a
  local database".
- **No fakes in production.**
  - The payments fake ("Simulate paid") exists only in sample mode.
  - The video fake (the sample player) exists only in sample mode.
  - The "Sign in as" actions answer 404 outside sample mode.

## 9. Dependencies

**What was checked:** `pnpm audit`, on 28 November 2026.

**Result: follow-ups.** The audit lists 107 findings across all packages (5
critical, 51 high, 40 moderate, 11 low). Most are in development and test
tools that never reach the live site. Counting only what the live site runs
(`pnpm audit --prod`), there are 3 critical and 15 high:

| Package (version)                                                    | Findings                                                                                                                                                                                                     | Reachable on the live site?                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `next` 15.5.20                                                       | **Critical:** remote code execution in the image optimiser (SVG, AVIF). **Critical:** remote code execution on Windows servers. **High:** Server Action denial of service; two server-side request forgeries | **Yes, for the image optimiser and the Server Action denial of service.** The Website shows Storage photos through `next/image`. The Windows issue doesn't apply (Vercel runs Linux). The request forgeries need a custom server or a rewrite to a variable host, and the site has neither. **Follow-up 1.** |
| `sharp` 0.34.5 (inside `next`)                                       | High: image library (libvips, libheif, librsvg) issues                                                                                                                                                       | Through Next's image optimiser. The app's own `sharp` is 0.35.5, already fixed. **Fixed by follow-up 1.**                                                                                                                                                                                                    |
| `postcss`, `nanoid`, `browserslist`, `source-map-js` (inside `next`) | High: file read, memory and denial-of-service issues                                                                                                                                                         | No: they run while the site is built, on our own files, not on the live site. Updating Next.js picks up newer versions.                                                                                                                                                                                      |
| `zod` 3.24.2                                                         | High: memory use when validating oversized lists                                                                                                                                                             | In principle, through Server Action input. Next.js's 1 MB request limit keeps lists small. The fix exists only in `zod` 4. **Follow-up 9.**                                                                                                                                                                  |
| `ws` 8.18.1 (inside Supabase's client)                               | High: denial of service in a WebSocket client                                                                                                                                                                | No: the Platform never opens a Supabase Realtime connection. **Follow-up 10.**                                                                                                                                                                                                                               |

The other 2 critical and 36 high findings are in development and test tools.
None of them is part of the live site: they run only on developers' machines
and in CI, on the project's own files (follow-up 11).

| Package           | Findings                                                         | Comes in through            | Reachable on the live site?                                     |
| ----------------- | ---------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------- |
| `tinypool`        | 2 critical: code execution through crafted worker options        | Vitest (tests)              | No. It runs the test workers, with options the test setup sets. |
| `brace-expansion` | 14 high: slow or unbounded pattern expansion (denial of service) | ESLint, Vitest coverage     | No. It expands the file patterns in the lint and test settings. |
| `fast-uri`        | 8 high: host confusion in URL parsing                            | commitlint                  | No. It runs when a commit message is checked.                   |
| `minimatch`       | 6 high: slow pattern matching (denial of service)                | ESLint, Vitest coverage     | No. It matches the file patterns in the lint and test settings. |
| `js-yaml`         | 3 high: slow parsing of crafted YAML                             | commitlint, ESLint          | No. It reads the project's own config files.                    |
| `flatted`         | 2 high: deep recursion and prototype pollution when parsing      | ESLint's cache              | No. It reads ESLint's own cache.                                |
| `picomatch`       | 2 high: slow pattern matching (denial of service)                | ESLint, lint-staged, Vitest | No. It matches the file patterns in the lint and test settings. |
| `vite`            | 1 high: a file-existence check bypassed on Windows               | Vitest                      | No. It is the test runner's dev server, never deployed.         |

---

## Follow-ups

Highest risk first. None was changed in this review: each needs a dependency
upgrade, a dashboard setting, or a decision.

### 1. Update Next.js: high

- **Risk:** Next.js 15.5.20 has published critical issues:
  - remote code execution through its image optimiser;
  - a high-severity denial of service through Server Actions;
  - its bundled `sharp` 0.34.5 has high-severity image-library issues.

  On Vercel, images are usually optimised by Vercel's own image service
  rather than the app, which lowers the image risk, but don't rely on it.

- **Fix:** upgrade `next` and `eslint-config-next` to the latest 15.5 patch
  release (15.5.28 or later), then run the full test suite and e2e. Do this
  before launch.

### 2. Switch off, then remove, the temporary password sign-in: medium

- **Risk:** while `ADMIN_PASSWORD_SIGN_IN` is `"true"`, Staff and testers can
  sign in with an email and password instead of Google. That skips Google's
  protections: 2-Step Verification and suspicious sign-in checks. Anyone who
  learns a tester's or Staff member's password can sign in. It is safe
  switched off: a password session then counts nowhere.
- **Fix:**
  1. **At launch** (runbook step 8): set `ADMIN_PASSWORD_SIGN_IN` to
     `false`, or delete it, and redeploy. Turn Supabase's Email provider off
     and delete the test Users.
  2. **Then remove the code:**
     - `src/lib/admin/password-sign-in.ts`
     - the password parts of `src/lib/admin/identity.ts`
       (`passwordSignInAllowed`, `passwordSignInOffered`,
       `passwordSignInPurpose`, `startPasswordSession`)
     - `src/lib/admin/sign-in-method.ts`, keeping Google only
     - `signInWithPassword` in `src/app/admin/sign-in/actions.ts` and
       `src/app/app/sign-in/actions.ts`
     - the password form, `src/components/admin/password-sign-in-form.tsx`,
       on both sign-in pages
     - the variable in `src/env.server.ts` and `.env.example`
     - the runbook's "Testing on the deployed site"

### 3. Keep development off the production Supabase project: low

- **Risk:** today `pnpm dev` runs against the hosted project. Under
  `pnpm dev`, a password sign-in counts, and the production project accepts
  sign-ins coming back to `localhost`. Both are harmless before launch, but
  after launch a developer's machine would be working on real Members' data.
- **Fix:** after launch, develop against a separate Supabase project or a
  local one. Remove `http://localhost:3000/**` from the production
  project's redirect URLs (runbook step 8), and keep the Email provider off
  there.

### 4. Make sessions expire: low

- **Risk:** a Supabase session lasts until sign-out, and Admin sessions
  aren't tied to a device. A forgotten signed-in browser stays signed in.
  The cookie's own lifetime is fixed at 400 days by Supabase's library,
  whatever `SESSION_COOKIE` says.
- **Fix:** in Supabase → Authentication → Sessions (Pro plan), set a time
  limit (for example 30 days) and an inactivity timeout (for example 7
  days).

### 5. Limit VdoCipher playback to the site: low

- **Risk:** a playback pass lasts 5 minutes. Copied out of the page in that
  time, it could start the video on another site. The Member's watermark
  would still show.
- **Fix:** in the VdoCipher dashboard, allow playback only on the site's
  domain. This is a setting the user makes; no code changes.

### 6. Byte-check product and share photos: low

- **Risk:** the Storage bucket checks a photo's declared type and size, but
  not its contents. A Staff User could upload a file that isn't really an
  image. It would be served from Supabase's own domain with an image type,
  so it can't run on the site. Only Staff can upload.
- **Fix:** when a photo is saved, read its first bytes and check them, as
  card images already are (`hasFileSignature`).

### 7. Narrow the video upload host in the CSP: low

- **Risk:** so the Lesson editor can send videos to VdoCipher, every page may
  connect to any `https://*.amazonaws.com` host. If a script were ever
  injected (the nonce policy makes that unlikely), it could send data there.
- **Fix:** once the client's VdoCipher account is live, allow only its exact
  upload host, or add the source only on the Lesson editor's page.

### 8. Add rate limits: low

- **Risk:** the app doesn't limit how often a Server Action or endpoint is
  called. Supabase Auth limits sign-in attempts, and the expensive work (PDF
  processing, payments) sits behind Staff or PayMongo checks.
- **Fix:** if abuse shows up, add Vercel Firewall rate-limit rules for POSTs
  to `/app` and `/admin`.

### 9. Plan the move to zod 4: low

- **Risk:** the `zod` 3 memory advisory (area 9). The 1 MB Server Action
  limit keeps it small.
- **Fix:** keep the default Server Action body limit, and plan a `zod` 4
  upgrade.

### 10. Update Supabase's client: low

- **Risk:** none on the live site today. The `ws` advisory is in Realtime,
  which the Platform doesn't use.
- **Fix:** update `@supabase/supabase-js` and `@supabase/ssr` when
  convenient.

### 11. Update development tools, and tidy up: low

- **Risk:** none on the live site. The findings are in Vitest's `tinypool`,
  ESLint's `minimatch` and other tools, which run only on developers'
  machines and in CI.
- **Fix:**
  - Update Vitest and ESLint when convenient.
  - Add `pnpm check:bundle` after `pnpm build` in CI
    (`.github/workflows/ci.yml`), so every push is scanned for leaked
    secrets.
  - Remove two unused leftovers from the starter template:
    - `src/lib/supabase/client.ts`, a browser Supabase client that would
      find no session now the cookie is `httpOnly`;
    - `src/lib/auth/actions.ts`, an unused sign-out.

---

## Repeating the checks

| Check                                                          | Command                              |
| -------------------------------------------------------------- | ------------------------------------ |
| Unit tests, including the access, permission and gate matrices | `pnpm test`                          |
| Database rules, on a test database (CI)                        | `pnpm test:db`                       |
| Database rules, on any database                                | `pnpm db:check`                      |
| No server-only name or secret in the browser's files           | `pnpm build && pnpm check:bundle`    |
| Dependencies                                                   | `pnpm audit` and `pnpm audit --prod` |
| End to end, on the sample data                                 | `pnpm test:e2e`                      |
