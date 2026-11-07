# 10 — Home promo banner and announcement bar

**What to build:** Under Exam pages & promo, Editors manage two strips.

- **The Home promo banner:**
  - text, button label and link
  - start and end dates
  - on or off
  - it shows only within its dates and turns itself off after the end date
  - "Turn off banner now" asks for confirmation first
- **The announcement bar:**
  - up to 3 messages, each with text, a link and "only while the Member App is live"
  - reordered with ▲▼
  - changing the messages shows the bar again to Visitors who dismissed it

**Blocked by:** 09 — Exam pages

**Status:** ready-for-agent

Spec: Phase 2 story 76; Implementation Decisions → Phase 2 (Exam pages & promo: banner, announcement bar; Menu; Staff Role permissions, which let Editors edit the announcement). Mockup: BUILD-MAP §3.2 (Home promo banner), §2 unpublish. Conventions: §2 (`?page=promo`, `?page=announcement`), §3.

- [ ] **The banner editor** follows the mockup: BANNER TEXT, BUTTON LABEL, LINK, STARTS ON and ENDS ON, the note "The banner turns off by itself after the end date. Everything else on Home is fixed.", and a Show banner toggle.
- [ ] **The status line** says one of:
  - "ON · SHOWS 9–11 NOV"
  - "SCHEDULED · STARTS 9 NOV"
  - "ENDED · TURNED OFF BY ITSELF 11 NOV"
  - "OFF"

  The status follows the Website's existing banner rule in Manila time.

- [ ] **Turn off banner now** opens the mockup's unpublish confirmation ("…It disappears from Home right away instead of on 11 Nov."), then switches the banner off.
- [ ] **Banner validation:**
  - text required, at most 80 characters
  - button label required, at most 24 characters
  - the link must be an https URL or a site path
  - the end date can't be before the start date
  - invalid dates are refused
- [ ] **The announcement editor:**
  - 1 to 3 messages
  - each has TEXT (required, at most 70 characters), LINK (an https URL or a site path) and "Only while the Member App is live"
  - ▲▼ to reorder, "+ Add message" up to 3, and Remove down to 1
- [ ] **Re-showing the bar.** Saving changed messages gives the announcement a new id. Saving with no changes keeps the id.
- [ ] **Live on save.** Home's banner and every page's announcement bar show the change on the next load. e2e: a Visitor dismisses the bar, an Editor edits a message, and the bar shows again on reload.
- [ ] **Saves.** Save states, the conflict check, the toast and Staff Activity all work as in ticket 02. Editors and Owners can both edit.
- [ ] **Tests:**
  - seam tests: validation, id regeneration and status-line boundaries (the day before the start, the start day, the end day and the day after, at Manila midnight)
  - e2e
  - axe
