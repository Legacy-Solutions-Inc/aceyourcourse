---
name: testing-e2e
description: Use when writing or changing end-to-end / accessibility tests — Playwright specs under e2e/**, the webServer config, user-facing locators, or axe (@axe-core/playwright) a11y gates.
---

# End-to-end & a11y testing (this repo)

## 1. When to use

Writing or updating Playwright specs (`e2e/**/*.spec.ts`), the Playwright config,
or accessibility gates. For unit/component tests use **testing-unit**.

## 2. Version

- `@playwright/test` **1.61.1**, `@axe-core/playwright` **4.12.1** (from
  `package.json` / installed).

## 3. Core standards

**Test user-visible behavior with user-facing locators.** Prefer
`getByRole(..., { name })`, `getByLabel`, `getByText` over CSS/XPath — they
survive DOM changes. Use **web-first, auto-retrying assertions**
(`await expect(locator).toBeVisible()`, `expect(page).toHaveURL(...)`) instead of
manual waits/`waitForTimeout`.

**Isolate and don't test third parties.** Each test is independent; mock/stub
external services with the network API rather than hitting sites you don't own.

**Let Playwright run the app.** The `webServer` block boots the dev server and
waits for `url` before tests; `reuseExistingServer` locally, fresh on CI.

**Accessibility via axe.** `new AxeBuilder({ page }).analyze()` returns
`violations`; gate the **serious/critical** impact levels. If a known issue must
be parked, disable that ONE rule on ONLY that page with a `TODO`/comment — never
blanket-disable.

## 4. In this template

- `playwright.config.ts` — `testDir: "./e2e"`, `fullyParallel`, `chromium`
  project, `retries: 2` on CI, `trace: "on-first-retry"`, `baseURL` from
  `PLAYWRIGHT_PORT`. The **`webServer`** runs `pnpm dev` and injects **placeholder
  Supabase env** (`NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` fallbacks) so the app
  boots — and, because Supabase then reads as "configured", auth is ENFORCED
  (this is what makes the dashboard-redirect smoke test meaningful; see
  **supabase-auth**).
- `e2e/auth-smoke.spec.ts` — role-based assertions: the landing heading renders,
  and `/dashboard` redirects unauthenticated users to `/auth/sign-in`
  (`toHaveURL(/\/auth\/sign-in/)`).
- `e2e/a11y.spec.ts` — `AxeBuilder` over `/` and `/auth/sign-in`, failing on
  serious/critical; it disables `color-contrast` ONLY on `/` for a documented,
  `TODO`-flagged debt, and prints offending rule ids on failure.
- Script: `test:e2e` (`playwright test`).

## 5. Red flags

- CSS/XPath or text-fragile selectors instead of `getByRole`/`getByLabel`.
- `waitForTimeout`/manual sleeps instead of web-first assertions.
- Navigating to or asserting against third-party sites.
- Blanket-disabling axe rules instead of one rule, one page, with a `TODO`.
- Depending on a real Supabase (or shared state between tests) — use the
  placeholder-env `webServer` pattern and keep tests isolated.
- Committing `test-results/`/traces or leaving `test.only` (fails CI via
  `forbidOnly`).

## 6. Sources

- Playwright intro — https://playwright.dev/docs/intro
- Best practices — https://playwright.dev/docs/best-practices
- Locators — https://playwright.dev/docs/locators
- Web server — https://playwright.dev/docs/test-webserver
- Accessibility testing — https://playwright.dev/docs/accessibility-testing
- `@axe-core/playwright` — https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
