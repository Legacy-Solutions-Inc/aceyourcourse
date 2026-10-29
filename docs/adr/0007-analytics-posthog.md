# 7. PostHog analytics — opt-in, reverse-proxied, privacy-first

Date: 2026-07-31

## Status

Accepted

## Context

The template needs product analytics (pageviews + autocapture) and feature flags
(client and server) without compromising the two things it already guards: the
strict per-request nonce CSP (ADR: security hardening) and the "runs with zero
backend / nothing configured" default (ADR 0003). Analytics must be demonstrable
but must not fire — or add network, cost, or privacy exposure — until a project
explicitly turns it on, and must not weaken the CSP.

## Decision

Adopt **PostHog** (`posthog-js`, `posthog-node`, `@posthog/react`) under four
constraints:

1. **Opt-in / inert by default.** The integration does nothing — no init, no
   network — unless `NEXT_PUBLIC_POSTHOG_KEY` is set. `isAnalyticsConfigured`
   (in `src/config.ts`) mirrors `isSupabaseConfigured` / `isDatabaseConfigured`;
   the client init in `src/instrumentation-client.ts` early-returns when the key
   is unset, so all `posthog.*` calls become no-ops. The token is **publishable**
   (not a secret) → `NEXT_PUBLIC_*`, validated in `src/env.ts`, never in
   `src/env.server.ts`.

2. **Scope:** pageviews + autocapture, and feature flags (client hooks via
   `@posthog/react`, plus a server helper `src/lib/analytics/server.ts`). Session
   replay and surveys are **wired but OFF by default**.

3. **Same-origin reverse proxy (`/relay`).** Client ingestion is proxied through
   the app's own domain via `next.config.ts` rewrites (+ `skipTrailingSlashRedirect`,
   because PostHog's API uses trailing slashes). This keeps the CSP essentially
   unchanged (same-origin is covered by `connect-src 'self'`) and dodges
   ad-blockers. `/relay` is ONE constant kept in sync in **three** places: the
   rewrites, the client `api_host`, and — critically — the **middleware matcher
   exclusion**. The CSP middleware matches broadly; if it intercepts `/relay` it
   silently breaks ingestion (assets still load, so it _looks_ connected). The
   **server** SDK talks to the REAL host (`NEXT_PUBLIC_POSTHOG_HOST`), not `/relay`.

4. **Privacy-first.** `person_profiles: 'identified_only'`, `respect_dnt: true`,
   consent-gated capture by default (`opt_out_capturing_by_default` driven by
   `NEXT_PUBLIC_POSTHOG_REQUIRE_CONSENT`, default `"true"`), replay masking on when
   replay is enabled. Thin consent helpers live in `src/lib/analytics/consent.ts`;
   building the consent-banner UI is out of scope (helpers + docs only). **GDPR:**
   with consent required and no banner wired to `optIn()`, zero events fire — by
   design.

### CSP interaction

Default (analytics-only) mode needs **no CSP change**: the bundled SDK and its
lazily-injected scripts are covered by `script-src … 'strict-dynamic'` (trust
propagation), and `/relay` by `connect-src 'self'`. The init also nonces PostHog's
injected `<script>`/`<style>` as belt-and-suspenders for non-`strict-dynamic`
browsers. The **only** CSP delta is **Session Replay**: its recorder runs in a
`blob:` Web Worker, and `strict-dynamic` does not cover `worker-src` (which falls
back to `default-src 'self'`). So `buildCsp` gains an optional `sessionReplay`
flag that adds `worker-src 'self' blob:` — off by default, wired from
`analyticsSessionReplay` in `src/config.ts` via `src/middleware.ts`. No PostHog
host is ever added to `script-src`/`connect-src`, and `'unsafe-eval'` is never
added (that is Toolbar-only).

### Node engine

`posthog-node` requires `node ^20.20.0 || >=22.22.0`; the Volta pin was
`22.14.0`. Resolved by bumping the pin (and `.nvmrc` / CI) to the latest 22.x LTS
`22.23.1` — the preferred path, keeping the latest SDK.

## Consequences

- The app still builds and runs fully inert with no PostHog key; the strict CSP
  is byte-identical in the default (replay-off) mode, so `csp.test.ts` stays green.
- Three-places-in-sync `/relay` is a maintenance hazard; the middleware-matcher
  exclusion is the load-bearing, easy-to-miss one — code comments cross-reference
  all three sites, and the `posthog` skill documents the gotcha.
- Enabling Session Replay is a deliberate two-step change (recording in the client
  - `analyticsSessionReplay` for the CSP `worker-src`).
- The server SDK creates a fresh client per request and awaits `shutdown()` so
  serverless functions never drop events; a cached singleton would not be
  serverless-safe with per-request shutdown.
- **Unverified:** events/flags actually flowing is untested — it needs a real
  PostHog project + key; only the inert/offline/build paths are verified.
