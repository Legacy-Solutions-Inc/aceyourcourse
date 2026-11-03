# 12 — Admin-wide checks on the prototype

**What to build:** These checks prove that the whole Stage A Admin holds together before the database work starts.

- **Permissions** are enforced on the server for every action.
- **Every write** is recorded in Staff Activity.
- **Every screen** passes accessibility checks on desktop and mobile.
- **A production build** keeps the Admin closed.
- **The README** explains how to run and reset the prototype.

**Blocked by:** 03, 04, 05, 06, 07, 08, 09, 10, 11

**Status:** ready-for-agent

Spec: Phase 2 stories 59, 60, 80; Implementation Decisions → Phase 2 (Staff Role permissions, Staff Activity, Two stages); Testing Decisions → Permission and deny-all tests, Admin seam, Seam 5 (Admin). Conventions: §1, §3, §6.

- [ ] **A permission-matrix test** goes through every exported Admin Server Action and checks it is refused for each of these actors, with nothing changed:
  - signed out
  - not Staff
  - an Editor, for Owner-only actions
  - closed mode

  A new action that is missing from the matrix fails the test.

- [ ] **A Staff Activity test** checks that each Admin seam write appends exactly one record per entity changed, with the before and after values. A failed write appends none.
- [ ] **Accessibility.** Axe finds no serious or critical issues on every Admin screen and state, at 1280 px and at 375 px:
  - sign-in and 403
  - Overview
  - each Exam pages & promo view
  - the Products list and editor
  - Reviews and FAQs, with their editors
  - Settings
  - the open drawer and the open dialogs
- [ ] **Mobile.** At 375 px, no Admin screen scrolls sideways. Keyboard-only use reaches every control, and focus is visible.
- [ ] **The Admin journey e2e:**
  - an Editor changes a Product price and the Website shows it
  - an Editor is refused Settings
  - an invited email activates
  - a non-Staff User gets the 403 screen
  - Reset restores the seed

  The Website e2e suite still passes after the Admin project runs.

- [ ] **Production build.** `pnpm build` then `next start` on a free port: `/admin`, `/admin/sign-in` and `POST /api/dev/sample-data/reset` all answer 404.
- [ ] **The README's "Admin prototype" section** covers how to run it, the "Sign in as" Users, Reset, and that the data resets on restart. It also says production keeps the Admin closed until Stage B.
- [ ] **Bugs found** are fixed when they are inside Phase 2's scope. Anything else is listed in the report.
