# Executer prompt — 02 Settings, and the shared save path

Ticket: `.scratch/ayc-admin/issues/02-settings-and-save-path.md` · Blocked by: 01 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
An Owner edits, in Settings:
- the Website's contact email
- the Marketplace shop links
- the social links
- the shop-wide trust figures

Each save goes live on the Website at once: the footer, the store buttons and the trust line all update.

This ticket also builds the save path every later editor reuses:
- the editable sample store, with Reset
- the Catalogue mock arm reading that store
- the Website reads cached with tags
- the Admin seam's write contract: validation, the conflict check, Staff Activity, and the cache tags to clear
- adminAction
- the save-state line, the conflict notice and the "Couldn't save" toast

Build these shared pieces carefully. Tickets 03–10 copy them.

CONTEXT
- Already on docs/ayc-v1-planning (ticket 01):
  - the Admin mode, the Staff Guard and the sample identity
  - the staff part of the sample store
  - the Admin seam's contract types
  - the shell, with a Settings screen that calls requireOwner and has an empty body
- The Catalogue seam reads the static seed today.
  - catalogue.mock.ts validates CATALOGUE_SEED once at load, then reads it.
  - The Website settings type (shopLinks, socialLinks, contactEmail, shopStats, announcement, promoBanner, memberAppLive) is in src/services/catalogue.types.ts.
  - memberAppLive comes from MEMBER_APP_LIVE, not from the seed. It isn't editable.
- Who reads the settings on the Website: site-footer.tsx, store-button.tsx, marketplace-link.tsx, site-links.ts, and the Home, About and Products trust lines (src/lib/catalogue/figures.ts, about-stats.ts). Grep for getWebsiteSettings.
- Caching (spec Phase 1 → Rendering and caching):
  - Every page is dynamic, because of the nonce CSP.
  - Speed comes from caching the seam's reads with tags (CONVENTIONS §3): unstable_cache from next/cache in the selector, with the tags in src/services/catalogue.tags.ts.
  - In sample mode, the store generation goes into the key parts.
  - In Vitest, mock next/cache in vitest.setup.ts: unstable_cache passes through, and revalidateTag and revalidatePath are spies.
- Vitest gotchas:
  - src/services/catalogue.test.ts uses seamWith(), which edits the seed through vi.doMock("@/services/mock/catalogue") plus vi.resetModules().
  - A store on globalThis survives resetModules. So give the store a resetSampleStore(seed) API, and change seamWith to use it.
  - Keep every existing assertion.
- The conflict check is in CONVENTIONS §3 and the spec (Phase 2, Conflict check):
  - Every editor holds the record's savedAt when it opens.
  - The seam compares it.
  - A conflict returns { kind: "conflict", savedBy, savedAt }, and the form keeps its values.
- The mockup: BUILD-MAP §3.11, lines 678–702 and 1531–1542. The toast: §2 saveFailed, lines 943–949.
  - The mockup's support email becomes the Website's contact email.
  - The "Send test email" and DEFAULT SUBJECT LINE are dropped.
  - Add Facebook and Instagram fields next to the TikTok profile, because the Website shows all three.
  - The trust figures part isn't in the mockup. Build it in the same style: RATING, NO. OF RATINGS, FOLLOWERS, and an "AS OF {date}" line.

SCOPE
Create:
- src/services/catalogue.tags.ts.
- The settings area of the Admin seam: src/services/mock/admin/settings.ts, with getSettingsForAdmin() (values, stamp, last changed by) and updateWebsiteSettings(actor, input, expected).
- Zod schemas in src/services/admin.schema.ts. Reuse the URL and domain rules from src/services/catalogue.schema.ts.
- src/services/admin.settings.test.ts.
- src/lib/admin/action.ts (adminAction) and its test.
- src/components/admin/save-state.tsx, the conflict notice, and the "Couldn't save" toast built on sonner.
- src/app/admin/(shell)/settings/actions.ts, and the Settings screen's form parts.
- src/app/api/dev/sample-data/reset/route.ts: POST, sample mode only, otherwise 404.
- The header's Reset button: a Server Action that any Staff User may use, in sample mode only.
- e2e/admin/settings.spec.ts.

Modify:
- src/services/mock/sample-store.ts: add the catalogue, record stamps and resetSampleStore(seed?).
- src/services/catalogue.mock.ts: read from the store.
- src/services/catalogue.ts: wrap the reads with unstable_cache and tags.
- vitest.setup.ts: the next/cache mock.
- src/services/catalogue.test.ts: seamWith via resetSampleStore.
- e2e/admin/helpers.ts: make resetSampleData real.

Leave untouched: the Catalogue seam's public contract and its return shapes, and the Website components, except where a component reads a settings value that becomes editable.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 01 (src/lib/admin/guard.ts, src/services/admin.ts, src/services/mock/sample-store.ts, the /admin shell) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/02-settings-and-save-path.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 1 → Rendering and caching; Phase 2 stories 78–80; Phase 2 decisions (Seams, Settings, Live on save, Conflict check, Staff Activity)
   - docs/mockup/admin/BUILD-MAP.md §3.11 and §2 (saveFailed)
   - src/services/catalogue.ts, catalogue.mock.ts, catalogue.schema.ts, catalogue.types.ts, mock/catalogue.ts and catalogue.test.ts
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, forms-validation, shadcn-ui, tailwind-v4.
4. Move the catalogue into the sample store, and point the mock arm at it. Run the whole existing suite: it must stay green before you go on.
5. Add the tags and the unstable_cache wrapping in the selector, with the next/cache mock. Prove the tagging with a test that checks which tags each read uses.
6. TDD the Admin seam's write path through updateWebsiteSettings:
   - validation errors per field
   - the conflict check
   - the Editor refused
   - a Staff Activity record with the before and after values
   - the stamp updated
   - tags returned [catalogue:settings]
   - a write that would make the catalogue invalid leaving the store unchanged
7. TDD adminAction: the Guard runs before zod, revalidateTag is called with exactly the returned tags, and the result is serialisable.
8. Build the Settings screen from the mockup, with useActionState and the save-state line, then the conflict notice and the toast. Then the Reset button and the reset route.
9. Write the e2e: an Owner edits the contact email, and the Website footer shows it. A conflict, using two browser contexts. Reset. An Editor refused.
10. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- The Owner changes the contact email and saves. The line shows "✓ SAVED · EVERY STORE BUTTON UPDATED" (contact-only saves may say "✓ SAVED · LIVE ON THE SITE"), and the Website footer and FAQ page show the new email on the next load.
- Changing the Lazada shop link updates every Lazada store button that has no Listing of its own. Clearing it hides those buttons. Clearing the Instagram link hides it in the footer.
- Saving the trust figures (4.9, 900, 3.8K) sets "AS OF" to today in Manila time, and the Website's trust lines show them.
- "LAST CHANGED {date} BY ANGEL ROSE L. LEPAÑA" updates after a save.
- The save states move through Up to date → Unsaved changes → Saving → Saved · live.
- Reset, from the header button or from POST /api/dev/sample-data/reset, restores the seed, and the Website shows the original values.
- Every existing Phase 1 Vitest and e2e test still passes.
Sad paths (each one needs a test):
- "not-an-email" gets "ENTER A VALID EMAIL ADDRESS", the form keeps its values, and the store is unchanged.
- A Shopee link on lazada.com.ph gets "SHOULD BE A SHOPEE.PH LINK". A TikTok profile without /@name gets "SHOULD LOOK LIKE TIKTOK.COM/@NAME".
- A rating of 5.1, a rating of 4.85, ratings of -1 or 1.5, and empty followers are each refused with a field message.
- Conflict: two Owner sessions open Settings, and A saves. B's save then gets "Angel Rose L. Lepaña saved these settings at {time}. Copy your changes, then reload to see theirs.", and B's values stay in the form.
- A seam failure (forced in a test) shows the "Couldn't save" toast. Try again resubmits the same values.
- The Editor calling the Settings action directly gets forbidden. Nothing changes, and no Staff Activity is added.
- POST /api/dev/sample-data/reset answers 404 when the mode is closed.
- After a dev server restart, the Website shows the seed values, not the cached edits.

VERIFICATION
Run, and show the last lines of each:
- `pnpm lint && pnpm type:check && pnpm test && pnpm build`
- `pnpm test:coverage` (the thresholds in vitest.config.ts must still pass; don't lower them)
- `pnpm test:e2e` (the Website and admin projects)
- Show that `pnpm test` passes with the unchanged Phase 1 Catalogue assertions (name the suite and its count).
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
- Don't change what any Catalogue seam function returns. Only the source (the store) and the caching change.
- No "use cache" directive and no experimental Next.js flags.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion (this prompt's and the ticket's checkboxes) marked ✅ or ❌, with the test that proves it
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. mockup deviations (with the BUILD-MAP or mockup line), decisions you had to make, and follow-ups
6. the line "Nothing committed or pushed."
```
