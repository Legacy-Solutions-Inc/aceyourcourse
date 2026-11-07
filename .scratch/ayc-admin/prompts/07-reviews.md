# Executer prompt — 07 Reviews

Ticket: `.scratch/ayc-admin/issues/07-reviews.md` · Blocked by: 02 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Editors curate Reviews under Reviews & FAQs → REVIEWS.

The list:
- search, Exam chips, star chips and "Pinned on Home only"
- the counters "N REVIEWS" and "N OF 9 PINNED ON HOME", which warns above 9
- a HOME pin toggle on each row
- ▲▼ to reorder the Home order, shown when "Pinned on Home only" is on

The editor:
- stars, and the text copied word for word
- Product, an optional variation, Marketplace and helpful votes
- Pin on Home
- a live preview using the Website's Review card

Adding, editing and deleting all show on the Website. Deleting removes the FAQ quotes taken from that Review, and says how many.

CONTEXT
- Already on docs/ayc-v1-planning:
  - the save path from ticket 02
  - the Reviews & FAQs screen, with its header and an empty body (ticket 01)
- The Review type: id, productId, stars 1–5, text (line breaks kept), variation | null, helpful, marketplace, and homePin, which is a number for the Home order or null.
  - listHomeReviews returns the pinned Reviews in pin order, at most 9.
  - Reviews only show for Live Products shown on the Website.
- FAQ quotes reference a Review by id, and their text must appear in that Review word for word. This is enforced by validateCatalogueSeed, and the sample arm re-validates before committing.
  - An edit that removes quoted words would fail that check.
  - Refuse it with a clear message naming the FAQ question. Never silently drop the quote on an edit.
  - Only a delete removes quotes.
- The Website's Review card is src/components/website/review-card.tsx. Reuse it for the preview, so the preview matches the Website.
- Star filter chips: ANY ★, 5★, 4★, and "3★ and below", which maps to the existing "3-or-less" filter.
- New Review ids follow the seed's format (rev-NNN, the next free number).
- The mockup:
  - BUILD-MAP §3.4, REVIEWS tab (lines 231–278 and 1132–1170)
  - §2 deleteReview
  - docs/mockup/admin/ReviewCard.dc.html
  - The mockup's meta always says SHOPEE (BUILD-MAP §9 item 10). Ours shows the Review's real Marketplace.
- Home shows the first 9 pinned Reviews. The Website's Home review components already read listHomeReviews.

SCOPE
Create:
- The reviews area in src/services/mock/admin/reviews.ts:
  - listReviewsForAdmin(actor, filters)
  - getReviewForAdmin
  - createReview
  - updateReview(…, expected)
  - setReviewPinned(actor, id, pinned): a toggle; pinning appends to the end
  - moveReviewPin(actor, id, "up" | "down")
  - previewReviewDelete, returning { faqQuotes }
  - deleteReview
- The schemas.
- src/services/admin.reviews.test.ts.
- The REVIEWS and FAQS tabs (FAQS has an empty body until ticket 08), the list, the editor and the preview in src/components/admin/reviews/.
- The Server Actions.
- e2e/admin/reviews.spec.ts.

Modify: the Reviews & FAQs screen.

Leave untouched: the Website's Review components, except to reuse the card.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 02 (the sample store, adminAction, the save path) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/07-reviews.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 stories 70–72; Phase 2 decisions (Reviews, Deleting, Conflict check)
   - docs/mockup/admin/BUILD-MAP.md §3.4 (REVIEWS tab), §2 (deleteReview), and docs/mockup/admin/ReviewCard.dc.html
   - src/services/catalogue.schema.ts (Review and FAQ quote rules) and src/components/website/review-card.tsx
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, forms-validation, data-tables, shadcn-ui.
4. TDD the reviews area:
   - list filters and their combinations
   - create, update and delete
   - pin, unpin and reorder, with Home order boundaries (moving the first up, moving the last down)
   - the counters
   - the FAQ quote guard and cascade
   - the conflict check
   - Staff Activity
   - tags
5. Build the tabs, the list, the editor and the preview from the mockup.
6. Write the e2e:
   - add a Review and see it on its Product page and /reviews
   - pin it, and see it last on Home
   - reorder it to first, and see it first on Home
   - delete a quoted Review, and see the FAQ page lose the quote
7. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- The list shows every Review with stars, a 2-line excerpt and the meta line (the real Marketplace). Search "glossy", plus CE and 5★, narrows it, and the URL keeps the filters.
- Adding a 5★ Review for CE Formula Flash Cards on Lazada with 3 helpful votes shows it on that Product page, the CE Exam page and /reviews. The preview matched the Website card before saving.
- Turning HOME on adds the Review at the end of the Home order. With "Pinned on Home only", ▲▼ moves it, and Home shows the new order.
- With 10 pinned, the counter shows "10 OF 9 PINNED ON HOME · HOME SHOWS THE FIRST 9" in red, and Home shows the first 9.
- Deleting a Review quoted by an FAQ says "1 FAQ quote from this Review is removed." After confirming, the FAQ page shows that FAQ without the quote.
Sad paths (each one needs a test):
- Empty text gets "PASTE THE REVIEW TEXT TO SAVE".
- Stars of 0 or 6, helpful votes of -1 or 2.5, a Coming Soon or unknown Product, and a variation the Product doesn't have are each refused with a field message.
- Editing the quoted Review so the quoted words are gone is refused: "The FAQ “What are the posters like?” quotes this Review. Edit that quote first." Nothing changes.
- A stale save gets the conflict message.
- Pinning, moving or deleting a Review that was already deleted returns not-found. ▲ on the first pinned Review and ▼ on the last are disabled, and the server refuses them too.
- A signed-out call to any Review action is refused.

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
