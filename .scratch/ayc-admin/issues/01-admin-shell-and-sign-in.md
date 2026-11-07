# 01 — Admin shell and Staff sign-in (sample data)

**What to build:** Staff open `/admin`, choose "Continue with Google" and land in the Admin shell from the mockup.

- **Sign-in.** In development, "Continue with Google" opens the "Sign in as" list of sample Users.
- **The shell:**
  - the sidebar, with Settings shown to Owners only
  - the header, with the "SAMPLE DATA" tag and "View site ↗"
  - the user block, with Sign out
  - the mobile drawer
- **Who gets in:**
  - Signed-out visitors see the sign-in screen.
  - A User who isn't Staff gets the 403 screen, and the attempt is recorded.
  - An invited email activates its Invite on sign-in.
  - An expired Invite gets the 403 screen, saying it expired.
  - An Editor who opens Settings gets the 403 "Owners only" screen.
- **Production.** The Admin is closed: every `/admin` route answers 404.
- **The screens.** The Overview shows the greeting. The four section screens exist with their headers and an empty body, which later tickets fill in.

**Blocked by:** None — can start immediately (Phase 1 committed on `docs/ayc-v1-planning`)

**Status:** ready-for-agent

Spec: Phase 2 stories 51, 52, 53, 55, 57, 59, 60; Implementation Decisions → Phase 2 (Mockup fidelity, Menu, Two stages, Seams: Staff Guard, Staff access, Invites, Staff Role permissions). Mockup: BUILD-MAP §2, §3.1 (greeting only), §3.12. Conventions: `.scratch/ayc-admin/CONVENTIONS.md` §1, §2, §3 (Staff Guard), §4, §5.

- [ ] `computeAdminMode` returns "sample" in development and test, and "closed" in production. Every `/admin` route and dev-only route answers 404 when the mode is closed.
- [ ] Signed out, `/admin/...` redirects to `/admin/sign-in?next=…`. `next` accepts `/admin` paths only. Anything else, such as `https://…`, `//…` or `/app`, falls back to `/admin`.
- [ ] The sign-in screen matches the mockup ("Sign in to manage the site", "Continue with Google"). In sample mode, the button opens the "Sign in as" list (the 5 sample Users) plus an "Other email" field.
- [ ] Signing in as the Owner lands on the Overview: "Good morning|afternoon|evening, Angel." (Manila time) and the date line "THURSDAY · 22 OCT 2026".
- [ ] Signing in as Kim (case-insensitive, e.g. `KIM.REYES@GMAIL.COM`) activates the Invite as an Editor and records Staff Activity. A second sign-in works the same.
- [ ] The expired Invite and Juan both get `/admin/denied`, which shows:
  - the email
  - "Nothing was changed."
  - "THIS ATTEMPT WAS LOGGED · {time}"
  - "Use another account", which signs out and returns to sign-in
  - "Go to the website", which becomes "Go to the member app" when `MEMBER_APP_LIVE=true`

  The expired Invite also shows "Your invite expired. Ask an Owner to renew it." Each attempt is recorded (email, time, reason).

- [ ] An Editor's menu has no Settings, and opening `/admin/settings` as an Editor goes to `denied?reason=owners-only`.
- [ ] The Guard reads the staff list on every request. A Staff User removed from the store is denied on their next request. An unknown or tampered sample cookie is treated as not Staff.
- [ ] Sign out clears the session and returns to the sign-in screen.
- [ ] Below 760 px, the "Menu" button opens the drawer. Escape and the scrim close it, and focus returns to the button.
- [ ] Every Admin page is noindex, and `robots.ts` disallows `/admin`. In sample mode, the middleware makes no Supabase call for `/admin`.
- [ ] Tests cover:
  - the mode
  - the `next` sanitising
  - the Guard (signed out, not Staff, Invite activation, expired, Owner-only, removed)
  - e2e for each sign-in case
  - axe on the sign-in, 403 and Overview screens
