# Executer prompt — 05 Home, top half

Ticket: `.scratch/ayc-website/issues/05-home-top-half.md` · Blocked by: 02 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 / React 19 / TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the mockup doesn't settle a product decision.

GOAL
Replace the placeholder Home with the real top half of the Home page, down to Best sellers:
- the hero, with a compressed self-hosted promo video that downloads nothing on mobile until the Visitor taps play
- the "Try a card" flip widget
- the ticker
- "Four steps to your reviewer"
- "Find your exam"
- the Best sellers carousel

CONTEXT
- Already on docs/ayc-v1-planning:
  - the Catalogue seam (src/services/catalogue.ts) with listExams(), listProducts(filters), listBestSellers(limit) and getWebsiteSettings() (shopStats with an asOf date, memberAppLive)
  - ProductCard, Marquee, formatPeso, productPriceLabel and formatAsOf
  - paths (products, exams, memberApp)
  - the placeholder Home at src/app/(website)/page.tsx, with the H1 "Remember every formula on board day."
- The promo video source is in the mockup zip at export/assets/ayc-main-ad.mp4 (14.5 MB, 59 s, 1280×720). Ship a compressed copy of about 2–4 MB at 720p. The poster is docs/mockup/assets/ayc-main-ad-poster.png.
- The 3 "Try a card" back images are docs/mockup/assets/card-ce-major-head-loss.png, card-me-potential-energy.png and card-ee-wave-motion.png.
- next.config.ts sends `Permissions-Policy: … autoplay=()`, which blocks even muted autoplay. Change only that token to `autoplay=(self)`.
- CSP: media and images come from 'self' (default-src and img-src), so self-hosted files need no CSP change. Don't change the CSP.
- Decision: the "other courses / coming soon Exams" concept was dropped. There's no "+ Other courses" tab, no "Coming to the site" row and no "OTHER COURSES →" link.
- With the Member App switch off, no Home copy may mention or link to the app. That includes the sub-headline's "also available in the app", "Try the app free", the steps that mention the app, and "Review {code} in the app". Use the app-free copy variants below and flag them for client review.
- Coming Soon Products never appear on Home.
- Mockup: docs/mockup/website/Home_v2.dc.html, items 1–4 (L14–172; the cards' data is at L275–279, the ticker at L316, the steps at L317–321, the exam logic at L326–338 and best sellers at L341–342). Read docs/mockup/website/BUILD-MAP.md §3 "Home" items 1–4 and §7 "Media" first.

SCOPE
Create:
- Media, built outside the repo first:
  - unzip -j "/Users/rafaeliiiprudente/Downloads/Ace Your Course Mockup (1).zip" "export/assets/ayc-main-ad.mp4" -d <new empty tmp dir>
  - ffmpeg -i <tmp>/ayc-main-ad.mp4 -vf "scale=-2:720" -c:v libx264 -profile:v high -preset slow -crf 28 -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart public/media/ayc-promo-720p.mp4
  - adjust the CRF between 26 and 32 until the file is 2–4 MB
  - cwebp -q 80 docs/mockup/assets/ayc-main-ad-poster.png -o public/media/ayc-promo-poster.webp
  - the 3 card images as WebP in public/cards/
- src/content/home.ts:
  - hero copy
  - ticker items
  - the steps, with { appOn, appOff } variants
  - the try-a-card cards: { examCode, subjectCode, topic, image, alt }
  The app-off steps, which you should flag for client review:
  - 01 "Pick your board exam" → #exams
  - 02 "Choose your format" ("Flash cards, a notebook, posters, or the bundle.") → #formats
  - 03 "Review anywhere" ("Cards in your bag, posters on your wall.") → #reviews
  - 04 "Order from our official stores" ("Shopee, Lazada or TikTok Shop, shipped from Iloilo City.") → paths.products.list
  The app-on variants use the mockup copy, with step 04 going to paths.memberApp.plans.
- src/components/website/home/:
  - hero.tsx
  - hero-video.tsx (client)
  - try-a-card.tsx (client)
  - home-ticker.tsx
  - four-steps.tsx
  - find-your-exam.tsx (shadcn Tabs)
  - best-sellers.tsx (client carousel)
  with component tests for hero-video, try-a-card, four-steps and best-sellers.
- src/lib/catalogue/best-sellers.ts and its test: soldBarPercent(product, top), rounded and clamped to 0–100.
- e2e/home.spec.ts.
Modify:
- src/app/(website)/page.tsx: compose the sections, with Home metadata (title, description and canonical "/").
- next.config.ts: autoplay=() becomes autoplay=(self). Nothing else.
- e2e/auth-smoke.spec.ts, only if its Home assertion needs to change.
Leave untouched: the Home sections below Best sellers (ticket 06), the seam's rules, docs/mockup/, docs/specs/, docs/adr/ and the CSP.

SECTION BEHAVIOUR
- Hero video (hero-video.tsx). The server render shows the poster (next/image, priority) and a "Play video" button, with NO <video> source. After mount:
  - if the viewport is at least 760 px wide, the Visitor doesn't prefer reduced motion and navigator.connection?.saveData isn't true: render <video autoPlay muted loop playsInline preload="auto" poster> with the MP4 as a decorative background (aria-hidden, no controls)
  - otherwise keep the poster. Tapping "Play video" renders <video controls autoPlay playsInline> with the MP4.
- Hero copy:
  - the pill "Licensure exam reviewers · made by passers"
  - the H1 "Remember every formula on board day."
  - the sub-headline, whose app clause shows only when the switch is on
  - the trust line "★★★★★ {rating} from {ratingCount} ratings · IPOPHIL registered · {as of}", with the stars exposed to screen readers as text
  - CTAs: "Find your exam ↓" (#exams), "▶ Watch 1 min" (#video, a section ticket 06 builds), and "Try the app free" (paths.memberApp.home, only when the switch is on)
- Try a card:
  - 3 cards: the front has the topic, Exam and Subject; the back has the image with its alt text
  - it auto-flips every 3.2 s until the first pointer, keyboard or touch interaction, and never auto-flips under reduced motion
  - the card is a button with aria-pressed and the label "Flip card"
  - Exam-code dots choose a card (aria-label "Show the {code} card"), and "Next card →" cycles
- Ticker: a Marquee of the content items, plus "★ {rating} shop rating" and "{ratingCount} ratings" from settings, plus the Exam codes from listExams().
- Four steps: the appOn or appOff variant, chosen by memberAppLive.
- Find your exam (#exams):
  - one tab per Exam that has Live Products (arrow keys move between tabs)
  - the panel shows the code, name, board · long name, blurb, and Subject chips with the code visible and the full name available to screen readers and on hover or focus
  - "All {code} reviewers →" goes to the Exam page; "Review {code} in the app" shows only when the switch is on and a Live Product is availableInApp
  - the right column, "Step 2 · Choose a format · {N} reviewers", lists rows for the Exam's Live Products by units sold: thumbnail, format, the "Also in app" badge (switch on only), short name, rating, sold and price label, each linking to the Product page
- Best sellers:
  - "Ranked by units sold on Shopee" with the as-of date
  - listBestSellers(6) in a scroll-snap carousel; the ← and → buttons have accessible names and are disabled at the start and end
  - each card has a rank badge (#1 in orange), exam · format, short name, rating · ratings, price, and a sold bar (soldBarPercent, aria-hidden) beside visible "{n} sold" text
  - each card links to its Product page
  - the section is hidden when there are no best sellers

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if listBestSellers or Marquee is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - in the spec: "Phase 1: Website" (stories 1–4, 6–7, 10; Media; fixed copy; Member App switch) and "Testing Decisions"
   - BUILD-MAP §3 Home items 1–4 and §7
   - Home_v2.dc.html
   - the seam and the shared components
3. Skills: test-driven-development, nextjs-app-router, shadcn-ui, tailwind-v4, testing-unit, testing-e2e and coding-standards.
4. Media first: report the final MP4 size, duration and resolution (from ffprobe). Then TDD soldBarPercent and the components (mock matchMedia and navigator.connection; use fake timers). Then the page, then the e2e.
5. Verify. Run requesting-code-review on your diff and fix in-scope findings. Report.

ACCEPTANCE CRITERIA
Happy paths:
- At 1280 px, Home shows the hero with a muted, looping background video whose currentSrc ends in ayc-promo-720p.mp4, then the trust line with the as-of date, the Try-a-card widget, the ticker, four steps, Find your exam (CE selected by default) and up to 6 best sellers ranked by units sold.
- public/media/ayc-promo-720p.mp4 is 2–4 MB and 720p, and the poster is WebP.
- Try a card flips by itself after 3.2 s, and Enter on the focused card flips it. The dots and "Next card" change the card.
- In Find your exam, pressing ArrowRight moves to the ME tab, and the ME rows link to the ME Product pages.
- The first best seller has the "#1" badge and a 100% sold bar. The ← button is disabled at the start, and → scrolls.
Sad paths (each one needs a test):
- At 390 px, no request for the MP4 is made on load (assert with Playwright's request listener). After tapping "Play video", the MP4 is requested and plays with controls.
- With prefers-reduced-motion: no autoplaying video, and Try a card doesn't auto-flip. With navigator.connection.saveData true: no autoplaying video (component test).
- After any interaction, Try a card stops auto-flipping (fake timers: no flip after 10 s).
- With the switch off: no "Try the app free", no app clause in the sub-headline, no app wording in any step, no "Review {code} in the app", and no link starting with /app. With the switch on, they're present (component test).
- An Exam whose Products are all Coming Soon gets no tab. Coming Soon Products never appear in the rows or in best sellers.
- With 0 best sellers the section isn't rendered; with 3 only 3 render and → is disabled.
- soldBarPercent clamps to 0–100 and returns 0 when the top seller's units sold is 0.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage`
- `pnpm test:e2e`
All must pass. Follow verification-before-completion. Include the ffprobe summary of the MP4.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/. Extract the zip outside the repo, and never commit the 14.5 MB original.
- In next.config.ts, change only the autoplay token. Don't touch the CSP.
- Never add generateStaticParams, force-static, revalidate or ISR.
- Read data only through @/services/catalogue, and build routes only with src/paths.ts.
- Gate every Member App element on memberAppLive. Coming Soon Products never appear on Home. Light-only.
- No new dependencies. shadcn primitives through the CLI are fine. Otherwise stop and ask.
- Out-of-scope bugs go in the report.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion marked ✅ or ❌, with the proving test or spec
3. the happy-path and sad-path tests you added
4. the results of each verification command, and the MP4 size, duration and resolution
5. copy needing client review (the app-off steps, the trust line), deviations and follow-ups
6. the line "Nothing committed or pushed."
```
