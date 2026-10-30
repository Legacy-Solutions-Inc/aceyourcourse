# Executer prompt — 08 FAQ page

Ticket: `.scratch/ayc-website/issues/08-faq-page.md` · Blocked by: 01 · Branch: `feat/website-08-faq-page`

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 / React 19 / TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the mockup doesn't settle a product decision.

GOAL
Build /faq, with FAQs served by the Catalogue Service Seam. It has:
- 5 topic groups
- search
- popular question chips
- expand all and collapse all
- deep links to single questions
- Review-backed quotes
- a coverage table computed from the catalogue
- FAQPage structured data for the visible FAQs only

FAQs that need the Member App are hidden while the switch is off.

CONTEXT
- Already on main:
  - the Catalogue seam (src/services/catalogue.ts, catalogue.mock.ts, catalogue.types.ts, catalogue.schema.ts, mock/catalogue.ts) with listExams(), getExamByCode() and getWebsiteSettings() (contactEmail, shopLinks, memberAppLive)
  - the Website shell and its components
  - JsonLd (src/components/website/json-ld.tsx), if ticket 02 has merged. If it hasn't, create an equivalent nonce-aware JSON-LD script component in the same place, and say so in the report.
- Check whether ticket 02 (Products and Reviews in the seam) is on main: look for listReviews in src/services/catalogue.ts.
  - If it IS: Review quotes reference a seeded Review, and seed validation must prove each quote is a word-for-word substring of that Review's text.
  - If it is NOT: seed FAQs without quotes, add the quote field and the validation rule anyway (tested with fixtures), and report that the quotes still need attaching.
- FAQ groups are fixed, in this order: Shipping, Paper and print, What's covered, Buying and the app, Authenticity.
- The mockup's FAQ copy was written for inside the Member App ("available here in the app"). Rewrite it for the Website. Use the CONTEXT.md vocabulary: Plan and Access Pass, never "subscription"; Member App; Product.
  - Answers that only make sense once the Member App is live (auto-renew, two devices, PayMongo and QR payments, the Billing page) get requiresMemberApp: true and are hidden while the switch is off.
  - The mockup's two unsourced quotes ("Ang bilis din na deliver! Jan. 20…" and "Board paper pero not too thick…") are dropped unless they exist word for word in a seeded Review.
- The coverage table is computed from listExams() (each Exam with its Subjects), with links to the Exam pages. The mockup's hardcoded list is not used.
- Pages render per request (nonce CSP).
- Mockup: docs/mockup/website/FAQ_v2.dc.html (content at L111–133, popular chips at L153). Read docs/mockup/website/BUILD-MAP.md §3 "FAQ" and §5 "FAQ answers" first.

SCOPE
Types, in src/services/catalogue.types.ts:
    type FaqGroup = "shipping" | "paper" | "coverage" | "buying" | "authenticity";
    interface Faq { id: string; slug: string; group: FaqGroup; order: number; question: string; answer: string; reviewQuote: { reviewId: string; text: string } | null; popularLabel: string | null; requiresMemberApp: boolean; showOnFaqPage: boolean; showCoverageTable: boolean }
    // slug is the deep-link id, e.g. "ship" → #faq-ship
Seam: add to CatalogueService (catalogue.ts and catalogue.mock.ts):
    listFaqs(): Promise<{ group: FaqGroup; title: string; items: Faq[] }[]>
  - groups come in the fixed order, items by order
  - only showOnFaqPage items are returned
  - requiresMemberApp items are dropped while memberAppLive is false
  - empty groups are dropped
Seed: the FAQs in src/services/mock/catalogue.ts, rewritten as described, with answers ≤ 400 characters. Keep the mockup's popular chips for the visible ones (ship-from, original). Mark auto-renew and two devices as requiresMemberApp.
Schema rules (catalogue.schema.ts, and test each one):
- unique ids and slugs
- answers ≤ 400 characters
- a known group
- unique order within a group
- a quote's text is a substring of its Review's text, and the Review exists (only once Reviews exist; see CONTEXT)
- at most one FAQ has showCoverageTable
Create:
- src/lib/faq/faq-search.ts and its test: filterFaqs(groups, query), a case-insensitive match over the question and answer that drops empty groups.
- src/lib/faq/faq-json-ld.ts and its test: faqPageJsonLd(groups) gives FAQPage with mainEntity Question and acceptedAnswer for exactly the FAQs passed in.
- src/content/faq-page.ts: hero copy and the "Still have a question?" copy.
- src/app/(website)/faq/page.tsx (with generateMetadata).
- src/components/website/faq/: faq-explorer.tsx (client: search, chips, topics nav, accordions, expand and collapse all, deep links), coverage-table.tsx and still-have-a-question.tsx, with a component test for faq-explorer.
- e2e/faq.spec.ts.
Leave untouched: the existing seam methods, docs/mockup/, docs/specs/, docs/adr/ and the other pages.

PAGE BEHAVIOUR
- Hero: "FAQ · {N} answers", where N counts the visible FAQs. The H1 is "Questions reviewees always ask". Show the contact email from settings.
- Search:
  - the placeholder "Search: shipping, paper, coverage…" (no app terms while the switch is off) and an accessible label
  - filters as the Visitor types
  - the no-results state: "Clear search", and "Chat us on Shopee ↗" (a MarketplaceLink to the Shopee shop page, hidden when null)
- Popular chips: a button for each visible FAQ with a popularLabel. It opens that FAQ and scrolls to it.
- The sticky topics nav lists each group with its count, and links to #topic-{group}. "Expand all" and "Collapse all" buttons.
- Accordions (shadcn Accordion; add it with the CLI if it's missing):
  - the first FAQ is open by default
  - each item has id="faq-{slug}"
  - loading /faq#faq-ship opens and scrolls to that item
- An answer with a reviewQuote shows it as "From a review", with the Product's short name when Reviews exist. The FAQ with showCoverageTable renders the coverage table (each Exam code, name and Subject codes, linking to paths.exams.details(code)).
- "Still have a question?": "Email us" (mailto:{contactEmail}) and "Chat us on Shopee ↗".
- JSON-LD: faqPageJsonLd(the visible groups), through JsonLd.
- Metadata: title "FAQ · shipping, paper, coverage", a description and canonical paths.faq.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if src/services/catalogue.ts with getWebsiteSettings is missing on main.
   - Note whether listReviews exists (see CONTEXT).
   - Run `git switch -c feat/website-08-faq-page main`.
2. Read:
   - AGENTS.md and CONTEXT.md
   - in the spec: "Phase 1: Website" (stories 38–39, 42; the Catalogue seam; SEO FAQPage; the Member App switch; Vocabulary) and "Testing Decisions"
   - BUILD-MAP §3 "FAQ" and §5
   - FAQ_v2.dc.html
   - the seam and its tests
3. Skills: test-driven-development, nextjs-app-router, shadcn-ui, tailwind-v4, testing-unit, testing-e2e and coding-standards.
4. TDD the types and schema rules, then listFaqs, filterFaqs and faqPageJsonLd. Then the components (with tests), then the page, then the e2e.
5. Verify. Run requesting-code-review on your diff and fix in-scope findings. Report.

ACCEPTANCE CRITERIA
Happy paths:
- /faq shows the visible FAQs in the 5 groups, in order, with the first one open, the hero count, the topics nav with counts, popular chips, the coverage table linking to every Exam page, and the contact email.
- Typing "Iloilo" narrows the list to matching FAQs, and the counts update.
- Clicking a popular chip opens and scrolls to its FAQ. "Expand all" opens every item and "Collapse all" closes them.
- /faq#faq-ship loads with that FAQ open and in view.
- The JSON-LD FAQPage has one Question per visible FAQ, with answers matching the page text.
- With MEMBER_APP_LIVE=true, the app FAQs (auto-renew, two devices) appear in "Buying and the app", and the hero count goes up.
Sad paths (each one needs a test):
- With the switch off, no FAQ text mentions "subscription", "PayMongo", "Billing page" or "here in the app". The app FAQs are absent from the page AND from the JSON-LD. No link starts with /app.
- A search with no matches ("zzzz") shows the no-results state. "Clear search" restores everything.
- A null Shopee shop link hides both "Chat us on Shopee" links.
- Schema validation rejects a duplicate slug, a 401-character answer, an unknown group, a duplicate order within a group, two FAQs with showCoverageTable, and a quote that isn't a substring of its Review (or references a missing Review).
- listFaqs drops a group that has no visible items. An FAQ with showOnFaqPage false never renders.
- A deep link to an unknown slug (#faq-nope) loads normally with the first FAQ open, and doesn't throw.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage`
- `pnpm test:e2e`
All must pass. Follow verification-before-completion.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/website-08-faq-page. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/.
- Never add generateStaticParams, force-static, revalidate or ISR, and never weaken the CSP.
- Read data only through @/services/catalogue, and build routes only with src/paths.ts.
- Gate every Member App element and every app answer on memberAppLive. Use the CONTEXT.md vocabulary. Light-only.
- No new dependencies. shadcn primitives through the CLI are fine. Otherwise stop and ask.
- If ticket 02 is in progress elsewhere, expect a small merge conflict in the seam files. Keep your additions in clearly separated blocks.
- Out-of-scope bugs go in the report.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion marked ✅ or ❌, with the proving test or spec
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the rewritten FAQ copy for client review (list every question), which quotes were kept or dropped, deviations and follow-ups
6. the line "Nothing committed or pushed."
```
