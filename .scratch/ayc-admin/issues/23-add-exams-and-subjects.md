# 23 — Add Exams and Subjects

**What to build:** Owners add a new Exam, with its Subjects, in Pages & promo → Exam pages. They also add Subjects to any Exam, and delete an Exam or a Subject that nothing uses yet. A new Exam reaches the Website once it has a Product there.

- **Where:**
  - A "+ Add exam" chip after the last Exam chip opens the form in the editor column. Saving opens the new Exam's Header.
  - The Subjects covered section gets "+ Add subject", and a remove button on each Subject.
  - "Delete exam" sits at the foot of the Header editor.
  - All of these are for Owners only. Editors don't see them, and they can still edit everything else on the new Exam's page, add its Products and rename Subjects.
- **The form:** the code, the board acronym, the name, the long name, the text, the "made for" line, and at least one Subject (code and name), with room to add more before saving.
- **The rules:**

| Field                           | Rule                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Exam code                       | 2–6 letters, saved in capitals, unique among the Exams, fixed once saved. The Exam page is `/exams/<code>`. |
| Board acronym                   | 2–10 letters, saved in capitals, fixed once saved.                                                          |
| Name, long name, text, made for | Required, at most 60, 120, 600 and 160 characters (the Header editor's limits).                             |
| Subject code                    | 1–20 characters of capitals, digits, spaces and "&", unique within its Exam, fixed once saved.              |
| Subject name                    | 1–120 characters.                                                                                           |
| Number of Exams                 | At most 12. A 13th is refused with "UP TO 12 EXAMS. Ask the developer to raise the limit."                  |

- **A new Exam:**
  - goes last everywhere, with no reordering
  - starts with every Exam page section shown, no bundle offer and no Official Exam Date
  - is listed in the Product editor's Exam picker straight away
  - is off the Website until one of its Products is on the Website. Until then `/exams/<code>` answers 404, the Admin's chip shows "NOT ON SITE", and "View page ↗" is replaced by "CHE isn't on the Website yet. It shows once one of its Products is on the Website."
- **Deleting:**
  - An Exam can be deleted only while no Product belongs to it (Live, Coming Soon or hidden). Its Subjects and Exam page settings go with it.
  - A Subject can be deleted only while no Product is tagged with it.
  - Otherwise the reason replaces the button, for example "2 Products belong to CHE. Move or delete them first."
  - It's confirmed in the page, never in a browser dialog.
- **The Website** fits 1–12 Exams everywhere it lists them. The desktop Exams menu and the mobile menu are fixed 5-column grids today.

**Blocked by:** None. Tickets 20–22 are done.

**Status:** ready-for-agent

Spec: Phase 2 stories 80d and 80e (story 117 moved here); Implementation Decisions → Phase 2 → "Adding Exams and Subjects (added 2026-11-05)". CONTEXT.md: **Exam**, **Subject**, **Staff Role**. Conventions: §2 (`?page=exam&add=exam`), §3 (the `examPages` area, Owner-only actions, Staff Activity).

- [ ] **Adding an Exam:**
  - creates the Exam and its Subjects in one save
  - records Staff Activity with the new values
  - clears only the Exam caches it affects
  - behaves the same in the sample and database arms, with no migration
- [ ] **Adding and deleting** Subjects and Exams follow the rules above, in both arms. Each is recorded in Staff Activity.
- [ ] **The new Exam on the Website:**
  - is absent from every list, the sitemap and `/llms.txt`, and `/exams/<code>` is a 404, while it has no Product on the Website
  - once a Product is shown, appears last in the menus, footer, Home, Products filters, Reviews filters, FAQ coverage table, About and its own page
- [ ] **Every Website Exam list** lays out cleanly at 6 and at 12 Exams, on desktop and mobile.
- [ ] **Sad paths, each with a test:**
  - An Editor doesn't see "+ Add exam", "+ Add subject" or the delete buttons. Calling those actions as an Editor is refused (owners-only). Signed out, or as a non-Staff User, they're refused by the Staff Guard.
  - A code of 1 or 7 letters, or with a digit or space, is refused with "USE 2–6 LETTERS". "ce" is refused with "CE IS ALREADY AN EXAM".
  - Two Owners adding the same code: the second save is refused with "CHE IS ALREADY AN EXAM", and the typed values are kept.
  - The form with no Subject, a blank Subject name, or two Subjects with the same code is refused with the field's message.
  - A field over its limit is refused with the Header editor's message.
  - A 13th Exam is refused with the limit message.
  - Deleting an Exam with a hidden Product is refused with the reason, and the database refuses it too.
  - Deleting a Subject that a Product is tagged with is refused with the reason.
  - A form posted with a changed code for an existing Exam, or a changed Subject code, is refused. Codes stay fixed.
  - Markup typed into the name shows as plain text on the Website.
