# 01 — Branded Website shell and Exams menu

**What to build:** A Visitor opening any Website page sees Ace Your Course, not the template. The page uses the AYC brand: cream, navy, orange and blue, hard offset shadows and borders, Schibsted Grotesk and JetBrains Mono, light only. Every page has the announcement bar, the site navigation with an Exams menu, the footer, and a branded placeholder Home. The **Catalogue Service Seam** comes alive with Exams, their Subjects and the Website settings. Every later ticket reads through it. The **Member App switch** exists and is off, so no Member App button shows. Analytics runs cookieless and anonymous. Public pages no longer make a Supabase round trip.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

Spec: `docs/specs/2026-10-29-ayc-v1.md` → Phase 1 stories 11, 42–45, 47, 49; Implementation Decisions → Architecture and cross-cutting, Phase 1 (Catalogue seam, Member App switch, Analytics, Rendering and caching, Middleware scope). ADRs 0008, 0009. Mockup: `docs/mockup/website/BUILD-MAP.md` §2 (SiteNav, SiteFooter).

- [ ] Brand tokens drive the shadcn theme. There is no dark mode and no theme toggle, and switching the OS to dark mode doesn't change the Website.
- [ ] Navigation: the logo goes Home. The Exams menu lists every Exam from the Catalogue seam (code, name, board), each linking to its Exam page. Products, Reviews, About and FAQ links mark the current page. The menu opens by click and keyboard, and closes on Esc or an outside click.
- [ ] Mobile (below 760 px): a burger opens a drawer with the Exam grid, the four links, and a "Printed copies" row of Marketplace shop links.
- [ ] Footer, matching the mockup with its fixes: "Reviews" goes to the Reviews page; shop stats show with an "as of" date; one contact email appears everywhere. An empty shop or social link hides its item.
- [ ] Announcement bar:
  - rotates every 4.5 s, pauses on hover or focus, and doesn't rotate under reduced motion
  - dismissal is remembered in the browser, and a changed announcement shows again
  - if browser storage is blocked, there's no crash and the bar still dismisses for that visit
- [ ] Member App switch (off by default): "Sign in", "Start reviewing", "Sign in to the app" and the app announcement message are hidden. With the switch on, they appear and link to the Member App. The switch flips with no code change.
- [ ] Catalogue seam:
  - lists Exams with their Subjects
  - gets an Exam by code, case-insensitive, and returns not found for an unknown code
  - returns Website settings: Marketplace shop links, social links, contact email, shop stats with an "as of" date, announcement messages, the promo banner and the Member App switch
  - its seed validation rejects duplicate Exam codes and blank Subject names
- [ ] Analytics:
  - PostHog is cookieless and anonymous: nothing stored on the device, no consent gating, no banner
  - a `marketplace_click` helper takes Product (optional), Marketplace and page, and does nothing when analytics is unconfigured
  - footer and drawer shop links fire it
- [ ] Middleware:
  - sets the CSP on every route
  - calls Supabase only for signed-in or auth areas, and never for public pages
  - matches on prefix boundaries (`/application` is not `/app`)
- [ ] Branded favicon, OG image, manifest, metadata title template, and 404 and error pages.
- [ ] The template's marketing Home is replaced by a branded placeholder Home with the H1 "Remember every formula on board day."
- [ ] Tests cover happy and sad paths for the seam, the switch on and off, the announcement storage, the session-route matcher and the analytics no-op. The e2e smoke test is updated. Axe passes on `/` with the color-contrast rule enabled.
