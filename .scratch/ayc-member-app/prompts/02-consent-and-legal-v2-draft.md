# Executer prompt — 02 Consent and the Legal v2.0 draft

Ticket: `.scratch/ayc-member-app/issues/02-consent-and-legal-v2-draft.md` · Blocked by: 01 · Branch: `feat/phase3-member-app` (shared by every Phase 3 ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js 15 and TypeScript engineer with privacy-law sensitivity (the Philippine Data Privacy Act), working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation, so this prompt is your complete brief. Follow it exactly and work test-first. Stop and ask whenever the brief, the spec or the code doesn't settle a decision.

GOAL
After first sign-in, a Member must agree to the current Terms and Privacy Policy before using the Member App. When either changes version, they're asked again. The Legal pages carry a v2.0 draft, marked "Draft, pending legal review", that adds the Member App sections.

CONTEXT
- Read first:
  - AGENTS.md and CONTEXT.md (Member, Beta Tester, Active Device, Access Pass, Free Preview).
  - The spec, docs/specs/2026-10-29-ayc-v1.md:
    - Phase 1 → "Legal" (v1.0, versioned in the repo with an effective date)
    - Phase 3 → "Consent", and "Phase 3 planning decisions (added 2026-11-17)" → "Legal for the beta", "Privacy Requests in the Admin", "Member App analytics"
    - stories 82, 83 and 133e
  - The mockup's `consent` screen: docs/mockup/member-app/BUILD-MAP.md §3 and §7.
  - The ticket: every checkbox is part of your acceptance criteria.
- What exists:
  - Ticket 01's Member App: the gate, the Member seam (getOrCreateMember), the members table, the /app layout and shell. Consent goes behind the gate in the same layout and server checks.
  - Legal content lives in src/content/legal/: terms.ts and privacy.ts, each with VERSION and EFFECTIVE_DATE, plus documents.ts, schema.ts, copy.ts and types.ts, and their tests. They're rendered at /legal/terms and /legal/privacy by src/app/(website)/legal/[doc]/page.tsx with src/components/website/legal/legal-header.tsx and legal-body.tsx.
  - The contact email comes from Settings (the Admin seam's website settings).
- Decisions for this ticket:
  - The current Terms and Privacy versions are read from the legal documents, the single source. The consent check compares the Member's latest agreement with them.
  - Make it a pure function from (current versions, latest agreement or none) to "ok" | "first-time" | "terms-changed" | "privacy-changed" | "both-changed", with tests.
  - Consent records are kept as history: Member, Terms version, Privacy version, agreed at. They're never overwritten.
  - The consent screen (mockup `consent`):
    - two required checkboxes, both unchecked to start
    - "Agree and continue" disabled until both are ticked
    - a short "what we keep and why": Google name and email, Target Exams, study progress, the Active Device and its log, and stamped Reviewer PDF pages
    - links to both documents
  - On re-consent, the heading says what changed ("We've updated our Terms", "our Privacy Policy", or both).
  - The server action takes the two version numbers the screen showed. If they aren't current, it refuses and the screen reloads with the current ones.
  - Order of checks on every /app page and Member App action: the gate, then consent. Only sign-out and the consent action itself skip consent.
  - Legal v2.0:
    - Bump both documents to 2.0 with today's effective date, keeping the existing v1.0 text as the Website sections.
    - Add the Member App sections:
      - account and Google sign-in
      - study data and progress
      - the Active Device and its device log
      - watermarking of Reviewer PDF pages with email and Member ID
      - Access Passes and Staff grants
      - Privacy Requests (a copy within 7 days; deletion within 30 days; paid access isn't refunded)
      - anonymous, cookieless analytics (no profiles)
    - Show a visible "Draft, pending legal review" notice under the legal header while a draft flag is set in the document data. Add it to the schema with a test.
    - Add a version-history line for 2.0, as v1.0 has.
    - Write in the existing plain, Taglish-free legal style.
  - The Website keeps the same routes and shows v2.0.

SCOPE
Create or modify:
- src/content/legal/ (terms.ts, privacy.ts, schema.ts or types.ts for the draft flag) and their tests
- src/components/website/legal/legal-header.tsx (the draft notice) and its test
- the pure consent check, and the consent records in the Member seam (both arms, one behaviour suite)
- src/lib/db/schema.ts (member_consents) and the generated migration
- the /app consent screen and its server action, the /app layout check, and their tests
- e2e: extend the Member App spec (first sign-in shows consent; agree continues) and the Website legal spec (draft notice, v2.0)
Don't touch: docs/mockup/, docs/specs/, docs/adr/, CONTEXT.md, .env.

APPROACH
1. Pre-flight (below).
2. Read the files in CONTEXT.
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, drizzle-data, supabase-postgres-best-practices, secure-code-guardian, coding-standards, verification-before-completion, requesting-code-review.
4. TDD the pure consent check over every case.
5. TDD the seam: record an agreement, read the latest, and keep history.
6. Add the table and migration with RLS on, and extend the deny-all test.
7. Build the screen and action, and wire the layout check. Write component tests for the disabled button and the changed-wording headings.
8. Write Legal v2.0 and the draft notice, and update the legal tests.
9. Extend the e2e. Verify, run requesting-code-review, fix the in-scope findings, and report.

ACCEPTANCE CRITERIA
Happy paths:
- A new Member past the gate sees consent first. Agreeing stores both versions and the time, then continues to where they were going.
- Bumping either version makes every Member agree again on their next visit, with wording naming what changed.
- /legal/terms and /legal/privacy show v2.0, its effective date, the Member App sections, and the "Draft, pending legal review" notice.
Sad paths (each one needs a test):
- "Agree" stays disabled with only one box ticked.
- Posting the consent action without both agreements is refused on the server.
- Posting it with an out-of-date version is refused, and the screen shows the current version.
- A Member whose last agreement has the old Privacy version only sees the Privacy wording.
- A gated person never gets a consent record, and can't post the action.
- Direct requests to /app pages or Member App actions before consent are refused, except sign-out and the consent action.
- One Member can never read or write another Member's consent records.

PRE-FLIGHT (APPROACH step 1)
- Run `git status`. The only uncommitted changes allowed are: .scratch/, CONTEXT.md, docs/specs/2026-10-29-ayc-v1.md, docs/adr/0010-access-follows-the-exam.md (the planner's docs), and the work of the earlier Phase 3 tickets named in "Blocked by". If anything else is uncommitted, stop and ask.
- `git switch feat/phase3-member-app`. If it's behind main, run `git merge --ff-only main`. If that isn't a fast-forward, stop and ask. Do NOT create a new branch.
- Check that each blocking ticket's work is present (its screens, seam functions and tables). If it's missing, stop and ask.

VERIFICATION
Run each of these and show its last lines:
- `pnpm lint && pnpm type:check && pnpm test`
- `pnpm build`, with DATABASE_URL, the NEXT_PUBLIC_SUPABASE_* variables and SUPABASE_SECRET_KEY blanked, as the e2e server has them.
- `pnpm test:coverage` (the thresholds must still pass; don't lower them).
- `pnpm test:e2e` (the Website, Admin and Member App specs, on the in-memory sample data).
- `pnpm test:db`: show that the database suites skip locally. They run in CI.
Follow verification-before-completion.
Repo gotchas:
- The user's dev servers on :3000 and :3001 run in LIVE mode against the hosted project.
  - Never run Playwright e2e against them, and never kill them.
  - Never run `pnpm build` in the working tree while they run.
  - Run the build and e2e in a scratchpad copy on a free port: rsync the tree without node_modules, .next, .git, coverage, test-results and playwright-report, then `cp -cR` node_modules back in.
- Another session may share the working tree, and parallel Vitest runs cause 5-second timeouts. Check `ps` before a full run, verify your own diff, and report the shared-tree results separately.
- Playwright silently skips the admin project when a Website spec fails. If that happens, rerun with `--project=admin --no-deps` and report both.
- Don't add throwaway probe specs to e2e/.

GUARDRAILS
- Do NOT run git commit, git push, git stash, git reset --hard or git rebase, and don't open a PR. Leave every change uncommitted on feat/phase3-member-app, and do NOT create a branch. This overrides the commit rules in CLAUDE.md, AGENTS.md and .claude/commands/handoff.md.
- Never connect to the hosted Supabase project or Vercel, and never change their data or settings. Write migration files only. The user applies them to hosted after merging.
- Don't edit docs/mockup/, docs/specs/, docs/adr/ or CONTEXT.md.
- Add no dependency, and move none from devDependencies to dependencies, without stopping to ask first.
- Never print .env, keys, passwords or connection strings, and never put a real person's email address in the repo. Use example.com addresses in tests and sample data.
- Authorisation stays on the server: the Staff Guard, the staff list, the Beta Tester list and the Member's own records decide. Never trust the client, hidden fields or user_metadata.
- Every Admin page and Admin Server Action still calls the Staff Guard. Every Member App page and Member App Server Action runs the Member App's server checks (the gate, and later tickets' consent and Active Device checks).
- Every new table has RLS on with no anon or authenticated policies (deny-all), and the deny-all database test covers it.
- Out-of-scope bugs go in the report, not in the diff.

REPORT BACK
Reply with:
1. the branch and `git status --short`
2. each acceptance criterion, from this prompt and the ticket's checkboxes, marked ✅ or ❌ with the test that proves it. Mark the database-only ones "CI only, not run here".
3. the happy-path and sad-path tests you added
4. the results of each verification command
5. the decisions you made, and follow-ups
6. each new migration filename, with the line "Apply <migration> to hosted after merging (the user does this)", or "No migration" if there is none
7. the line "Nothing committed or pushed."
```
