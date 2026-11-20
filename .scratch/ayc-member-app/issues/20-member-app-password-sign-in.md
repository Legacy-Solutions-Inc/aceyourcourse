# 20 — Password sign-in in the Member App (temporary)

**What to build:** while the site is being tested, the Member App's sign-in screen also offers the email and password box the Admin has, under "Continue with Google". Beta Testers and Staff with a password User can sign in to `/app` with it. The Admin's existing switch, `ADMIN_PASSWORD_SIGN_IN`, now turns password sign-in on for both Surfaces. It's removed once testing is done, together with ticket 24's box.

- **Where the box shows:** exactly where the Admin's box is allowed (ticket 24's `passwordSignInAllowed`: live mode, and either `pnpm dev` or the switch "true"), while Supabase says its Email provider is on. The same check decides both Surfaces, so they never disagree.
- **The box:** reuses the Admin's password form and its messages, headed "DEVELOPMENT ONLY" under `pnpm dev` and "TESTING ONLY" elsewhere. It sits under "Continue with Google". The screen's line "Use your Google account. No separate username or password." stays when the box isn't offered. When it is offered, the line says Google is the usual way and the box is for testing.
- **After signing in:** the same steps as Google's callback. A Member the gate lets in has this device made their Active Device, then goes to `next` (sanitised to a Member App path). Someone the gate doesn't let in goes to "Not open yet". A password User whose email isn't confirmed is refused with the box's existing message.
- **What counts in the Member App** (new, fail closed): the Member App counts a session that signed in with Google everywhere, and with a password only where the box is allowed, using the same rule as the Staff Guard. Any other method (magic link, OTP, anonymous) or an unreadable `amr` counts as signed out in `/app`. Today the Member App accepts any verified session. Sample mode's "Sign in as" is unchanged.
- **Who has a password User:** made by hand in the Supabase dashboard with "Confirm email" on, as for the Admin. No sign-up, no password reset, no password rules. The beta gate still decides who gets in: Staff, or a Beta Tester by email.
- **The runbook:** "Testing on the deployed site" says `ADMIN_PASSWORD_SIGN_IN` now turns on the box in both the Admin and the Member App. It also says to create password Users for testers in the Supabase dashboard and to add them as Beta Testers. Step 8 says turning it off ends both.

**Blocked by:** None. Tickets 01, 04 and Admin ticket 24 are done.

**Status:** ready-for-agent

Spec: Phase 3 → "Password sign-in in the Member App, while testing (added 2026-11-20)"; Phase 2 → "Password sign-in in production, while testing".

- [ ] With the switch "true" on a production build in live mode, the Member App's sign-in screen shows the box, and a Beta Tester with a password User signs in, claims the device and reaches the Member App.
- [ ] Under `pnpm dev` in live mode, the box shows, whatever the switch says.
- [ ] With the switch unset or "false" in production, the screen is exactly as today and a password session counts as signed out in `/app`.
- [ ] Google sign-in works as before, with the switch on or off.
- [ ] The runbook covers both Surfaces.
- [ ] **Sad paths, each with a test:**
  - Switch "true" but the Email provider off, or Supabase not answering: no box.
  - Sample mode or closed mode: no password box, and the password action answers 404.
  - Switch "false" in production: posting the Member App password action directly answers 404. A session made with a password elsewhere is treated as signed out in `/app`.
  - Switch "true": a password User who isn't Staff or a Beta Tester, while the Member App switch is off, ends at "Not open yet" and no device is claimed.
  - Switch "true": an unconfirmed email is refused, and a wrong password shows the existing message, keeps the email and never sends the password back.
  - Magic link, OTP, anonymous, or a missing or unreadable `amr` never counts in `/app`, whatever the switch says.
  - An unsafe `next` falls back to `/app`.
  - The switch never reaches the client bundle.
