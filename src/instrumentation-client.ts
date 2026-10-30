import posthog from "posthog-js";

// PostHog client init. Next 15.3+ auto-loads this file on the client — NO layout
// or provider change needed. OPT-IN: with NEXT_PUBLIC_POSTHOG_KEY unset, init
// never runs, so every `posthog.*` call is a no-op and the integration is fully
// inert (no init, no network). See docs/adr/0007-analytics-posthog.md and the
// `posthog` skill.
//
// Website analytics are cookieless and anonymous, with no consent banner and no
// opt-in gating (docs/adr/0009-cookieless-website-analytics.md): nothing is
// stored on the device, nothing is autocaptured, and no person profile is
// created because the Website never calls identify(). The events are pageviews
// and `marketplace_click` (src/lib/analytics/events.ts). Discarding IP addresses
// is a PostHog project setting ("Discard client IP data"), not a client option.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  // Nonce: read the `.nonce` IDL PROPERTY (the attribute is hidden by the browser).
  const nonce = (document.querySelector("script[nonce]") as HTMLScriptElement | null)?.nonce;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  posthog.init(key, {
    // Same-origin reverse proxy — keep `/relay` in sync with next.config.ts
    // (rewrites) and src/middleware.ts (matcher exclusion).
    api_host: "/relay",
    ui_host: host.includes("eu") ? "https://eu.posthog.com" : "https://us.posthog.com",
    // SPA pageviews via history_change + head-injection: no manual
    // usePathname/useSearchParams Suspense tracker, no SSR hydration errors.
    defaults: "2026-05-30",
    // Cookieless (ADR 0009): keep the anonymous id in memory only, so no cookie
    // or local storage is ever written.
    persistence: "memory",
    // Only the events the Website sends on purpose: pageviews and marketplace_click.
    autocapture: false,
    person_profiles: "identified_only",
    respect_dnt: true,
    disable_session_recording: true, // replay OFF by default (WIRED but off)
    disable_surveys: true, // surveys OFF by default
    // Nonce PostHog's lazily-injected scripts/styles (belt-and-suspenders for
    // browsers that don't honor 'strict-dynamic').
    prepare_external_dependency_script: (s) => {
      if (nonce) s.nonce = nonce;
      return s;
    },
    prepare_external_dependency_stylesheet: (s) => {
      if (nonce) s.nonce = nonce;
      return s;
    },
  });
}
