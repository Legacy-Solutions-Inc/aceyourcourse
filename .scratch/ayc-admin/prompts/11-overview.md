# Executer prompt — 11 Overview

Ticket: `.scratch/ayc-admin/issues/11-overview.md` · Blocked by: 05, 10 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
The Overview tells Staff what needs them today.
- The greeting and date, with "N things need you today."
- A Needs attention list. Each item links to the screen that fixes it.
- Quick actions: + Add product, + Add Review and + Add FAQ, each opening a new form.

CONTEXT
- Already on docs/ayc-v1-planning:
  - every Website editor (tickets 02–10)
  - the greeting from ticket 01
  - seo-check from ticket 09
  - the products list's missing-links logic from ticket 04
- The items, in this order, are computed by one pure function, src/lib/admin/needs-attention.ts: needsAttention({ products, settings, examPages, exams, now, role }). Reuse the existing helpers; never rewrite their rules.
  - Missing product links: Live Products with a Marketplace in the "shop" state. "N product links use the shop page" → Add links (/admin/products?missing=1).
  - The promo banner:
    - off: "Promo banner is off: Turn it on in Exam pages & promo when the next sale starts." → Open (?page=promo)
    - on and ending within 3 days (Manila): "Promo banner ends {date}" → Open
  - Exam pages whose seo-check isn't GOOD: "N exam pages need search fixes" → Fix (the first such Exam's SEO).
  - Products with Show on website off: "N products are hidden from the website" → Review (the Products list).
  - Trust figures (shopStats.asOf) more than 30 days old: "Trust figures are N days old" → Update (Settings). Owners only.
- The mockup: BUILD-MAP §3.1 (lines 704–750).
  - Keep the greeting, the quick actions and the Needs attention style.
  - Drop the KPI tiles, the chart, Recent orders, Active members, Plans ending and Top-selling content. Those come in Phase 4 and Phase 3.
  - The mockup's quick actions only navigate. Ours open the new form.

SCOPE
Create:
- src/lib/admin/needs-attention.ts, plus a test.
- The overview area read getOverview(actor), which gathers the inputs.
- The Overview components in src/components/admin/overview/.
- e2e/admin/overview.spec.ts.

Modify:
- src/app/admin/(shell)/page.tsx
- the Products list, so it honours ?missing=1 if it doesn't already
- the Reviews screen, so it honours ?review=new and ?tab=faqs&faq=new if those don't already open the new forms

Leave untouched: the other screens' rules.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if tickets 05 (the Product editor) and 10 (the promo editors) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/11-overview.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 story 61; Phase 2 decisions (Overview, Menu)
   - docs/mockup/admin/BUILD-MAP.md §3.1
   - src/lib/admin/seo-check.ts, the products list's link-status code, and src/lib/catalogue/promo.ts
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, shadcn-ui.
4. TDD needsAttention:
   - every item and its count
   - the boundaries: the banner ending in exactly 3 days (shown) and in 4 (not shown); trust figures exactly 30 days old (not shown) and 31 (shown)
   - Coming Soon never counting as a missing link
   - the Editor never getting the trust-figures item
   - zero items
5. Build the Overview from the mockup: the greeting, the date, the count line, the Needs attention rows and the quick actions. When nothing needs attention: "Nothing needs you today."
6. Write the e2e: the Overview lists the missing-links item. Add the missing Lazada Listing, and the count drops on the next load. Each quick action opens its new form.
7. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- On the seed data, the Owner's Overview shows the items that apply, with their counts and links, under "N things need you today."
- "Add links" opens /admin/products with Missing product links on. Fixing a Listing lowers the count.
- "+ Add product", "+ Add Review" and "+ Add FAQ" each open their new form.
- With every item fixed, the Overview says "Nothing needs you today."
Sad paths (each one needs a test):
- The Editor never sees the trust-figures item, even when the figures are 90 days old.
- A banner ending in 4 days isn't listed, and one ending in 3 days is. Trust figures exactly 30 days old aren't listed, and 31 days old are.
- A Coming Soon Product with no Listings never counts as missing links.
- A Phase 4 widget (Paid today, KPI tiles, chart, orders) is absent. Assert on the page.
- A signed-out visit redirects to sign-in.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage` (the thresholds in vitest.config.ts must still pass; don't lower them)
- `pnpm test:e2e` (the Website and admin projects)
All must pass. Follow verification-before-completion.
Repo gotchas:
- `pnpm build` breaks a dev server running on :3000. If :3000 answers 200, run e2e against it (PLAYWRIGHT_PORT=3000), and run the build in a scratchpad copy: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in (Turbopack refuses a symlinked node_modules).
- Never kill the user's server.
- Another executer may share the working tree. Verify your own diff, and report the shared-tree results separately.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch or switch away from it. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Don't edit docs/mockup/, docs/specs/ or docs/adr/. Don't edit CONTEXT.md unless this prompt says so.
- Use the names in .scratch/ayc-admin/CONVENTIONS.md. If the code already differs (an earlier ticket chose otherwise), follow the code and say so in your report.
- Add no dependency unless this prompt names it. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo beyond the mockup samples in CONVENTIONS §5.
- Every Admin page and Server Action calls the Staff Guard. Authorisation never comes from the client, from hidden fields, or from user metadata.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. mockup deviations (with the BUILD-MAP or mockup line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
