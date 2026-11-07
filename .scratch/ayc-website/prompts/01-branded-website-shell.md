# Executer prompt — 01 Branded Website shell and Exams menu

Ticket: `.scratch/ayc-website/issues/01-branded-website-shell.md` · Blocked by: none · Branch: `feat/website-01-shell`

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 / React 19 / TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the mockup doesn't settle a product decision.

GOAL
Replace the template's look and marketing shell with the branded Ace Your Course Website shell: an announcement bar, site navigation with an Exams menu, a footer, and a branded placeholder Home. Alongside it, stand up:
- the Catalogue Service Seam (Exams with Subjects, and Website settings)
- the Member App switch, off by default
- cookieless anonymous PostHog with a marketplace_click helper
- middleware that skips Supabase on public routes
Every later Website ticket builds on this.

CONTEXT
- Ace Your Course (AYC) is a small Iloilo City company. It sells physical study items (Products: flash cards, posters, notebooks, bundles) for Philippine licensure Exams, only on the Marketplaces (Shopee, Lazada, TikTok Shop). The Website is a catalogue and funnel and sells nothing itself.
- Phase 1 is the Website only, and it is mock-first (ADR 0003). Data comes from a typed seed behind a Service Seam. Phase 2 adds a database implementation behind the same seam with no page changes. Follow AGENTS.md for every stack rule.
- Rendering: src/app/layout.tsx calls `await headers()` so that every route renders per request. The strict CSP uses a per-request nonce set in src/middleware.ts, so no page can be static. Keep it that way.
- Middleware today creates a Supabase client and calls auth.getUser() on every matched request, including public pages. From now on only the signed-in and auth areas need a session.
- Analytics today is consent-gated: NEXT_PUBLIC_POSTHOG_REQUIRE_CONSENT defaults to true, and there's no banner, so zero events fire. ADR 0009 (amending 0007) decides: cookieless, anonymous, no consent banner, no gating. The events are pageviews and marketplace_click only.
- Theme today: next-themes ThemeProvider (system default), src/components/theme/mode-toggle.tsx, and a `.dark` token block in globals.css. AYC is light-only.
- The template marketing pages are src/app/(marketing)/ with src/components/marketing/{hero,features,cta,footer,marketing-nav}.tsx. They become the Website shell under src/app/(website)/.
- Seed source: docs/mockup/aycData.js (EXAMS, EXAM_INFO, STORES, CONTACT, SHOP). Seed only the 5 Exams that have Products in the mockup: CE, ME, EE, MT and CPA, with EXAM_INFO's name, long name, blurb, "for3" (madeFor) and subjects. Do NOT seed the 6 `soon` Exams. The "pages coming soon" concept was dropped, and the client's full catalogue adds those Exams later together with their Products.
- Brand: cream #F6F1E7, navy #0E1A2E, orange #FF881F, blue #005AA5; hard offset shadows and thick navy borders; Schibsted Grotesk (UI) and JetBrains Mono (labels and codes). Take the exact shadow, border, radius and type values from the CSS in docs/mockup/website/SiteNav.dc.html, SiteFooter.dc.html and Home_v2.dc.html. Brand SVGs: docs/mockup/assets/brand-horizontal.svg and brand-mark.svg.
- Contrast: orange is a fill (navy text on orange is about 7:1). Never use orange text on cream for body copy. The a11y suite must pass with axe's color-contrast rule enabled.
- Vocabulary (CONTEXT.md): Exam, Subject, Product, Marketplace, Marketplace Listing, Coming Soon, Member App, Website. Visitor-facing copy may say "reviewers", as the mockup does. Code uses the domain terms.

SCOPE
Create:
- src/services/catalogue.types.ts. Types for this ticket only (Products and Reviews are added in ticket 02; don't add them now):
    type Marketplace = "shopee" | "lazada" | "tiktok";
    interface Subject { code: string; name: string }
    interface Exam { code: string; board: string; name: string; longName: string; blurb: string; madeFor: string; subjects: Subject[] }
    interface AnnouncementMessage { text: string; href: string; requiresMemberApp: boolean }
    interface PromoBanner { visible: boolean; text: string; buttonLabel: string; href: string; startDate: string; endDate: string } // ISO dates, Asia/Manila days
    interface ShopStats { rating: number; ratingCount: number; followers: string; asOf: string } // asOf = ISO date
    interface WebsiteSettings {
      shopLinks: Record<Marketplace, string | null>;
      socialLinks: { tiktok: string | null; facebook: string | null; instagram: string | null };
      contactEmail: string;
      shopStats: ShopStats;
      announcement: { id: string; messages: AnnouncementMessage[] };
      promoBanner: PromoBanner | null;
      memberAppLive: boolean;
    }
- src/services/catalogue.schema.ts: a zod schema for the seed (Exams and settings now; ticket 02 extends it), plus a `validateCatalogueSeed(seed)` that returns readable errors.
- src/services/mock/catalogue.ts: the seed.
  - Exams: as above.
  - shopLinks: from STORES.
  - socialLinks: TikTok https://www.tiktok.com/@aceyourcourse, plus Facebook and Instagram from CONTACT.
  - contactEmail: aceyourcourseinc@gmail.com.
  - shopStats: 4.8 / 874 / "3.7K" as of 2026-10-29.
  - announcement: the three messages from SiteNav.dc.html. The app message has requiresMemberApp: true and links to paths.memberApp.home; the others link to paths.products.list and paths.faq.
  - promoBanner: { visible: false, text: "11.11 · Any 2 reviewers, 4% off on Shopee", buttonLabel: "Shop the sale", href: the Shopee shop link, startDate: "2026-11-09", endDate: "2026-11-11" }.
- src/services/catalogue.mock.ts: the in-memory implementation. memberAppLive comes from serverEnv.MEMBER_APP_LIVE === "true".
- src/services/catalogue.ts: the seam, built like src/services/customers.ts.
    interface CatalogueService {
      listExams(): Promise<Exam[]>;                       // seed order
      getExamByCode(code: string): Promise<Exam | null>;  // case-insensitive; null when unknown or blank
      getWebsiteSettings(): Promise<WebsiteSettings>;
    }
  For now the selector has only the mock arm. Add a comment that Phase 2 adds the Drizzle arm. Don't create a db file.
- src/services/catalogue.test.ts and src/services/catalogue.schema.test.ts.
- src/content/website.ts: typed fixed copy the shell needs (the footer headline and "Where to buy" copy, the IPOPHIL line, "Ships all over the Philippines"). Later tickets add to this file.
- src/lib/money.ts and its test: `formatPeso(centavos: number)` gives "₱1,200" for 120000 and "₱1,249.50" for 124950 (en-PH; decimals only when not whole).
- src/lib/manila-time.ts and its test: `formatAsOf(isoDate)` gives "as of Oct 2026"; `manilaYear(now: Date)` returns the Asia/Manila year. Use Intl with timeZone "Asia/Manila".
- src/lib/analytics/events.ts and its test: `trackMarketplaceClick({ product?: string; marketplace: Marketplace; page: string; link: "listing" | "shop" })` calls posthog.capture("marketplace_click", …) only when posthog.__loaded is true.
- src/lib/session-routes.ts and its test: `needsSession(pathname)` is true only for /dashboard, /auth, /app and /admin, exactly or followed by "/".
- src/components/website/: site-nav.tsx (Server Component that reads the seam), exams-menu.tsx, mobile-nav.tsx (shadcn Sheet), site-footer.tsx, announcement-bar.tsx (client), marketplace-link.tsx (a client link that opens in a new tab with rel="noopener noreferrer" and calls trackMarketplaceClick), plus tests for announcement-bar and for the switch-gated nav and footer CTAs.
- src/app/(website)/layout.tsx and src/app/(website)/page.tsx. The placeholder Home has the H1 "Remember every formula on board day." and the mockup's sub-headline without the app clause.
- public/brand/: the brand SVGs copied from docs/mockup/assets/.
Modify:
- src/app/globals.css:
  - map the AYC tokens onto the shadcn variables (background cream, foreground navy, primary navy, accent orange, ring blue, borders navy)
  - add hard-shadow tokens and font variables
  - delete the `.dark { … }` block
  - KEEP `@custom-variant dark (&:is(.dark *));`, with a comment that no element ever gets `.dark`. Tailwind v4's default dark variant follows prefers-color-scheme and would re-enable dark styles inside the vendored shadcn components.
- src/app/layout.tsx:
  - next/font/google for Schibsted Grotesk and JetBrains Mono
  - remove ThemeProvider and suppressHydrationWarning
  - a viewport export with colorScheme "light" and themeColor navy
  - metadata title template "%s · Ace Your Course"
  - keep `await headers()`
- src/components/ui/sonner.tsx: remove useTheme and use the fixed light theme.
- src/components/dashboard/layout/top-bar.tsx: remove the ModeToggle usage only.
- Delete src/components/theme/, and run `pnpm remove next-themes`.
- src/paths.ts: add (keep every existing key):
    products: { list: "/products", details: (slug: string) => `/products/${slug}` },
    exams: { details: (code: string) => `/exams/${code.toLowerCase()}` },
    reviews: "/reviews", faq: "/faq", about: "/about",
    legal: { privacy: "/legal/privacy", terms: "/legal/terms" },
    memberApp: { home: "/app", plans: "/app/plans" },
- src/env.server.ts and src/env.test.ts: add `MEMBER_APP_LIVE: optionalEnv(z.enum(["true", "false"]).optional())`, and document it in .env.example (default off).
- PostHog:
  - remove NEXT_PUBLIC_POSTHOG_REQUIRE_CONSENT from src/env.ts and .env.example
  - in src/instrumentation-client.ts: `persistence: "memory"`, `autocapture: false`, no opt_out_capturing_by_default; keep person_profiles "identified_only" and never call identify on the Website; keep respect_dnt and disable_session_recording/disable_surveys
  - delete src/lib/analytics/consent.ts (nothing else uses it)
  - update the comments to cite ADR 0009
- src/middleware.ts:
  - when !needsSession(pathname), return passThrough() before creating any Supabase client, so the CSP is still set
  - keep the existing /dashboard gating and /auth redirects for the session routes (ticket 13 removes them)
- Branding: src/app/opengraph-image.tsx, icon.tsx, apple-icon.tsx and manifest.ts use the AYC brand (name "Ace Your Course", short name "AYC", navy and cream). src/config.ts site.description becomes "Formula flash cards, notebooks and posters for Philippine board exams, made by board passers."
- src/app/not-found.tsx, error.tsx and global-error.tsx: AYC styling, with links to Home and Products.
- Move src/app/(marketing)/ to src/app/(website)/, and delete src/components/marketing/.
- e2e/auth-smoke.spec.ts: Home now asserts the new H1. e2e/a11y.spec.ts: remove the color-contrast exception on "/".
Leave untouched: the dashboard and auth pages and the Customers seam (ticket 13 removes them), supabase/, drizzle/, docs/mockup/ (read-only), docs/specs/ and docs/adr/.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/) and `git log --oneline -3`.
   - Stop and report if there are other uncommitted changes, or if docs/specs/2026-10-29-ayc-v1.md, docs/mockup/website/BUILD-MAP.md or docs/adr/0008–0012 are missing.
   - Otherwise run `git switch -c feat/website-01-shell main`.
2. Read:
   - AGENTS.md and CONTEXT.md
   - in the spec: "Architecture and cross-cutting", "Phase 1: Website" (Implementation Decisions) and "Testing Decisions"
   - ADRs 0003, 0007, 0008 and 0009
   - BUILD-MAP §1–2
   - docs/mockup/website/SiteNav.dc.html and SiteFooter.dc.html (markup and CSS)
   - docs/mockup/aycData.js
   - src/services/customers*.ts, as the seam and test pattern
3. Use the skills: test-driven-development (red, then green, then refactor, for every behaviour below), plus nextjs-app-router, tailwind-v4, shadcn-ui, posthog, testing-unit, testing-e2e and coding-standards.
4. TDD the pure helpers: money, manila-time, session-routes and analytics events.
5. TDD the seam: the schema and validateCatalogueSeed, the seed, the mock and the selector.
6. Theme, fonts and light-only. Then the shell components, wired into the (website) layout. The Exams menu:
   - opens on click and on keyboard (Enter or Space), closes on Esc or an outside click, and sets aria-expanded
   - nav links set aria-current="page"
   - use the installed shadcn primitives, or add one with `pnpm dlx shadcn@latest add <name>`
7. The announcement bar:
   - rotates every 4.5 s
   - pauses on hover and focus-within
   - doesn't rotate under prefers-reduced-motion
   - is server-rendered, then hides after mount if dismissed
   - stores the dismissed announcement id in localStorage under "ayc.announcement.dismissed", with every storage access in try/catch
   - has a dismiss button with an accessible name
   - drops messages with requiresMemberApp when the switch is off
8. Analytics, then middleware. For the middleware test, use `// @vitest-environment node`, mock @/lib/supabase/middleware, stub the Supabase env vars and call vi.resetModules() before importing.
9. Branding, metadata, the 404 and error pages, the placeholder Home, and the e2e updates.
10. Verify (below). Run requesting-code-review on your diff and fix in-scope findings. Report.

ACCEPTANCE CRITERIA
Happy paths:
- "/" shows the announcement bar, the nav (logo to Home; an Exams menu listing CE, ME, EE, MT and CPA with code, name and board, each linking to /exams/{code}; Products, Reviews, About and FAQ links), the placeholder H1, and the footer, in AYC fonts and colours.
- At 390 px wide, the burger opens a drawer with the Exam grid, the four links, and a "Printed copies" row with Shopee, Lazada and TikTok shop links (new tab).
- The footer has:
  - the headline and "Where to buy" with the three Marketplace shop links
  - an EXAMS column from the seam
  - a SHOP column: All products to /products, Reviews to /reviews, "Spot a fake copy" to /#authenticity
  - COMPANY: About, FAQ, Privacy Policy, Terms of Use
  - FOLLOW: TikTok, Facebook, Instagram, and "Shopee · 3.7K followers"
  - the bottom line: "© {Manila year} AceYourCourse · Registered with IPOPHIL…" and "★ 4.8 · 874 ratings · as of Oct 2026 · Ships all over the Philippines"
- With MEMBER_APP_LIVE=true: "Sign in" and "Start reviewing" link to /app, the footer shows "Sign in to the app", and the app announcement message rotates in.
- listExams() returns the 5 Exams in seed order with their Subjects. getExamByCode("ce") and getExamByCode("CE") both return CE.
- Clicking a footer or drawer shop link calls posthog.capture("marketplace_click", { marketplace, page, link: "shop" }) with no product.
- PostHog initialises with memory persistence and captures without any opt-in.
- needsSession is true for "/app", "/app/library", "/admin", "/admin/x", "/auth/callback" and "/dashboard/x".
- formatPeso(120000) gives "₱1,200", formatPeso(124950) gives "₱1,249.50", and formatAsOf("2026-10-29") gives "as of Oct 2026".
Sad paths (each one needs a test):
- With the OS in dark mode (Playwright `colorScheme: "dark"`), the page background is still cream.
- With MEMBER_APP_LIVE unset or "false", "/" has no link starting with /app. A value like "yes" makes parseServerEnv throw, naming the key.
- getExamByCode("zz") and getExamByCode("") return null.
- validateCatalogueSeed rejects a duplicate Exam code, a blank Subject name, an Exam with zero Subjects, an invalid contact email, and a non-https shop link, each with an error naming the field.
- A null shop or social link hides that footer or drawer item, and renders no empty anchor.
- Announcement bar:
  - if localStorage throws on get and set, it doesn't crash and dismissing still hides it for the visit
  - a stored id equal to the current one keeps it hidden on remount
  - a different stored id shows it again
  - under reduced motion, no rotation happens (fake timers)
  - hovering pauses rotation
- needsSession is false for "/", "/products", "/application", "/administrator", "/apple-icon" and "/authors".
- trackMarketplaceClick neither throws nor captures when PostHog isn't loaded.
- The middleware does not create a Supabase client for "/" or "/products/x", and does for "/app". The "/" response still carries the Content-Security-Policy header (unit and e2e).

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage` (CI enforces the thresholds in vitest.config.ts)
- `pnpm test:e2e` (run `pnpm exec playwright install chromium` first if the browsers are missing)
All must pass. Follow verification-before-completion: never claim done without this output.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/website-01-shell for review. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/.
- Never add generateStaticParams, `export const dynamic = "force-static"`, `export const revalidate` or ISR, and never weaken the CSP (no 'unsafe-inline' scripts).
- Pages and components read data only through @/services/catalogue, and never import the seed. Every route comes from src/paths.ts.
- Light-only: add no dark: utilities and no theme switching.
- Every Member App button, link or app-promising message renders only when memberAppLive is true.
- No new dependencies, except removing next-themes and adding shadcn primitives through the shadcn CLI. If you think another is needed, stop and ask.
- Out-of-scope bugs go in the report, not into fixes.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion marked ✅ or ❌, with the test or spec that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. copy or data needing client review, any deviations, and follow-ups for later tickets
6. the line "Nothing committed or pushed."
```
