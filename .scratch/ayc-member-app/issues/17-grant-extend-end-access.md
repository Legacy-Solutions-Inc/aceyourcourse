# 17 — Grant, extend and end access, with notices

**What to build:** from a Member's detail page, Owners grant an Access Pass for an Exam, extend one, or end one now, each with a reason saved in Staff Activity. Members see an in-app notice. A grant for an Exam the Member doesn't have adds it to their Target Exams.

- **Grant:**
  - Exam; days of 30, 90, 180 or 365, or a custom 1–365; and a reason
  - extends from the current end, or from now if expired (the Access Pass rule)
- **Extend:** 3, 7, 14 or 30 days, with a reason.
- **End access now:**
  - needs a reason
  - sets the end to now and keeps progress
  - the Member sees the expired state
  - from Phase 4 it will end only granted days. Record each grant's days now, so Phase 4 can tell them apart from paid days.
- **The Target Exam:** a grant for an Exam the Member doesn't have adds it, with the Official Exam Date (or restores a removed one).
- **Notices:**
  - one dismissible banner per notice in the Member App: "You now have {Exam} All-Access until {date}", "Your {Exam} access was extended to {date}", "Your {Exam} access has ended"
  - dismissing is remembered
  - no email
- **Every action** goes in Staff Activity, with the before and after end dates.

**Blocked by:** 16.

**Status:** ready-for-agent

Spec: Phase 3 → "Grants and ending access", "In-app notices", "Target Exams"; stories 131, 133h, 133j.

- [ ] An Owner grants a tester CE for 30 days, and the tester sees the notice and opens locked CE content.
- [ ] Extending adds days to the current end.
- [ ] Ending access locks the content, and progress stays.
- [ ] A grant for a new Exam adds it to the Member's Target Exams.
- [ ] **Sad paths, each with a test:**
  - an Editor is refused every action on the server
  - days outside the allowed values are refused
  - an empty reason is refused
  - granting on an expired pass starts from now
  - an end date shown in Asia/Manila is right across midnight
  - ending an already expired pass is handled
  - a dismissed notice stays dismissed
  - one Member never sees another's notices
