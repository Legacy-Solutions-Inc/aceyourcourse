# 16 — Users list, Member detail and force sign-out

**What to build:** Owners see a Users list and each Member's detail page, so they can support Members and spot shared accounts. They can force-sign-out a Member's Active Device.

- **The Users list** (Owner only; the Users screen from ticket 01, beside the Beta Testers tab):
  - search by name or email
  - filters: Active Pass, Expired, None, Staff, Beta Tester
  - columns: Target Exam(s), Access Pass end, Active Device label, and role (Member, Editor, Owner)
  - paged
- **Member detail:**
  - profile
  - Target Exams with their Exam Dates
  - Access Passes with their history
  - progress summary per Target Exam (from ticket 15 if done, otherwise the basic counts)
  - device switch count and log
  - consent versions
  - purchase history (empty until Phase 4, labelled so)
- **Force sign-out:**
  - clears the Member's Active Device, so their next Member App request lands on "Session ended"
  - needs a reason
  - logged in Staff Activity
- **Owner only:** Editors don't see Users, and the actions refuse them on the server.

**Blocked by:** 04, 05.

**Status:** ready-for-agent

Spec: Phase 3 → "Beta access"; stories 129, 130, 132.

- [ ] An Owner searches and filters Members and opens a detail page with every section.
- [ ] Forcing sign-out sends the Member's device to "Session ended", and it's logged.
- [ ] **Sad paths, each with a test:**
  - an Editor is refused the list, the detail page and the action on the server
  - a search with no results shows an empty state
  - an unknown Member ID answers 404
  - forcing sign-out on a Member with no Active Device is handled
  - force sign-out without a reason is refused
  - Members can never reach these pages
