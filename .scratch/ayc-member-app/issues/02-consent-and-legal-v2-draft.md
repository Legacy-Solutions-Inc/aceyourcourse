# 02 — Consent and the Legal v2.0 draft

**What to build:** after first sign-in, a Member sees the consent screen and must agree to the current Terms and Privacy Policy before using the Member App. When either changes version, they are asked again. The Legal pages carry a v2.0 draft with the Member App sections, marked "pending legal review".

- **The consent screen** (mockup `consent`):
  - two required checkboxes, both unchecked to start
  - "Agree and continue" is disabled until both are ticked
  - it says what's kept and why
  - it links to the Terms and the Privacy Policy
- **Stored:** the agreed Terms version, Privacy version and timestamp per Member, with history kept.
- **Re-consent:** when the current Terms or Privacy version differs from the Member's latest agreement, every `/app` page shows the consent screen first. It says what changed: "We've updated our Terms" or "our Privacy Policy".
- **Legal v2.0 draft:**
  - The existing versioned Legal documents gain the Member App sections:
    - account and sign-in
    - study data and progress
    - the Active Device and its device log
    - watermarking of Reviewer PDF pages
    - Access Passes and grants
    - Privacy Requests and account deletion (30 days, no refund for paid access)
    - anonymous, cookieless analytics
  - The draft is marked "Draft, pending legal review" on the page, with its version and effective date.
  - It replaces v1.0 as the current version, and v1.0 stays in the repo's history as today.
- **The Website** shows the same v2.0 text at the existing Legal routes.

**Blocked by:** 01.

**Status:** ready-for-agent

Spec: Phase 3 → "Consent" and "Legal for the beta"; stories 82, 83, 133e.

- [ ] A new Member can't reach any `/app` page past the gate without agreeing.
- [ ] Agreeing stores both versions and the time, then continues to where they were going.
- [ ] Bumping either version makes every Member agree again on their next visit.
- [ ] The Legal pages show v2.0 marked as a draft pending legal review.
- [ ] **Sad paths, each with a test:**
  - "Agree" stays disabled with one box ticked.
  - Posting the consent action without both agreements is refused on the server.
  - Posting it with an old version number is refused, and the screen reloads with the current one.
  - A Member who agreed to only the old Privacy version sees the Privacy wording.
  - A gated person never gets a consent record.
  - Direct requests to `/app` pages or actions before consent are refused, except sign-out and the consent action itself.
