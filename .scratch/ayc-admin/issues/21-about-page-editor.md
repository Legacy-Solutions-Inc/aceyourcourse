# 21 — About page editor

**What to build:** Editors edit the About page's text and photos in Pages & promo → Site pages → ABOUT. Any field left blank shows today's text.

- **Six sections** in the ABOUT chip's SECTIONS list, each opening in the editor column:

| Section           | Fields                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Header            | intro text; team photo and its alt text                                                                                                 |
| Our story         | heading; paragraphs 1–3; Before card title and text; After card title and up to 5 spec chips; the three story photos and their alt text |
| How it grew       | the First item's title; the Now text (the Exam list is still added after it automatically); the Today text; the closing line            |
| The mission       | heading; intro; four tabs, each with a title and text (always four)                                                                     |
| Iloilo City roots | heading; text; the shipping label's "To" line                                                                                           |
| Closing           | heading                                                                                                                                 |

- **What stays in code.** The small labels above headings, the buttons, the pill and the headline (shared with the footer). About's shape is fixed: four tabs, three timeline items, three story photos.
- **Blank means today's text.**
  - Every field starts blank and shows the text in code as its placeholder. Clearing a field restores it.
  - A photo that was never replaced shows today's photo.
  - The paragraph and spec-chip lists count as blank when every item in them is blank.
- **The rules:**
  - Text is plain, with no markup.
  - Each field has a counter and a limit of about 1.5× today's text, rounded up to a tidy number. Going over is refused, and the counter turns red.
  - A spec chip is at most 20 characters.
  - Photos are JPEG, PNG or WebP, up to 10 MB. A photo that isn't about 4:3, or is under 1200 × 900, is warned about, not refused.
  - A replaced photo needs alt text of 1–150 characters.
  - Mission tab 03 carries the fixed note "This text names prices. Update it when prices change."

**Blocked by:** 20 — Site page SEO

**Status:** ready-for-agent

Spec: Phase 2 story 80b; Implementation Decisions → Phase 2 → "Site pages (added 2026-11-05)"; Phase 1 About decisions. CONTEXT.md: **Site page**. Conventions: §2, §3 (`sitePages`, `catalogue:site-pages`).

- [ ] `?page=site&site=about&section=<header|story|growth|mission|roots|closing>` opens the section. An unknown section opens Header.
- [ ] **Saving a section:**
  - goes live on the About page's next load
  - clears only `catalogue:site-pages`
  - records Staff Activity with before and after
  - requires the stamp
- [ ] **The sample and database arms** behave the same. The migration adds only empty storage. A database with no About record shows every default.
- [ ] **The About page** renders saved text, falls back per field to today's text, and keeps the automatic Exam list after the Now text. With nothing saved, it is identical to today's page: compare a render snapshot taken before the change.
- [ ] **Photos** upload through the upload seam to `site-pages/about/{slot}-{uuid}.{ext}`, where slot is `team`, `story-1`, `story-2` or `story-3`. They show through next/image with their alt text. Replaced objects are deleted after the save commits, and a failed delete is logged.
- [ ] **Sad paths, each with a test:**
  - Text over its limit is refused with the field's message, and the typed text is kept.
  - A spec chip over 20 characters is refused.
  - A sixth spec chip, or a fourth paragraph, can't be added.
  - A replaced photo with blank alt text is refused with "Describe the photo for screen readers.", and alt text over 150 characters is refused.
  - A 1000 × 1000 photo saves, with the 4:3 warning. An 800 × 600 photo saves, with the size warning.
  - A GIF or an 11 MB file is refused by the upload seam.
  - A stale save shows the conflict message, and the typed values are kept.
  - Markup typed into a field shows as plain text on the Website, never as HTML.
  - A database read failure falls back to every default and is logged.
- [ ] **The About copy test** that compares mission tab 03's prices with the catalogue now checks only the default text, and says so in its name.
