---
name: posthog
description: Use when working on analytics, product events, feature flags, session replay, or consent — the PostHog integration (src/instrumentation-client.ts, src/lib/analytics/*, the /relay reverse proxy, and its CSP/middleware interaction).
---

# PostHog analytics (this repo)

## 1. When to use

Any analytics work: capturing events, pageviews/autocapture, feature flags
(client or server), session replay, consent, or touching the `/relay` proxy.
Pair with **nextjs-app-router** (instrumentation/middleware), **supabase-auth**
(the CSP nonce), and **coding-standards**. Full rationale:
`docs/adr/0007-analytics-posthog.md`.

## 2. Version

- `posthog-js` **1.409.5**, `posthog-node` **5.47.3**, `@posthog/react` **1.10.3**
  (from `package.json` / installed). `posthog-node` needs `node >=22.22.0` — the
  repo pins node **22.23.1** (Volta / `.nvmrc` / CI).

## 3. Core standards

**Opt-in / inert by default.** Everything is gated on
`NEXT_PUBLIC_POSTHOG_KEY`; unset ⇒ no init, no network, all `posthog.*` are
no-ops. `isAnalyticsConfigured` (in `src/config.ts`) mirrors
`isSupabaseConfigured`/`isDatabaseConfigured`. The token is **publishable** →
`NEXT_PUBLIC_*` (validated in `src/env.ts`), **never** in `src/env.server.ts`.

**Client init is auto-loaded.** `src/instrumentation-client.ts` is picked up by
Next 15.3+ — **no layout/provider change**. `defaults: '2026-05-30'` gives SPA
pageviews via `history_change`, so **do NOT** add a manual
`usePathname`/`useSearchParams` Suspense tracker.

**Reverse proxy `/relay` — ONE constant, THREE places in sync:** the
`next.config.ts` rewrites, the client `api_host: '/relay'`, and the
**`src/middleware.ts` matcher exclusion**. The matcher exclusion is the
load-bearing gotcha: the CSP middleware matches broadly, and if it intercepts
`/relay` it **silently breaks ingestion** (assets still load, so it _looks_
connected). `next.config.ts` also needs `skipTrailingSlashRedirect: true`
(PostHog's API uses `/e/`, `/s/`). The **server** SDK uses the REAL host
(`NEXT_PUBLIC_POSTHOG_HOST`), never `/relay`.

**CSP.** Default analytics-only mode needs **no CSP change** (bundled + injected
scripts covered by `script-src 'strict-dynamic'`; `/relay` by `connect-src
'self'`). The ONLY delta is **Session Replay**: its recorder runs in a `blob:`
Web Worker and `strict-dynamic` does not cover `worker-src`, so `buildCsp` adds
`worker-src 'self' blob:` **only** when the `sessionReplay` flag is on (wired from
`analyticsSessionReplay`). Never add a PostHog host to `script-src`/`connect-src`;
never add `'unsafe-eval'` (Toolbar-only).

**Feature flags — client vs server.**

- Client: `@posthog/react` hooks (e.g. `useFeatureFlagEnabled`) directly in client
  components — no provider needed.
- Server (RSC / Server Actions): `src/lib/analytics/server.ts` — `await
client.evaluateFlags(distinctId)` then `flags.isEnabled(key)` /
  `flags.getFlag(key)` / `flags.getFlagPayload(key)` (NOT the deprecated
  `getFeatureFlag`/`isFeatureEnabled` client methods).

**Serverless flush.** The server helper creates a **fresh client per request**
with `flushAt: 1, flushInterval: 0`, uses `captureImmediate`, and **always awaits
`shutdown()`** in `finally` — so a serverless function never exits before the
event/flag call completes. A cached singleton is NOT safe with per-request
shutdown.

**Privacy / consent (GDPR).** `person_profiles: 'identified_only'`,
`respect_dnt: true`, and capture is consent-gated by default
(`NEXT_PUBLIC_POSTHOG_REQUIRE_CONSENT` ⇒ `opt_out_capturing_by_default`). Wire
`optIn()` (from `src/lib/analytics/consent.ts`) into a consent banner; with
consent required and no banner, **zero events fire by design** (not a bug).

## 4. In this template

- `src/instrumentation-client.ts` — opt-in gated init: `api_host: '/relay'`,
  `defaults: '2026-05-30'`, `identified_only`, `respect_dnt`, consent gating,
  replay + surveys off, nonce-aware `prepare_external_dependency_*`.
- `src/lib/analytics/consent.ts` — `optIn`/`optOut`/`hasOptedIn`/`hasOptedOut`,
  no-op until `posthog.__loaded`.
- `src/lib/analytics/server.ts` — `import "server-only"`; `captureServer` +
  `isFeatureEnabled`/`getFeatureFlag`/`getFeatureFlagPayload` via `evaluateFlags`;
  no-ops when unconfigured.
- `src/config.ts` — `isAnalyticsConfigured`, `analyticsSessionReplay` (CSP toggle).
- `src/env.ts` — `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` / `_REQUIRE_CONSENT`.
- `next.config.ts` — `/relay` rewrites + `skipTrailingSlashRedirect`.
- `src/middleware.ts` — `relay` excluded from the matcher; passes `sessionReplay`
  to `buildCsp`.
- `src/lib/csp.ts` / `src/lib/csp.test.ts` — optional `worker-src` for replay.

## 5. Red flags

- Forgetting the **middleware matcher exclusion** for `/relay` (silent ingestion
  break), or letting the three `/relay` sites drift.
- Putting the token in `src/env.server.ts` or treating it as a secret.
- Adding a PostHog host to `script-src`/`connect-src`, adding `'unsafe-eval'`, or
  adding `worker-src` when replay is off (weakens/dirties the CSP).
- A manual pathname pageview tracker (double-counts — `defaults` already does it).
- Server flags via deprecated `getFeatureFlag`/`isFeatureEnabled` instead of
  `evaluateFlags`; or not awaiting `captureImmediate`/`shutdown()` (dropped events
  on serverless).
- Assuming events flow with no key set (it's inert) — or assuming consent-gated
  capture is broken when it's just waiting for `optIn()`.
- Enabling replay in the client without also turning on `analyticsSessionReplay`
  (CSP blocks the `blob:` worker), or vice-versa.

## 6. Sources

- PostHog Next.js — https://posthog.com/docs/libraries/next-js
- Reverse proxy (Next.js rewrites) — https://posthog.com/docs/advanced/proxy/nextjs
- posthog-js config — https://posthog.com/docs/libraries/js/config
- Feature flags (server / Node) — https://posthog.com/docs/libraries/node
- Session replay + CSP / privacy controls — https://posthog.com/docs/session-replay/privacy
- Content Security Policy — https://posthog.com/docs/advanced/content-security-policy
