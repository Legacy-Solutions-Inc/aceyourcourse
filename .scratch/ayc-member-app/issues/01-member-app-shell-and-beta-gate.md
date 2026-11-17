# 01 — Member App shell, sign-in and the beta gate

**What to build:** a Visitor opens `/app`, signs in with Google, and lands in the Member App's shell, with a placeholder Home. While the Member App switch is off, only active Staff and Beta Testers get past sign-in. Everyone else sees "Not open yet". Owners keep the Beta Tester list in the Admin.

- **Sign-in:** the mockup's `signin` screen, Google only, through the Supabase OAuth callback the Admin already uses. After sign-in the Member returns to the `/app` page they asked for, using the safe-next rule the Admin already has.
- **The gate:**
  - **Switch on** (MEMBER_APP_LIVE "true"): everyone gets in.
  - **Switch off:** active Staff (from the staff list) and Beta Testers (matched by verified Google email) get in.
  - **Everyone else:** a "Not open yet" screen that keeps them signed in, with "Sign out" and the support email. No Member records are created for them beyond what Supabase sign-in makes.
  - Every `/app` route and every Member App Server Action checks the gate on the server.
- **The shell** (Member App BUILD-MAP §2):
  - the desktop sidebar with its seven nav items (only Home works yet; the others say "Coming soon in the beta" or are left out, as the executer prompt decides)
  - the mobile Menu button and drawer
  - the name, email and "Sign out" in the footer
  - no exam switcher yet (ticket 03)
- **Beta Testers in the Admin** (Owner only):
  - a "Beta Testers" tab in a new Owner-only Users screen. The rest of Users comes in ticket 16.
  - add a Google email (validated, lowercased, unique)
  - a list showing the date added and who added it
  - remove
  - adding and removing are recorded in Staff Activity
  - Editors don't see the tab, and its actions refuse them on the server
- **Sample mode:** like the Admin, when there's no database and no Supabase outside production, `/app` offers a development-only "Sign in as" list of sample Members:
  - a Beta Tester
  - an Owner
  - a Member who isn't a tester
  - the "Not open yet" Member

  This is what e2e uses.

- **The Member record:** the first time a person passes the gate, a Member record is created, keyed by their User, with their name and email from Google.

**Blocked by:** None. Can start immediately.

**Status:** ready-for-agent

Spec: Phase 3 → "Phase 3 planning decisions (added 2026-11-17)" → the beta gate; stories 81, 133a–133d; ADR 0008.

- [ ] With the switch off, a Beta Tester and an active Staff User reach the shell after Google sign-in.
- [ ] With the switch off, anyone else sees "Not open yet" and can sign out.
- [ ] With the switch on, anyone reaches the shell.
- [ ] Owners add and remove Beta Testers, and each change is in Staff Activity.
- [ ] Sample mode's "Sign in as" works for every sample Member, and is absent in production.
- [ ] **Sad paths, each with a test:**
  - A tester who was removed is refused at their next request while the switch is off.
  - Removed or expired Staff are treated as non-testers.
  - Email matching ignores case. An unverified email never matches.
  - Adding an invalid email or a duplicate is refused with a message.
  - An Editor posting the Beta Tester actions directly is refused on the server.
  - A gated person's direct request to any `/app` page or action is refused.
  - An unsafe `next` parameter falls back to `/app`.
  - Without a session, `/app` routes go to the sign-in screen.
