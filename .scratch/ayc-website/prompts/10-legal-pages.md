# Executer prompt — 10 Legal pages

Ticket: `.scratch/ayc-website/issues/10-legal-pages.md` · Blocked by: 01 · Branch: `feat/website-10-legal-pages`

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 / React 19 / TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the mockup doesn't settle a product decision.

GOAL
Publish a Privacy Policy and Terms of Use for the Website, at /legal/privacy and /legal/terms. Each:
- is typed, versioned content (v1.0) with an effective date and a draft status
- has an "In short" summary, a Contents anchor nav and numbered sections
- describes only what the Website actually does

CONTEXT
- Already on main:
  - the Website shell
  - getWebsiteSettings() in the Catalogue seam (contactEmail aceyourcourseinc@gmail.com, shopLinks)
  - paths.legal.privacy and paths.legal.terms
- What the Website does (this is what the documents must describe):
  - It has no accounts, sign-in, payments, cart or forms. It's a catalogue that links out to the Marketplaces (Shopee, Lazada, TikTok Shop), where purchases happen under each platform's own terms and privacy policy.
  - Analytics (ADR 0009): PostHog in cookieless, anonymous mode. Nothing is stored on the device (no cookies, no local storage for analytics). IP addresses are discarded. No person profiles are created. The events are pageviews and Marketplace clicks (Product, Marketplace and page). There's no consent banner, because anonymous data isn't personal information under the Data Privacy Act of 2012 (RA 10173).
  - Hosting: Vercel, with data services on Supabase, both in Singapore (ADR 0012).
  - Functional browser storage: the announcement bar remembers its dismissal in local storage. That's not analytics; disclose it plainly.
  - Content is registered with IPOPHIL and protected by copyright, and reproduction isn't allowed.
  - Prices and Shopee figures are shown "as of" a date. The Marketplace listing is authoritative.
  - One public contact for support and data protection: the contact email from settings.
- Version 1.0 is Website-only. The Member App sections (Google sign-in, progress, payments through PayMongo, watermarking, one Active Device) arrive as v2.0 at the Member App launch. They must NOT appear in v1.0.
- The status is "draft" until the client's lawyer reviews it. The header shows "Version 1.0 · Effective {date} · Draft for legal review" while it's a draft, and no draft label once it's "final". The effective date is 2026-12-01, a placeholder that's flagged for the client.
- Pages render per request (nonce CSP).
- Mockup: docs/mockup/website/Legal.dc.html (layout: tabs, "In short", Contents, 8 sections). Read docs/mockup/website/BUILD-MAP.md §3 "Legal" and §5 (the Privacy and Terms summaries; use only their Website-applicable parts) first.

SCOPE
Create:
- src/content/legal/types.ts:
    interface LegalDocument { kind: "privacy" | "terms"; title: string; version: string; effectiveDate: string; status: "draft" | "final"; summary: string[]; sections: { id: string; title: string; paragraphs: string[] }[] }
- src/content/legal/schema.ts and its test: a zod schema. version matches /^\d+\.\d+$/; effectiveDate is a valid ISO date; the summary has 3–6 items; section ids are unique and match /^s\d+$/; there's at least one section.
- src/content/legal/privacy.ts and src/content/legal/terms.ts: the v1.0 content, validated by the schema in a test.
  - Privacy sections: who we are and how to reach us; what the Website collects (anonymous analytics only) and what it doesn't; browser storage; why; who processes it (PostHog, Vercel, Supabase) and where; Marketplace purchases; your rights under RA 10173 and the NPC complaint route; changes and version history.
  - Terms sections: using the Website; product information and "as of" figures; buying on the Marketplaces; intellectual property (IPOPHIL) and no reproduction; external links; limitation of liability; changes; governing law (the Philippines) and contact.
  - Write the contact email in through settings, not hardcoded.
- src/app/(website)/legal/[doc]/page.tsx (with generateMetadata) and src/app/(website)/legal/page.tsx, which calls redirect(paths.legal.privacy).
- src/components/website/legal/: legal-header.tsx, legal-switcher.tsx (links styled as tabs, with aria-current), legal-contents.tsx (the anchor nav) and legal-body.tsx, with a component test for legal-header (draft vs final).
- e2e/legal.spec.ts.
Leave untouched: the seam, docs/mockup/, docs/specs/, docs/adr/ and the other pages.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if getWebsiteSettings or paths.legal is missing on main.
   - Otherwise run `git switch -c feat/website-10-legal-pages main`.
2. Read:
   - AGENTS.md and CONTEXT.md
   - in the spec: "Phase 1: Website" (story 41; Legal; Analytics) and "Out of Scope"
   - ADRs 0009 and 0012
   - BUILD-MAP §3 "Legal" and §5
   - Legal.dc.html
3. Skills: test-driven-development, nextjs-app-router, tailwind-v4, shadcn-ui, testing-unit, testing-e2e and coding-standards.
4. TDD the schema, then the content (validated by a test), then the components, then the routes and the e2e.
5. Verify. Run requesting-code-review on your diff and fix in-scope findings. Report.

ACCEPTANCE CRITERIA
Happy paths:
- /legal/privacy and /legal/terms each show:
  - the header "Version 1.0 · Effective 1 Dec 2026 · Draft for legal review"
  - the "In short" summary
  - a Contents nav whose links jump to #s1…#sN
  - the numbered sections
  - the switcher, with the current document marked aria-current
- The Privacy Policy states that the Website uses anonymous, cookieless analytics, discards IP addresses, creates no profiles, has no accounts or payments, and names the processors. It gives the settings contact email as the data-protection contact.
- The Terms of Use state that purchases happen on the Marketplaces under their terms, that prices and figures are "as of" a date, and that the content is IPOPHIL-registered and must not be reproduced.
- /legal redirects to /legal/privacy.
- With status "final" (a component test), the header shows no draft label.
Sad paths (each one needs a test):
- /legal/cookies and /legal/PRIVACY return 404 inside the Website shell (only the exact lowercase kinds are valid).
- The schema rejects a version "1", an effectiveDate "2026-13-40", duplicate section ids, a section id "intro", and an empty summary.
- Neither v1.0 document contains "PayMongo", "Google sign-in", "watermark", "subscription", "Billing" or "privacy@aceyourcourse.ph" (a test over the content).
- No link on either page starts with /app.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage`
- `pnpm test:e2e`
All must pass. Follow verification-before-completion.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/website-10-legal-pages. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/.
- This is draft legal text for the client's lawyer to review. Write it plainly and accurately to the Website's real behaviour, and don't claim compliance certifications or facts you can't verify. List every assumption in the report.
- Never add generateStaticParams, force-static, revalidate or ISR, and never weaken the CSP.
- Build routes only with src/paths.ts. Light-only.
- No new dependencies (no MDX). Otherwise stop and ask.
- Out-of-scope bugs go in the report.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion marked ✅ or ❌, with the proving test or spec
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. assumptions and questions for the client's lawyer (the effective date, the retention wording, processor locations), deviations and follow-ups
6. the line "Nothing committed or pushed."
```
