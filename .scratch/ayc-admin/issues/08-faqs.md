# 08 — FAQs

**What to build:** Editors manage the FAQ page under Reviews & FAQs → FAQS.

- **The screen:**
  - the 5 fixed groups, with counts
  - search across groups
  - ▲▼ to reorder within a group
  - "+ Add question to {group}"
- **The editor:**
  - question, and an answer of at most 400 characters
  - group
  - a supporting quote picked from a real Review and checked word for word, with an automatic credit line
  - Show on FAQ page
  - Popular question, with a chip label
  - Only while the Member App is live
  - Show the Subjects table
- **Changes go live** on the FAQ page and in its FAQPage structured data.

**Blocked by:** 07 — Reviews

**Status:** ready-for-agent

Spec: Phase 2 story 73; Implementation Decisions → Phase 2 (FAQ, Deleting, Conflict check). Mockup: BUILD-MAP §3.4 (FAQS tab), §2 deleteFaq. Conventions: §2 (`?tab=faqs&group=&faq=`), §3.

- [ ] **The three columns follow the mockup:**
  - GROUPS, with counts and "Groups match the sections on the FAQ page."
  - the questions, with "SHIPPING · 3 QUESTIONS · ▲▼ TO REORDER" and the meta "WITH REVIEW QUOTE / ANSWER ONLY / · HIDDEN"
  - the editor
- [ ] **Search** covers questions and answers in every group. While searching, ▲▼ is disabled.
- [ ] **Reordering.** ▲▼ moves a question within its group and saves at once. ▲ on the first question and ▼ on the last are disabled.
- [ ] **The editor:**
  - QUESTION, with the placeholder "Write it the way a reviewee would ask".
  - ANSWER, with a "n / 400 CHARACTERS" counter that turns red when over.
  - GROUP. Moving a question to another group puts it at the end of that group.
  - SUPPORTING REVIEW · OPTIONAL. Pick a Review, then paste or select the excerpt. The credit line ("★★★★★ · Product name") is filled in automatically.
  - The toggles: Show on FAQ page ("Off keeps it saved but hidden"), Popular question with a CHIP LABEL of at most 40 characters, Only while the Member App is live, and Show the Subjects table.
- [ ] **New FAQs.** The deep-link address is generated from the question, made unique, shown as `aceyourcourse.ph/faq#faq-{slug}`, and fixed afterwards.
- [ ] **Validation:**
  - "WRITE A QUESTION AND ANSWER TO SAVE", which checks both fields
  - an answer over 400 characters
  - a quote that doesn't appear word for word in the chosen Review: "This text isn't in the Review word for word."
  - a quote from a Review of a hidden or Coming Soon Product
  - Popular on with an empty chip label
- [ ] **Live on save.** "✓ SAVED · LIVE ON THE FAQ PAGE". The FAQ page, its counts, the popular chips and the FAQPage JSON-LD show the change. Hidden and app-only FAQs follow the existing page rules.
- [ ] **Delete** uses a plain confirmation with the mockup's copy, which suggests turning "Show on FAQ page" off instead. It removes the FAQ and closes the gap in that group's order.
- [ ] **Sad paths:**
  - a stale save
  - reordering or deleting an FAQ that is already gone
  - an Editor working on FAQs is allowed, while a signed-out action is refused
- [ ] **Tests:** seam tests, e2e (add an FAQ with a quote and see it on `/faq` with its credit; hide one; reorder; delete) and axe.
