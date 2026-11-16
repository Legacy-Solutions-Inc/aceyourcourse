# 24 — Password sign-in in production (temporary)

**What to build:** while the deployed site is being tested, Staff can sign in to the production Admin with the same email and password box `pnpm dev` shows today, next to "Continue with Google". A server-only switch, `ADMIN_PASSWORD_SIGN_IN`, turns it on per environment in Vercel. Turning the switch off (or the Supabase Email provider off) ends it, with no code change. It's removed once testing is done.

- **The switch:** `ADMIN_PASSWORD_SIGN_IN`, "true" or "false", unset means "false". Server-only (never `NEXT_PUBLIC_`), validated in the server env like `MEMBER_APP_LIVE`.
- **Where the box shows:** live mode, and either `pnpm dev` (as today) or the switch "true", while Supabase says its Email provider is on.
- **What counts:** the Staff Guard counts a password session where the box is allowed. Google counts everywhere, as before. Every other method still never counts.
- **What doesn't change:** Staff only (the staff list decides), no sign-up, no password reset, Users made by hand in the Supabase dashboard with "Confirm email" on, sample mode, Members.
- **The label:** the box keeps its look. Outside `pnpm dev` its heading reads "TESTING ONLY" instead of "DEVELOPMENT ONLY".

**Blocked by:** None. Ticket 19 is done.

**Status:** ready-for-agent

Spec: Phase 2 → "Password sign-in in production, while testing (added 2026-11-11)" and "Development password sign-in, until go-live". Runbook: "While you develop, before go-live" and step 8.

- [ ] With the switch "true" on a production build in live mode, the box shows, and an Owner signs in with email and password and reaches the Admin.
- [ ] With the switch unset or "false", a production build behaves exactly as today: no box, and a password session is refused.
- [ ] `pnpm dev` in live mode behaves as today, whatever the switch says.
- [ ] Google sign-in works as before, with the switch on or off.
- [ ] The runbook explains how to turn it on and off in Vercel, and step 8 says to set it to "false" (or remove it) before go-live.
- [ ] **Sad paths, each with a test:**
  - The switch set to any other value ("yes", "1") fails the server env check at start-up with a message naming `ADMIN_PASSWORD_SIGN_IN`.
  - Switch "true" but the Email provider off, or Supabase not answering: no box.
  - Switch "true", sample mode or closed mode: no box, and the password action answers 404.
  - Switch "false" in production: posting the password action directly answers 404, and a session made with a password elsewhere (straight against Supabase) is refused by the Staff Guard.
  - Switch "true": a password User whose email isn't on the staff list is sent to "denied", and one with an unconfirmed email is refused.
  - Switch "true": a wrong password shows the box's existing message, and the password is never sent back.
  - Switch "true": otp, magiclink, anonymous, or a missing or unreadable `amr` still never counts.
