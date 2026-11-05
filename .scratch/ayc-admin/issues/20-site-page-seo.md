# 20 — Site page SEO

**What to build:** Editors set the search title, description and share image of the five Site pages (Home, Products, Reviews, About, FAQ) in the Admin, the same way they already do for Exam pages.

- **Rename.** The menu item "Exam pages & promo" becomes **"Pages & promo"**. Its address stays `/admin/exam-pages`.
- **A new PAGES entry.** "Site pages × 5" appears beside "Exam pages × 5", "Home promo banner" and "Announcement bar", with chips HOME · ABOUT · PRODUCTS · FAQ · REVIEWS.
- **Each chip opens that page's "Search & AI visibility" panel.** It's the Exam page SEO editor, unchanged:
  - the page address, shown read-only
  - the title (n/60) and the description (n/160). Blank uses today's text, shown as the placeholder.
  - the Google-style preview, and GOOD or CHECK
  - a 1200 × 630 share image: a warning when it's another size, never a refusal. Blank uses the site's share image.
- **The fixed note** under PAGES becomes "Menu, footer, and legal pages are fixed. Changes to those go through the developer."
- **On the Website**, each Site page's title, description and share image come from the Catalogue seam, and fall back to today's text and the site's image.

**Blocked by:** None. Tickets 16 and 17 are done: the database, Storage and the upload seam exist.

**Status:** ready-for-agent

Spec: Phase 2 stories 75 and 80a; Implementation Decisions → Phase 2 → "Site pages (added 2026-11-05)", Menu, Staff Role permissions, Exam pages & promo (SEO per Exam page). CONTEXT.md: **Site page**. Conventions: §2 (the route table), §3 (the Catalogue and Admin seams, `sitePages`, `catalogue:site-pages`).

- [ ] The menu, the screen's title, the Overview's needs-attention text, and every other mention say "Pages & promo". `/admin/exam-pages` and its existing `?exam=` and `?page=` addresses still work.
- [ ] `?page=site&site=<home|about|products|faq|reviews>` opens that Site page's panel. Any other `site` value falls back to Home.
- [ ] **Saving** the title, description or share image:
  - goes live on the Website's next load
  - clears only `catalogue:site-pages`
  - records Staff Activity with the before and after values
  - requires the stamp (`requiresStamp: true`), so a stale save gets the conflict message
- [ ] **The sample and database arms** behave the same. The migration adds the storage for the five pages with nothing in it. A database with no Site page rows (the hosted project as it is today) shows every default.
- [ ] **On the Website:**
  - each Site page's `<title>`, meta description, Open Graph and Twitter data use the saved values, or today's text when blank
  - the share image is the uploaded one or the site's
  - canonical addresses don't change
- [ ] **The share image** uploads through the upload seam to `site-pages/{page}/share-{uuid}.{ext}`, in sample mode and in Storage. A replaced or cleared image's old object is deleted after the save commits; a failed delete is logged and never fails the save.
- [ ] **Sad paths, each with a test:**
  - a title over 60 or a description over 160 characters shows CHECK and still saves, exactly as for Exam pages
  - a stale save shows the conflict message, and the typed values are kept
  - an unknown `site` value falls back to Home
  - a GIF or an 11 MB file is refused by the upload seam with its usual messages
  - a 1000 × 500 share image saves with the size warning
  - a signed-out request to the save action is refused by the Staff Guard
  - a database read failure on a Site page falls back to the defaults and is logged, so the Website never breaks
