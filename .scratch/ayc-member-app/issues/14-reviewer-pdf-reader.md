# 14 — Reviewer PDF reader with stamped pages

**What to build:** a Member reads a Topic's Reviewer PDF one page at a time with zoom, reopening at their last page. Every page is stamped with their email and Member ID on the server. A dropped connection shows "page didn't load · Try again".

- **The protected page endpoint:**
  - for each page request: the access decision, then stamp the Member's email and short Member ID into the page image with sharp
  - respond with Cache-Control private and a short max-age
  - no CDN or Storage copy
  - the clean image and the original are never sent
- **The reader** (mockup `reviewer`):
  - page N of M, Previous and Next
  - zoom 75–150% in 25% steps, done in the browser
  - no offline caching
  - load errors show "page didn't load · Try again" (mockup `loadError`), and the retry fetches again
- **Progress:** pages viewed are recorded per Member, and viewing a page counts as a Study Day.
- **Resume:** the last page and zoom are stored, and the reader reopens there.
- **States:** the same as ticket 08 (locked, expired, replaced, unavailable, empty).

**Blocked by:** 13.

**Status:** ready-for-agent

Spec: Phase 3 → "Burned-in watermark", "Watermark stamping", "Reviewer PDF reader"; stories 101, 102, 105.

- [ ] A Member reads pages, zooms, leaves, and reopens at the same page and zoom.
- [ ] Each page shows their stamp, and a different Member's page shows theirs.
- [ ] A failed page load shows the retry, and retrying succeeds.
- [ ] **Sad paths, each with a test:**
  - a locked or expired Member's page request is refused, with no image bytes
  - an Unpublished PDF's pages are refused
  - a page number out of range is refused
  - a replaced device is refused
  - the response is never publicly cacheable
  - a stamped page differs from the clean page, in the stamp's region
  - viewing the same page twice records it once
