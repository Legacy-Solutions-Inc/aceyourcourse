# 18 — Account, Support and Members' privacy requests

**What to build:** the Member App's Account page:

- the profile
- Target Exams (from ticket 03)
- the date and version of what the Member agreed to
- "Request a copy of my data"
- "Delete my account", behind a clear warning
- Sign out

A Support page gives the contact email and common questions.

- **Account** (mockup `account`):
  - the profile (name and email from Google)
  - the Target Exams section
  - "You agreed to Terms v{x} and Privacy v{y} on {date}"
  - Sign out
- **A data copy request:** creates a Privacy Request (data copy). It tells the Member AYC will email it within 7 days. A repeat request while one is open just shows the open one.
- **A deletion request:**
  - a warning: removed within 30 days; paid access isn't refunded; progress is lost
  - a typed confirmation
  - creates a Privacy Request (deletion)
  - the Member stays signed in, and Account shows that the request is pending
- **Support** (mockup `support`): the contact email (from Settings) and common questions (developer-maintained text).
- **The Admin list:** Privacy Requests appear for Owners as a list (type, Member, date, due date, status). Fulfilment comes in ticket 19.

**Blocked by:** 03.

**Status:** ready-for-agent

Spec: Phase 3 → "Privacy Requests", "Consent"; stories 110–113.

- [ ] A Member sees their Account details and agreement versions.
- [ ] They request a data copy, and it shows as pending. Owners see it listed.
- [ ] They request deletion after the warning and confirmation. Owners see it listed.
- [ ] Support shows the email and questions.
- [ ] **Sad paths, each with a test:**
  - a duplicate open request isn't created twice
  - deletion without the typed confirmation is refused on the server
  - one Member can't see or create requests for another
  - an Editor can't see the Admin list
  - Sign out ends the session and returns to the sign-in screen
