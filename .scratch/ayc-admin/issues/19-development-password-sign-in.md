# 19 — Development password sign-in

**What to build:** until go-live, Staff can sign in on localhost with an email and a password. Production stays Google-only.

- **Where it shows.** A "DEVELOPMENT ONLY" box sits under "Continue with Google" on the sign-in screen, with Email, Password and "Sign in". It shows only when all three are true:
  - the app runs under `pnpm dev`
  - the Admin is in live mode
  - Supabase's public auth settings say the Email provider is on
- **What it does.** It only signs in: there's no sign-up and no "Forgot password". After signing in it goes through the Staff Guard exactly as Google does. Staff go on to `next`; anyone else is recorded and gets the 403 screen.
- **Production refuses password sessions by itself.** Outside `pnpm dev`, the Staff Guard counts a session only when Supabase records it as an OAuth sign-in. A password session counts as signed out there, even with a confirmed email.
- **"Use another account"** returns to the sign-in screen when the password box is available, instead of going straight to Google.
- **Runbook.**
  - How to make the development Users by hand.
  - "Confirm email" stays on.
  - A "First: end development sign-in" part at the top of step 8.

**Blocked by:** 16 — Real Staff sign-in

**Status:** ready-for-agent

Spec: Phase 2 → Implementation Decisions → "Development password sign-in, until go-live" (added 2026-11-04), Environments, Staff access, Invites; story 51. Conventions: §1 (mode), §3 (Staff Guard, identity). Skills: supabase-auth, supabase.

- [ ] **The box shows only under `pnpm dev`, in live mode, with Email on.** It's absent in production builds, in sample mode, when Supabase says Email is off, and when Supabase doesn't answer.
- [ ] **The action refuses outside those conditions.** The password sign-in Server Action answers 404 outside development or live mode, whatever the form posts.
- [ ] **A right email and password signs in through the Guard.** Staff land on `next`, sanitised as in ticket 01. A confirmed User not on the staff list gets the 403 screen, and the attempt is recorded. A pending Invite for that email activates.
- [ ] **The session's sign-in method is checked.**
  - It's read from Supabase's verified claims (`amr`), never from `getSession()`, the cookie alone or `user_metadata`.
  - In development, an `oauth` or `password` sign-in counts.
  - Outside development, only `oauth` counts.
  - Any other method (otp, magiclink, anonymous…) never counts.
- [ ] **Sad paths, each with a test:**
  - A wrong email or a wrong password shows "That email and password don't match." It's the same message for both.
  - Supabase's rate limit shows "Too many tries. Wait a minute and try again."
  - Email turned off since the page loaded shows "Password sign-in is off on this project."
  - An unconfirmed email shows a message saying it isn't confirmed.
  - Supabase not answering shows "Sign-in isn't answering right now. Try again in a minute."
  - An empty email shows "Enter your email" and an empty password shows "Enter your password", each next to its field. The typed email is kept.
  - A confirmed password session on a production build counts as signed out.
- [ ] **CI only (the live-mode e2e and the database tests, on the runner's local Supabase):**
  - a sign-in through the box as the Owner lands on the Overview
  - a wrong password stays on sign-in with the message
  - a confirmed User who isn't Staff gets the 403 screen
  - a refreshed password session still reports the `password` method
- [ ] **The runbook** covers:
  - creating development Users with Auto Confirm User ticked
  - keeping "Confirm email" on
  - "First: end development sign-in" at the top of step 8: remove the test Editors and delete their Users, then Email is turned off and the box disappears

  Its existing step numbers stay as they are. The README's local sign-in section lists the password box.
