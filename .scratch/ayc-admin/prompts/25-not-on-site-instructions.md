# Executer prompt — 25 Say how to put an Exam on the Website

Ticket: `.scratch/ayc-admin/issues/25-not-on-site-instructions.md` · Blocked by: none (23 done) · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
When an Exam is NOT ON SITE, the note above the Exam chips in the Admin's Pages & promo → Exam pages tells Staff exactly what to do, with a link to that Exam's Products.
- Products all hidden: "EE isn't on the Website yet. To show it, turn on Show on website for one of its 3 Products." then the link "Open EE's Products →".
- No Products: "EE isn't on the Website yet. Add a Product for EE, then turn on Show on website." then the link "Add a Product →".

CONTEXT
- Why: Staff saw "NOT ON SITE" on EE and MT and couldn't tell how to switch it off. It isn't a switch on the Exam. An Exam is on the Website once one of its Products has showOnWebsite on, Live or Coming Soon (listExams in src/services/catalogue.rules.ts: visible(products) filters on p.showOnWebsite).
- The note today: src/components/admin/exam-pages/exam-pages-columns.tsx, around line 181: `{onWebsite ? null : (<p ...>{exam.code} isn't on the Website yet. It shows once one of its Products is on the Website.</p>)}`. "Show on website" is in bold (a <strong>) in the new text.
- The count: the Header editor's delete note already says "3 Products belong to EE. Move or delete them first." (ticket 23), so the screen already reads how many Products belong to an Exam. Find that source (the exam page view in src/lib/admin/exam-pages-view.ts, or ticket 23's exam-manage code) and reuse it. Don't add a second read if one is already loaded.
- The link: productListHref({ exam }) in src/lib/admin/product-list.ts builds the Products list URL and lowercases the Exam (`/admin/products?exam=ee`). parseProductListParams already reads `exam`. Use them. Don't add a new filter. Open it in the same tab (an internal link, next/link or the same element the Admin uses for internal links).
- For "Add a Product →": if the Products screen already has an add form reachable by URL with the Exam preselected, link to it. Otherwise link to the filtered list. Say which in your report.
- Plurals: "1 Product", "2 Products". Keep wording in one place, the way the Admin keeps its other copy.
- Editors and Owners both see the note, as today.

SCOPE
Modify:
- src/components/admin/exam-pages/exam-pages-columns.tsx and its test
- the exam page view (src/lib/admin/exam-pages-view.ts or wherever the opened Exam's data is assembled) and its test, only if the count isn't already passed down
- the e2e spec for the Exam pages screen (extend the existing one)
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env, the catalogue rules, the Website, migrations, src/lib/db/schema.ts.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/). Stop and report if there are uncommitted changes other than .scratch/, the spec, and ticket 24's.
   - Stay on docs/ayc-v1-planning (`git switch docs/ayc-v1-planning`). If it's behind main, run `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a new branch.
2. Read AGENTS.md, CONTEXT.md (Exam, Product), .scratch/ayc-admin/CONVENTIONS.md, the ticket (every checkbox is part of your acceptance criteria), and the files in CONTEXT.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure wording: a function from (exam code, number of Products) to the sentence and the link label, covering 0, 1 and 3.
5. TDD the component: the note and link for each case, no note when on the Website, and the fallback.
6. Extend the e2e on the sample data: open an Exam whose Products are all hidden (hide them in the test first if the sample data has none), read the note, follow the link, and see the Products list filtered to that Exam. Then turn on Show on website for one, return to Exam pages, and see the note and the NOT ON SITE label gone.
7. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- EE with 3 hidden Products: the note reads "EE isn't on the Website yet. To show it, turn on Show on website for one of its 3 Products." and "Open EE's Products →" goes to /admin/products?exam=ee, which lists EE's Products.
- A new Exam with no Products: the note reads "… Add a Product for <CODE>, then turn on Show on website." with "Add a Product →".
- After one EE Product is shown, the Exam pages screen shows no note and no NOT ON SITE for EE.
Sad paths (each one needs a test):
- One hidden Product shows "1 Product", never "1 Products".
- An Exam whose only shown Product is Coming Soon is on the Website: no note.
- A Live Product that's hidden doesn't count: the note still shows.
- If the count can't be read, the note falls back to today's text and the page still renders.
- The link's Exam code is lowercase and URL-encoded.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked as the e2e server has them.
- `pnpm test:coverage` (the thresholds must still pass; don't lower them)
- `pnpm test:e2e` (the Website and Admin projects, on the in-memory sample data)
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers (:3000, and possibly :3001) run in LIVE mode against the hosted project. Never run Playwright e2e against them, never kill them, and never run `pnpm build` in the working tree while they run. Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` before a full run, verify your own diff, and report the shared-tree results separately.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on docs/ayc-v1-planning, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project, and never change its data.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency. Otherwise stop and ask.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo.
- Every Admin page still calls the Staff Guard. Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. where the count comes from, where "Add a Product →" links and why, and follow-ups
6. the line "Nothing committed or pushed."
```
