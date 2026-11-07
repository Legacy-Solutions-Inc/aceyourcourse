# 10 — Legal pages

**What to build:** A Visitor can read a Privacy Policy and Terms of Use that describe what the Website actually does:

- anonymous, cookieless analytics
- no accounts on the Website
- Marketplace purchases made under the Marketplaces' own terms
- IPOPHIL and copyright, and no reproduction
- one contact email, under the Data Privacy Act and the NPC

Both are versioned as v1.0 with an effective date. The Member App sections come later as v2.0.

**Blocked by:** 01 — Branded Website shell and Exams menu

**Status:** ready-for-agent

Spec: Phase 1 stories 41–42; Implementation Decisions → Phase 1 (Legal); ADR 0009 (disclosure). Mockup: BUILD-MAP §3 Legal, §5 Privacy and Terms summaries (Member App parts excluded).

- [ ] `/legal/privacy` and `/legal/terms` render the header (version, effective date, and a draft label while the content is marked draft), the "In short" summary, a Contents anchor nav and numbered sections (`#s1…`). A tab-style switcher links between the two.
- [ ] `/legal` redirects to `/legal/privacy`. An unknown `/legal/{doc}` gives a 404.
- [ ] The Privacy Policy covers:
  - what the Website collects (anonymous pageviews and Marketplace clicks; nothing stored on the device; IP discarded; no profiles) and the processor (PostHog), plus hosting
  - that there are no accounts or payments on the Website
  - Marketplace purchases under the platforms' policies
  - rights under RA 10173, with the NPC complaint route
  - the contact email from settings as the data-protection contact
- [ ] The Terms of Use cover:
  - use of the Website
  - that prices and Shopee figures are shown "as of" a date and the Marketplace listing is authoritative
  - purchases under Marketplace terms
  - IPOPHIL registration, copyright and no reproduction
  - external links, changes to the terms, and Philippine law
  - the contact
- [ ] Legal content is typed and versioned in the repo, with a version, effective date and status.
- [ ] Metadata: title, description and canonical.
- [ ] Tests cover:
  - the content schema (a version and a valid effective date are required; section ids are unique)
  - no Member App or payment sections in v1.0
  - an e2e spec: both pages, the anchor nav, the redirect and an unknown doc's 404
