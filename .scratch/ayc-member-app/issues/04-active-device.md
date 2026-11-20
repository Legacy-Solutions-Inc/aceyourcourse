# 04 — Active Device

**What to build:** each Member uses the Member App on one device at a time. Signing in on a new device makes it the Active Device. The old device's next request lands on "Session ended", with a way back. A session that never claimed this device gets a one-tap "Use the Member App on this device".

- **The device token:** a random value in an httpOnly, Secure, SameSite=Lax cookie, set when the Member App sign-in completes. Only its hash is stored, on the Member's Active Device record.
- **Every `/app` page and Member App action** (after the gate and consent) compares the request's token with the Active Device:
  - **match:** continue
  - **no token** (for example signed in through `/admin` first): the "Use the Member App on this device" screen. Confirming claims the device.
  - **a different token:** the "Session ended" screen (mockup `session`), saying they signed in on another device, with "Sign in on this device". That runs Google sign-in and claims the device.
- **The switch log:** every claim records the time and a device label from the user agent (for example "Chrome on Android"). The first claim counts too. Ticket 16 shows the count.
- **Admin is exempt:** using `/admin` never sets, checks or replaces the Active Device. Supabase's single-session setting isn't used.
- **Staff** are subject to the Active Device in `/app` like any Member.
- **A seam function** that later tickets call: "is this request from the Member's Active Device?" It returns active, no-token or replaced.

**Blocked by:** 01.

**Status:** ready-for-agent

Spec: Phase 3 → "Active Device" and the 2026-11-17 no-token decision; stories 107–109, 133f; ADR 0011.

- [ ] Signing in on device B sends device A to "Session ended" on its next request.
- [ ] "Sign in on this device" on A makes A active again, and B is then replaced.
- [ ] A session without a token sees "Use the Member App on this device". Confirming claims it.
- [ ] Each claim is logged with time and device label.
- [ ] Using the Admin on another device never replaces the Member App device.
- [ ] **Sad paths, each with a test:**
  - A tampered or unknown token is treated as replaced, never as active.
  - A replaced device's Server Action posts are refused with no change.
  - The raw token is never stored or logged.
  - A token from one Member never matches another Member.
  - The claim action refuses a gated person or a Member who hasn't agreed to the Terms.
  - An unknown user agent gets a generic label ("Unknown browser").
