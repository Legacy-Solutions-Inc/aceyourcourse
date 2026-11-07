# 08 — FAQ page

**What to build:** A Visitor gets answers without messaging the shop. `/faq` has:

- FAQs grouped by topic
- search
- popular question chips
- expand all and collapse all
- some answers backed by a quote from a real Review
- a coverage table linking to every Exam page
- FAQPage structured data

FAQs live in the Catalogue seam. Answers that only make sense once the Member App exists are hidden while the switch is off.

**Blocked by:** 01 — Branded Website shell and Exams menu

**Status:** ready-for-agent

Spec: Phase 1 stories 38–39, 42; Implementation Decisions → Catalogue seam (FAQs), SEO (FAQPage), Member App switch; Vocabulary (Plan, not subscription). Mockup: BUILD-MAP §3 FAQ, §5 FAQ answers.

- [ ] The seam lists FAQs in their 5 fixed groups, in order. Each FAQ has a question, an answer, an optional Review quote, an optional popular-chip label, a "needs the Member App" flag, and "Show on FAQ page".
- [ ] The copy is rewritten for the Website (not "here in the app") using CONTEXT.md vocabulary: Plan, never subscription. App-related answers are flagged and hidden while the switch is off.
- [ ] The hero reads "FAQ · {N} answers", counting visible FAQs only, and shows the contact email.
- [ ] Search filters questions and answers as the Visitor types. Popular chips jump to their question. The sticky topics nav shows counts. Expand all and Collapse all work. The first FAQ is open by default. A deep link such as `#faq-ship` opens and scrolls to that item.
- [ ] No results shows "Clear search" and "Chat us on Shopee" (hidden when there's no shop link).
- [ ] A Review quote must exist word for word in a seeded Review of that Product, otherwise seed validation fails. The mockup's two unsourced quotes are dropped.
- [ ] The coverage table is computed from the catalogue (each Exam with its Subjects) and links to the Exam pages.
- [ ] "Still have a question?" offers "Email us" (mailto) and "Chat us on Shopee".
- [ ] FAQPage JSON-LD includes only the FAQs visible on the page.
- [ ] Metadata: title, description and canonical.
- [ ] Tests cover:
  - the seam (groups, order, visibility, hiding with the switch)
  - quote validation
  - search
  - JSON-LD (only visible FAQs; app FAQs absent while the switch is off)
  - an e2e spec: search, no results, a deep link, and expand or collapse all
