# Executer prompt — 10 Home promo banner and announcement bar

Ticket: `.scratch/ayc-admin/issues/10-promo-banner-and-announcement.md` · Blocked by: 09 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
Under Exam pages & promo, Editors manage two strips.

The Home promo banner:
- text, button label and link
- start and end dates, and an on or off switch
- it shows only within its dates and turns itself off after the end date
- a status line, and "Turn off banner now" with a confirmation

The announcement bar:
- 1–3 messages, each with text, a link and "Only while the Member App is live"
- reordered with ▲▼
- changing the messages shows the bar again to Visitors who dismissed it

CONTEXT
- Already on docs/ayc-v1-planning:
  - the Exam pages & promo screen, whose PAGES column lists Home promo banner and Announcement bar with empty editors (ticket 09)
  - the save path (ticket 02)
- The data (WebsiteSettings in catalogue.types.ts):
  - promoBanner: { visible, text, buttonLabel, href, startDate, endDate } | null. The dates are ISO, and the banner runs from the start of the Manila start day to the end of the Manila end day.
  - announcement: { id, messages: { text, href, requiresMemberApp }[] }. Changing id re-shows the bar to Visitors who dismissed it; the dismissal is remembered in the browser.
  - The Website already decides when the banner shows with isPromoActive(banner, now) in src/lib/catalogue/promo.ts. Reuse it for the Admin status line. Never write a second rule.
  - The Website components: src/components/website/home/promo-strip.tsx and src/components/website/announcement-bar.tsx.
- The status line wording:
  - "ON · SHOWS 9–11 NOV" while visible and within the dates
  - "SCHEDULED · STARTS 9 NOV" while visible and before the start
  - "ENDED · TURNED OFF BY ITSELF 11 NOV" while visible and after the end
  - "OFF" while not visible
- Announcement id: generate a new id (for example ann-<ISO timestamp>) only when the messages actually change. A save with no change keeps the id.
- Limits: banner text at most 80 characters, button label at most 24, message text at most 70. Links must be https URLs or site paths starting with /.
- The mockup:
  - BUILD-MAP §3.2, Home promo banner (lines 969–973)
  - §2 unpublish: "Turn off the 11.11 sale banner now? It disappears from Home right away instead of on 11 Nov."
  - The announcement editor isn't in the mockup. Build it in the same field style.

SCOPE
Create:
- The promo area in src/services/mock/admin/promo.ts:
  - getPromoForAdmin
  - updatePromoBanner(…, expected)
  - setPromoBannerVisible(actor, visible): a toggle, also used by "Turn off banner now"
  - getAnnouncementForAdmin
  - updateAnnouncement(…, expected)
- The schemas.
- src/services/admin.promo.test.ts.
- The two editors in src/components/admin/exam-pages/.
- The Server Actions.
- e2e/admin/promo.spec.ts.

Modify: the Exam pages & promo screen (the PAGES column wiring).

Leave untouched: isPromoActive's rule, and the Website components, except where they need the edited data.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 09 (the Exam pages & promo screen with its PAGES column) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/10-promo-banner-and-announcement.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 story 76; Phase 2 decisions (Exam pages & promo: banner, announcement bar; Staff Role permissions)
   - docs/mockup/admin/BUILD-MAP.md §3.2 (Home promo banner) and §2 (unpublish)
   - src/lib/catalogue/promo.ts and its test, src/components/website/home/promo-strip.tsx and src/components/website/announcement-bar.tsx
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, forms-validation, shadcn-ui.
4. TDD a pure status-line helper on top of isPromoActive. Cover Manila midnight: 23:59 on the day before the start, 00:00 on the start day, 23:59 on the end day, and 00:00 on the day after.
5. TDD the promo area:
   - validation
   - toggles
   - announcement id regeneration (changed vs unchanged)
   - reordering
   - 1–3 messages
   - the conflict check
   - Staff Activity
   - tags
6. Build both editors from the mockup's style, plus the unpublish confirmation.
7. Write the e2e:
   - set the banner on with today's dates, and see it on Home
   - Turn off banner now, and see it gone
   - a Visitor dismisses the announcement bar, an Editor edits a message, and on reload the bar shows again
8. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- Turning the banner on with dates around today shows "ON · SHOWS …", and Home shows the strip with the text, button and link.
- Dates in the future show "SCHEDULED · STARTS …", and Home shows no strip until the start day.
- "Turn off banner now" opens the confirmation. Confirming shows "OFF", and Home no longer shows the strip.
- Editing the second announcement message and saving changes the bar's text on every page, and a Visitor who had dismissed the bar sees it again.
- ▲▼ reorders the messages, "+ Add message" adds a third, and Remove takes it back down. The Website follows the new order.
- An Editor (not only an Owner) can save both editors.
Sad paths (each one needs a test):
- An end date before the start date gets "The end date can't be before the start date." An invalid date is refused.
- Banner text of 81 characters, a button label of 25, message text of 71, and a link of "javascript:alert(1)" or "http://x" are each refused.
- Removing the last message is blocked: the bar needs 1–3 messages. A fourth message is refused by the server.
- Saving the announcement with no change keeps its id, so dismissed bars stay dismissed.
- On the day after the end date, Home shows no strip and the status says ENDED, with no write needed.
- A stale save gets the conflict message. A signed-out action is refused.

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
