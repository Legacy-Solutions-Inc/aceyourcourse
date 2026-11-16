# 25 — Say how to put an Exam on the Website

**What to build:** when an Exam is NOT ON SITE, the note above the Exam chips in Pages & promo → Exam pages tells Staff what to do, with a link that opens the Products list filtered to that Exam.

- **Today:** "EE isn't on the Website yet. It shows once one of its Products is on the Website."
- **The Exam has Products, all hidden:** "EE isn't on the Website yet. To show it, turn on **Show on website** for one of its 3 Products." followed by the link "Open EE's Products →". Use "1 Product" for one.
- **The Exam has no Products** (for example, just added with "+ Add exam"): "EE isn't on the Website yet. Add a Product for EE, then turn on **Show on website**." followed by the link "Add a Product →". The link opens the Products screen's add form with EE already picked if the screen supports it, or else the Products list filtered to EE.
- **The link:** the Admin's own Products list URL with the Exam filter (`/admin/products?exam=ee`), opened in the same tab, built with the existing list URL helper. No new filter is added.
- **Who sees it:** everyone who sees the note today, Editors and Owners. Both can turn on Show on website.
- **Nothing else changes:** the chip's NOT ON SITE label, the rule (an Exam shows once one of its Products is shown, Live or Coming Soon), the delete note, and the Website.

**Blocked by:** None. Ticket 23 is done.

**Status:** ready-for-agent

Spec: Phase 2 → "Adding Exams and Subjects (added 2026-11-05)" (a new Exam is off the Website until one of its Products is on it).

- [ ] The note gives the instruction and the link for an Exam whose Products are all hidden, with the right count and plural.
- [ ] The note gives the add instruction and link for an Exam with no Products.
- [ ] The link opens the Products list filtered to that Exam, and the filter shows its Products.
- [ ] An Exam on the Website shows no note, as today.
- [ ] **Sad paths, each with a test:**
  - An Exam whose Products are all hidden shows "3 Products", and one with a single hidden Product shows "1 Product" (not "1 Products").
  - An Exam with only a Coming Soon Product that's shown is on the Website: no note.
  - An Exam with Products that are all hidden and one that's Live but hidden: still the note, because hidden Products don't count.
  - The product count read failing doesn't break the page: the note falls back to today's text.
  - The Exam code in the link is lowercase and URL-safe.
