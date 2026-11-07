# 09 — Exam pages

**What to build:** Editors control each Exam page in Exam pages & promo, using the mockup's three columns.

- **Pages:** Exam pages × 5, Home promo banner and Announcement bar. The last two are edited in ticket 10.
- **The selected Exam page:**
  - Exam chips, and "View page ↗"
  - the "Search & AI visibility" card, showing Good or Check
  - the sections, each with a toggle or "ALWAYS ON"
- **The editor:**
  - **Header:** name, long name, text and "made for".
  - **Subjects covered:** the Subject names.
  - **Bundle offer:** a Product of that Exam, a headline, text and the button label.
  - **SEO:** title and description with counters, a search preview and a 1200 × 630 share image.
  - **Official Exam Date.**
- **The Website reads all of this through the Catalogue seam.** The Exam page's promo banners move out of fixed code into catalogue data.

**Blocked by:** 06 — Product photos, and the upload seam (for the share image upload)

**Status:** ready-for-agent

Spec: Phase 2 stories 74, 75, 77; Implementation Decisions → Phase 2 (Exam pages & promo: Exams, Sections, SEO, Official Exam Date). Mockup: BUILD-MAP §3.2 (columns, sections, SEO panel). Conventions: §2 (`/admin/exam-pages`), §3.

- [ ] **The layout follows the mockup:**
  - column 1, PAGES, with the fixed note "Home, About, Products, menu, footer, and legal pages are fixed. Changes to those go through the developer."
  - column 2: the Exam chips CE/ME/EE/MT/CPA, "View page ↗", the visibility card and SECTIONS · SHOW OR HIDE
  - column 3: the editor
- [ ] **The sections:**
  - **Header**, always on: EXAM NAME, LONG NAME, TEXT and MADE FOR. HEADER IMAGE reads "From the top-selling {code} product".
  - **Subjects covered**, can be hidden: each Subject's name is editable, and its code is shown read-only.
  - **Reviewers**, always on: "Products are listed automatically, best selling first."
  - **Bundle offer**, can be hidden, on any Exam: PRODUCT (that Exam's Products), HEADLINE, TEXT and BUTTON LABEL.
  - **Reviews**, can be hidden.
- [ ] **Section toggles** save at once.
- [ ] **The Website follows the sections:**
  - A hidden section disappears from the Website's Exam page.
  - The bundle offer shows only while its Product is Live.
  - The CE bundle offer keeps today's copy, and today's Exam pages render unchanged from the moved data.
- [ ] **SEO:**
  - PAGE ADDRESS, read-only
  - PAGE TITLE with an n/60 counter, and META DESCRIPTION with n/160
  - blank uses the generated text, shown as the placeholder
  - a Google-style SEARCH PREVIEW
  - SHARE IMAGE · 1200 × 630, uploaded through the upload seam, with a warning (not a block) when it isn't 1200 × 630
  - the "SET UP AUTOMATICALLY" flags, shown as information

  The Website's metadata and Open Graph image use the overrides when they are set.

- [ ] **Search & AI visibility** shows GOOD when the title, after the site suffix, is at most 60 characters and the description is 80–160. Otherwise it shows CHECK. This is one pure helper, which the Overview reuses.
- [ ] **OFFICIAL EXAM DATE** is optional and must be a valid date. A past date gets a warning. It isn't shown on the Website yet; Phase 3 uses it.
- [ ] **Subject names.** Editing a Subject's name updates every place the Website shows it: the Exam page, Product pages and the FAQ coverage table.
- [ ] **Validation:**
  - an empty name or text
  - over-length SEO fields, which are refused
  - a bundle Product from another Exam, or one that no longer exists
  - an invalid date

  Save states, the conflict check, the toast and Staff Activity all work as in ticket 02.

- [ ] **Tests:** seam tests (sections, bundle visibility, SEO helper boundaries at 59, 60 and 61, and 79, 80, 160 and 161), the Website Exam page tests updated, e2e (hide Reviews on the ME page and see it gone; change the CE SEO title and see the `<title>`) and axe.
