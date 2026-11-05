# Executer prompt — 22 Summary for AI assistants

Ticket: `.scratch/ayc-admin/issues/22-summary-for-ai-assistants.md` · Blocked by: 20 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
The Website serves /llms.txt: a Markdown summary of Ace Your Course for AI assistants, built from the catalogue on every request.
- Every "Search & AI visibility" panel lists "Summary for AI assistants: ON" under "Set up automatically", on the Exam pages and on the Site pages from ticket 20.

CONTEXT
- Why: the client contract's Milestone 2 promises "setup for search and AI visibility (SEO, GEO, and AEO)". The Website already has:
  - structured data: Organization, BreadcrumbList, Product without rating markup, and FAQPage
  - a sitemap
  - a robots file that allows every crawler
  This adds the mockup's "Summary for AI assistants" (BUILD-MAP §3.2, "SET UP AUTOMATICALLY"), which was left out until now.
- What llms.txt is: a proposed convention (llmstxt.org), not a standard. Check the current format at https://llmstxt.org before you code: an H1 with the name, a blockquote summary, then H2 sections with Markdown link lists. Follow it.
- Prior art:
  - src/app/sitemap.ts is built on every request (export const dynamic = "force-dynamic", the one route that opts in) from the Catalogue seam's reads: listExams() and listProducts(), plus listProducts({ state: "coming-soon" }).
  - src/lib/seo.ts holds the pure builders (buildSitemap, buildRobots) and STATIC_ROUTES.
  - getSiteURL() in src/lib/get-site-url.ts gives the absolute base.
  - Prices are centavos. Format them with formatPeso in src/lib/money.ts.
  - Marketplace links: each Product's listings, and the shop links in getWebsiteSettings().
  - FAQs: listFaqs(), visible ones only. Exams: listExams() (only Exams with a Product on the Website). Paths: src/paths.ts.
- The SEO panels' list is SET_UP_AUTOMATICALLY in src/components/admin/exam-pages/exam-seo-editor.tsx, plus the Site page panel from ticket 20, which may share it.
- Content rules, kept from Phase 1:
  - No Review text and no ratings.
  - Coming Soon Products have no price.
  - Hidden Products and hidden FAQs never appear.
  - Member App wording only while the Member App switch is on. Today it's off: find how the Website reads the switch, and follow it.

SCOPE
Create:
- src/app/llms.txt/route.ts, a GET route handler. It returns text/plain; charset=utf-8, and is force-dynamic like the sitemap.
- a pure builder (for example buildLlmsTxt in src/lib/seo.ts, or src/lib/llms-txt.ts) and its tests
Modify:
- the SET_UP_AUTOMATICALLY lists for Exam and Site pages, and their tests
- STATIC_ROUTES or the sitemap only if the route has to be listed (it shouldn't be in the sitemap)
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, robots (it already allows everything).

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if ticket 20's Site page panel is missing, or if there are uncommitted changes other than tickets 20–21's.
   - Stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md
   - the ticket, .scratch/ayc-admin/issues/22-summary-for-ai-assistants.md: every checkbox is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md, Phase 1 SEO and Reviews decisions and Phase 2 → "Summary for AI assistants (added 2026-11-05)", plus story 80c
   - the files in CONTEXT
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure builder on a hand-made catalogue:
   - the structure (H1, summary, one H2 per Exam, FAQ, pages and shops)
   - the escaping
   - every content rule
5. Add the route. Test that it answers with the type, calls the seam, and gives 503 on a read failure.
6. Update the "Set up automatically" lists. Add an e2e check that /llms.txt answers 200 with text/plain on the sample data, and names a seed Product.
7. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- GET /llms.txt answers 200, text/plain; charset=utf-8, starting with "# Ace Your Course".
- Each Exam on the Website has a section with:
  - a link to its Exam page
  - its Live Products, each with its price ("₱600" or "₱1,200–₱1,800") and its absolute Product page URL
  - its Marketplace Listing links
- Coming Soon Products follow, marked "Coming soon".
- The FAQ section lists every visible question with its answer.
- The pages section links the five Site pages and the official shops.
- After an Admin save of a Product's price in sample mode, /llms.txt shows the new price on the next request.
- The Exam page and Site page SEO panels show "Summary for AI assistants: ON".
Sad paths (each one needs a test):
- An Exam with no Product on the Website is absent.
- A Coming Soon Product shows "Coming soon" and no price.
- A Product with only a Shopee Listing shows only that link.
- A hidden FAQ and a Product off the Website are absent.
- A Product name with `*`, `_`, `[` or `]` is escaped, so the Markdown structure is unchanged.
- A catalogue read that throws gives 503 with "The summary isn't available right now.", and no stack trace.
- No Review text, star rating, rating count or units-sold figure appears, even when the catalogue has them.
- With the Member App switch off, no Member App wording appears.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked as the e2e server has them.
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm test:e2e` (the Website and Admin projects, on the in-memory sample data)
- Paste the first 40 lines of /llms.txt from the e2e run or a local sample-mode request.
Follow verification-before-completion.
Repo gotchas:
- `pnpm build` breaks a dev server running on :3000. If :3000 answers 200, run e2e against it only if it runs in sample mode (otherwise ask the user), and run the build in a scratchpad copy: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Never kill the user's server.
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` before a full run, verify your own diff, and report the shared-tree results separately.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project. Don't run Docker or local Supabase on this machine.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo beyond the mockup samples.
- The route only reads the Catalogue seam. It never reads Admin data, Staff, Staff Activity or anything that isn't already public on the Website.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command, and the first 40 lines of /llms.txt
5. what llmstxt.org's format required (with the link), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
