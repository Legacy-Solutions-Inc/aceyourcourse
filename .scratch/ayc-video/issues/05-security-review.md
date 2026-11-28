# 05 — Security review

**What to build:** a written security review of the whole Platform (Website, Admin, Member App, payments and video), the "security review" item of contract Milestone 4. It's a plain report the client can read, with small issues fixed in place and bigger ones listed as follow-ups.

- **The report:** `docs/security-review.md`. For each area: what was checked, how, the result (passed, fixed, or follow-up), and for a follow-up its risk and the suggested fix. Plain language first, with technical detail under it. The date and the commit it reviewed.
- **What it checks:**
  - **Sign-in:** Google only for Members and Staff in production. The temporary password sign-in (`ADMIN_PASSWORD_SIGN_IN`) is **flagged as a follow-up, not removed** (the user decides).
  - **Database rules:** every table denies direct browser access (RLS on, no browser policies), and Members read only their own data.
  - **Access:** every protected read (decks, quizzes, Reviewer PDF pages, video playback passes, Lesson progress saves) goes through the access decision on the server. Owner-only actions are refused for Editors on the server, and Admin pages refuse non-Staff.
  - **Secrets:** all server-only, never `NEXT_PUBLIC_`, never in a client bundle or a page. The PayMongo webhook signature and the cron secret are checked.
  - **Browser protections:** security headers, cookies, and only VdoCipher's player allowed to be embedded.
  - **Uploads and inputs:** file types and sizes, and form input, checked on the server.
  - **Personal data:** where it's shown (Staff Activity, exports, Orders) and who can see it.
  - **Dependencies:** `pnpm audit`, with each high or critical finding explained.
- **Fixes:** small, clearly in-scope fixes are made in this ticket with a test each. Anything larger becomes a listed follow-up, not a change.
- **No new dependency.** No secrets, keys, connection strings or personal data in the report.

**Blocked by:** 04.

**Status:** ready-for-agent

Spec: Phase 5 → "Phase 5 planning decisions" (The security review); Architecture and cross-cutting; story 186.

- [ ] `docs/security-review.md` covers every area above, with the date and the commit reviewed.
- [ ] Each "fixed" item has a test that fails without the fix.
- [ ] The temporary password sign-in is listed as a follow-up, and still works as before.
- [ ] **Sad paths, each with a test or a recorded check:**
  - a browser key reading or writing any table is refused (the deny-all test still covers every table, including Phase 5's)
  - an Editor calling an Owner-only action is refused on the server
  - a protected read for a locked item, a replaced device or no device token is refused
  - a PayMongo webhook with a bad signature changes nothing, and a cron call without the secret is refused
  - no server-only variable name appears in the client bundle
  - an upload of the wrong type or size is refused on the server
