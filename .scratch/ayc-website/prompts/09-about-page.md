# Executer prompt — 09 About page

Ticket: `.scratch/ayc-website/issues/09-about-page.md` · Blocked by: 01, 02 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 / React 19 / TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the mockup doesn't settle a product decision.

GOAL
Build /about, AYC's story page:
- a hero with stats computed from the catalogue and settings, not hardcoded
- the before and after story and the "How it grew" timeline
- the four mission tabs
- the Iloilo City roots, with store buttons
- a closing call to action with a tile for every Exam

CONTEXT
- Already on docs/ayc-v1-planning:
  - the Catalogue seam (src/services/catalogue.ts): listExams() (only Exams with at least one visible Product), listProducts() (Live by default; total), and getWebsiteSettings() (shopStats with asOf, shopLinks)
  - StoreButton, MarketplaceLink and formatAsOf
  - paths (about, products, exams)
- Mockup fixes:
  - the mockup's hardcoded stats ("29 reviewers · 11 board exams") are computed instead: Products = the Live Products shown on the Website (listProducts().total), and Exams = listExams().length
  - the CTA lists EVERY Exam (the mockup left out CPA)
  - "+ Other courses" becomes "All reviewers →" to paths.products.list
- The timeline's "Now" line lists the Exam names from the catalogue instead of the mockup's hardcoded list. The mockup listed ChE, Nursing and Architecture, which aren't in the catalogue.
- The mission tab 03 copy includes prices ("CE posters from ₱400…"). Keep the mockup copy, but flag it in the report: it will drift when prices change.
- Photos: docs/mockup/assets/about-team-studying.jpg, about-handover.jpg, about-mother-daughter.jpg and about-hug.jpg. Self-host them optimised.
- Pages render per request (nonce CSP).
- Mockup: docs/mockup/website/About_v2.dc.html (stats at L172, the timeline at L174, the mission tabs at L163–167). Read docs/mockup/website/BUILD-MAP.md §3 "About" first.

SCOPE
Create:
- src/lib/catalogue/about-stats.ts and its test: aboutStats({ productTotal, examCount, shopStats }) returns the tiles to render: { label, value }[], skipping any tile whose value is 0 or missing.
- src/content/about.ts:
  - the hero copy, story, before/after chips (4 × 6 in, 160 gsm, by subject, posters, notebooks) and the timeline's First and Today lines
  - the 4 mission tabs: 01 Board-focused, nothing extra; 02 Updated to the trend; 03 Made for tight budgets; 04 Original, and protected
  - the Iloilo roots copy, the shipping-label mock text, and the CTA heading "Your turn. Find the reviewer for your board."
- public/about/*.webp, made with cwebp -q 80, longest side ≤ 1600 px, each ≤ 250 KB, with meaningful alt text in content.
- src/app/(website)/about/page.tsx (with generateMetadata).
- src/components/website/about/: about-hero.tsx, our-story.tsx, mission-tabs.tsx (shadcn Tabs), iloilo-roots.tsx and about-cta.tsx, with component tests for mission-tabs and about-cta.
- e2e/about.spec.ts.
Leave untouched: the seam, the shared components' behaviour, docs/mockup/, docs/specs/, docs/adr/ and the other pages.

PAGE BEHAVIOUR (BUILD-MAP §3 "About", with these rules)
- Hero:
  - the H1 "Built by board passers. Designed for dreamers."
  - "Read our story ↓" (#story) and "See the reviewers" (paths.products.list)
  - the team photo (next/image, priority) with the "IPOPHIL registered" sticker
  - the tiles from aboutStats: "{n} reviewers", "{n} board exams", "{rating}★ · {ratingCount} shop ratings" and "{followers} Shopee followers", with the as-of date shown once
- #story: "We passed. Then we made what we wished we had.", the before/after panel, the timeline (First: Civil Engineering flash cards; Now: the catalogue's Exam names joined with Intl.ListFormat; Today: still growing), "And this is only the beginning.", and the three photos.
- The mission tabs are keyboard operable (arrow keys), with the first tab selected.
- Iloilo City roots: "Packed in Iloilo. Shipped to wherever you're reviewing.", the copy, StoreButtons for the 3 shop pages (product undefined, link "shop"; each hidden when null), and the shipping-label mock.
- CTA: a tile for every Exam in listExams() (the code and name, linking to paths.exams.details(code)), plus "All reviewers →".
- Metadata: title "About · made by board passers in Iloilo", a description and canonical paths.about.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if listProducts or StoreButton is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - in the spec: "Phase 1: Website" (story 40; fixed copy; mockup fixes; Media) and "Testing Decisions"
   - BUILD-MAP §3 "About"
   - About_v2.dc.html
3. Skills: test-driven-development, nextjs-app-router, shadcn-ui, tailwind-v4, testing-unit, testing-e2e and coding-standards.
4. Photos. Then TDD aboutStats, then the components (with tests), then the page, then the e2e.
5. Verify. Run requesting-code-review on your diff and fix in-scope findings. Report.

ACCEPTANCE CRITERIA
Happy paths:
- /about shows the hero, with tiles equal to the seeded Live Product count (8 with the mockup seed), the Exam count (5), and the shop figures with their as-of date.
- The timeline's "Now" line lists Civil Engineering, Mechanical Engineering, Electrical Engineering, Medical Technology and Accountancy.
- The mission tabs switch with the arrow keys and show each tab's copy.
- The CTA shows a tile for every Exam (CE, ME, EE, MT and CPA), each linking to its Exam page, plus "All reviewers".
- Every photo is self-hosted WebP with alt text.
Sad paths (each one needs a test):
- aboutStats skips a tile whose value is 0 (an empty catalogue renders no "0 reviewers" tile) and a missing shopStats value.
- Coming Soon Products are not counted in "{n} reviewers". An Exam with no visible Products gets no CTA tile and isn't counted.
- A null shop link hides its button in Iloilo roots.
- No link on the page starts with /app. No text mentions "29 reviewers" or "11 board exams".
- Every image has a non-empty alt (an axe check in e2e).

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage`
- `pnpm test:e2e`
All must pass. Follow verification-before-completion. Report the total size of public/about/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/.
- Never add generateStaticParams, force-static, revalidate or ISR, and never weaken the CSP.
- Read data only through @/services/catalogue, and build routes only with src/paths.ts.
- No hardcoded catalogue numbers. Light-only.
- No new dependencies. shadcn primitives through the CLI are fine. Otherwise stop and ask.
- Out-of-scope bugs go in the report.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion marked ✅ or ❌, with the proving test or spec
3. the happy-path and sad-path tests you added
4. the results of each verification command, and the size of public/about/
5. copy needing client review (the mission tab 03 prices, the timeline), deviations and follow-ups
6. the line "Nothing committed or pushed."
```
