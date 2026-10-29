import posthog from "posthog-js";

// Consent helpers for PostHog capture. Privacy-first: with
// NEXT_PUBLIC_POSTHOG_REQUIRE_CONSENT on (the default) the SDK starts opted OUT,
// so nothing is captured until optIn() runs. Wire optIn() into your consent
// banner's "Accept"; with consent required and NO banner you will see zero
// events BY DESIGN. All wrappers are safe to call when analytics is unconfigured
// or PostHog hasn't loaded — they no-op (guarded on `posthog.__loaded`). This is
// helpers + docs only; building the banner UI is out of scope. See
// docs/adr/0007-analytics-posthog.md.

function loaded(): boolean {
  return posthog.__loaded === true;
}

/** Grant consent and start capturing. Call from your consent banner's Accept. */
export function optIn(): void {
  if (loaded()) posthog.opt_in_capturing();
}

/** Withdraw consent and stop capturing. */
export function optOut(): void {
  if (loaded()) posthog.opt_out_capturing();
}

/** True only if the user has explicitly opted in. */
export function hasOptedIn(): boolean {
  return loaded() ? posthog.has_opted_in_capturing() : false;
}

/** True if the user has opted out (the default while consent is required). */
export function hasOptedOut(): boolean {
  return loaded() ? posthog.has_opted_out_capturing() : false;
}
