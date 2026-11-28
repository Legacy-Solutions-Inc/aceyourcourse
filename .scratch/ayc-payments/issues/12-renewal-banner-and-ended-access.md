# 12 — Renewal banner and ended access

**What to build:** Members are nudged to renew in the week before an Access Pass ends, framed around their Exam Date, and ended access shows what they've kept.

- **The banner:** on Home and on that Exam's study screens, one per Exam, for any Access Pass (paid or granted) ending within 7 days.
  - Ends before the Exam Date: "Your CE All-Access ends 25 Oct, 27 days before your exam", with "Renew to cover your exam" → Plans for that Exam.
  - Ends on or after the Exam Date, or no Exam Date: "Your CE All-Access ends 25 Oct", with "Renew access" → Plans.
  - Dismissing hides it until the next Manila day.
  - Never shown to Staff.
- **Ended access:** today's locked state adds the saved progress ("312 cards marked, 14 quizzes taken") and "Renew access" → Plans for that Exam.
- No email (it waits for a sending domain).

**Blocked by:** 02.

**Status:** ready-for-agent

Spec: Phase 4 → "Renewal nudges", "Phase 4 planning decisions → Renewal reminders"; stories 141, 142.

- [ ] A Member whose CE pass ends in 5 days, 27 days before their exam, sees the "before your exam" banner on Home and on CE study screens.
- [ ] Dismissing hides it for the rest of the Manila day and it's back the next day.
- [ ] A Member whose pass has ended sees their progress and "Renew access".
- [ ] **Sad paths, each with a test:**
  - a pass ending in 8 days shows no banner; one ending in exactly 7 days does
  - a pass ending after the Exam Date, or with no Exam Date, shows the plain wording
  - Staff never see the banner
  - two Exams ending soon show two banners, each dismissed separately
  - an already ended pass shows the ended state, not the banner
  - a dismissal by one Member never hides another Member's banner
  - day counts are right across Manila midnight
