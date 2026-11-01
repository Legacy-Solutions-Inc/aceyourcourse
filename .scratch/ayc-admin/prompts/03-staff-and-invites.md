# Executer prompt — 03 Staff and Invites

Ticket: `.scratch/ayc-admin/issues/03-staff-and-invites.md` · Blocked by: 02 · Branch: `docs/ayc-v1-planning` (shared by every ticket; no new branch)

Paste everything inside the block into a fresh executer session.

```text
You are a senior Next.js and TypeScript engineer working as the EXECUTER in the Ace Your Course repo. You have no memory of the planning conversation. This prompt is your complete brief. Follow it exactly, work test-first, and stop to ask whenever the brief, the spec, the mockup or the code doesn't settle a decision.

GOAL
An Owner manages who can use the Admin, in the Admin accounts part of Settings:
- the Staff list
- invite by Google email and Staff Role
- "Copy invite message" (no email is sent)
- Renew and Cancel invite
- change role, and remove

The rules:
- The last Owner can't be removed or demoted.
- Nobody can remove or demote themselves.
- An email that is already Staff or already invited is refused.
- Removal takes effect on the removed person's next request.

CONTEXT
- Already on docs/ayc-v1-planning:
  - the staff part of the sample store, with resolveSignIn and Invite activation (ticket 01)
  - adminAction, the save-state line, the conflict notice and the toast (ticket 02)
  - the Settings screen, which already has the contact email, links and trust figures
- The CONTEXT.md glossary defines an Invite: one Google email and a Staff Role. It becomes active on the first sign-in with that verified email. It expires 7 days after it was made or last renewed. The Invite itself is the permission; the Admin address isn't secret.
- The mockup:
  - BUILD-MAP §3.11, ADMIN ACCOUNTS (lines 678–702 and 1637–1643)
  - the modals in §2: addAdmin (926–941), removeAdmin and cancelInvite
- Copy overrides (CONVENTIONS §4):
  - "Send invite" → "Add invite"
  - "Invite sent" → "Invited"
  - drop "They get an email with a link"
  - "Resend" → "Renew"
  - cancelInvite's "The link in their email stops working." → "They can't use it to sign in."
  - removeAdmin's "…right away and is signed out" → "…loses access right away"
- The copy-invite message is exactly this text, with the Staff Role, URL, email and date filled in:
  "Hi! You've been added to the Ace Your Course Admin as an {Editor|Owner}. Open {site URL}/admin, choose “Continue with Google” and sign in as {email}. Please sign in by {Fri, 7 Nov 2026}, when the invite expires."
  - Use config.site.url for the site URL.
  - Use the clipboard API. If it's unavailable or refused, show the text in a read-only field, selected, with "Copy it from here".
- "LAST SIGNED IN 2 DAYS AGO": the sign-in time is recorded on every successful sign-in. Update the sample arm if ticket 01 didn't.

SCOPE
Create:
- Staff area writes in src/services/mock/admin/staff.ts:
  - listStaff(actor)
  - inviteStaff(actor, { email, role })
  - renewInvite(actor, email)
  - cancelInvite(actor, email)
  - changeStaffRole(actor, { email, role })
  - removeStaff(actor, email)

  All of them are Owner-only, and each appends Staff Activity and returns no catalogue tags.
- Their zod schemas.
- src/lib/admin/copy-invite.ts, plus a test.
- The Admin accounts part of the Settings screen, the add modal and the confirm dialogs.
- Their Server Actions in settings/actions.ts.
- Tests in src/services/admin.staff.test.ts, and e2e in e2e/admin/staff.spec.ts.

Modify: the Settings screen, and the staff seam types.

Leave untouched: the Guard's sign-in flow, except recording the last sign-in.

APPROACH
1. Pre-flight.
   - Run `git status` (ignore an untracked .scratch/).
   - Stop and report if there are other uncommitted changes, or if ticket 02 (adminAction, save-state, the Settings screen, the reset route) is missing on docs/ayc-v1-planning.
   - Otherwise stay on docs/ayc-v1-planning (run `git switch docs/ayc-v1-planning` if you are not on it). Do NOT create a new branch.
2. Read:
   - AGENTS.md and CONTEXT.md
   - .scratch/ayc-admin/CONVENTIONS.md: the shared names, modules and rules for every Phase 2 ticket. Use them exactly.
   - the ticket, .scratch/ayc-admin/issues/03-staff-and-invites.md: every checkbox in it is part of your acceptance criteria
   - docs/specs/2026-10-29-ayc-v1.md: Phase 2 stories 54–58; Phase 2 decisions (Invites, Staff access, Staff Role permissions, Staff Activity)
   - CONTEXT.md (People and access: Staff, Invite, Staff Role, Staff Activity)
   - docs/mockup/admin/BUILD-MAP.md §3.11 (ADMIN ACCOUNTS) and §2 (addAdmin, removeAdmin, cancelInvite)
3. Skills: test-driven-development, testing-unit, testing-e2e, nextjs-app-router, coding-standards, verification-before-completion, requesting-code-review, forms-validation, shadcn-ui, secure-code-guardian.
4. TDD the staff area writes through the seam. Cover every rule and edge (see the sad paths) before building any UI.
5. TDD copy-invite: the text, the Staff Role wording, and the date formatted in Manila time.
6. Build the list, the modal and the dialogs from the mockup. Every state shows its own row: You, Owner, Editor, Invited, Expired.
7. Write the e2e:
   - invite → copy the message → sign in as that email → active
   - renew
   - cancel → 403
   - change role
   - remove while the removed User is signed in in a second context → their next request is denied
8. Verify, then run requesting-code-review on your diff and fix the in-scope findings. Then report.

ACCEPTANCE CRITERIA
Happy paths:
- The Owner invites new.editor@example.com as an Editor. The row shows "INVITED · EXPIRES IN 7 DAYS · RENEW", and "Copy invite message" copies the exact text, naming that email and the date 7 days ahead.
- Signing in as new.editor@example.com activates the Invite. The row becomes EDITOR with "LAST SIGNED IN …".
- Renew on an expired Invite shows "EXPIRES IN 7 DAYS", and signing in then works.
- Changing the Editor to Owner makes Settings appear in their menu on their next request. Changing them back hides it.
- Removing content@aceyourcourse.ph, after the confirmation with the adjusted copy, removes the row. That User is denied on their next request. Their earlier Staff Activity stays.
- Every one of these appends exactly one Staff Activity record, with the before and after values.
Sad paths (each one needs a test):
- Inviting "bad" or an empty email gets a field error.
- Inviting angel@aceyourcourse.ph (already Staff) or KIM.REYES@gmail.com (already invited, compared case-insensitively) gets "This email is already on the staff list."
- Removing or demoting the only Owner gets "There must always be at least one Owner." Add a second Owner, and the first can then be demoted, but not by themselves.
- The Owner removing or demoting themselves gets "You can't remove or change your own access." Their own row has no Remove control.
- An Editor calling any Staff action directly gets forbidden, and nothing changes.
- Renewing or cancelling an Invite that was already cancelled gets not-found and a message, and the list refreshes.
- When the clipboard is refused, the fallback field shows the message text.
- A cancelled Invite's email signs in to the 403 screen with the not-staff copy.

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
