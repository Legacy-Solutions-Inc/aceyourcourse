import "server-only";

import { PostHog } from "posthog-node";

import { isAnalyticsConfigured } from "@/config";
import { env } from "@/env";

// Server-side PostHog (posthog-node) for RSCs, Server Actions, and Route
// Handlers. Every helper NO-OPS gracefully when analytics is unconfigured
// (returns false/undefined), so callers need no guards.
//
// Serverless safety: a fresh client is created per request and always awaited
// `shutdown()` in a `finally` — a cached singleton would either be shut down for
// later invocations or leak/drop events. `flushAt: 1` + `flushInterval: 0` +
// `captureImmediate` / `shutdown()` guarantee the event is sent before the
// function exits. Uses the REAL ingestion host (NOT the `/relay` proxy — server
// traffic isn't proxied). See docs/adr/0007-analytics-posthog.md.

function createClient(): PostHog | null {
  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!isAnalyticsConfigured || !key) return null;
  return new PostHog(key, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
}

/**
 * Capture a server-side event. Awaits `captureImmediate` so a serverless
 * function never exits before the event is sent. No-op when unconfigured.
 */
export async function captureServer(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const client = createClient();
  if (!client) return;
  try {
    await client.captureImmediate({ distinctId, event, properties });
  } finally {
    await client.shutdown();
  }
}

/** Is a feature flag enabled for this user? Returns `false` when unconfigured. */
export async function isFeatureEnabled(distinctId: string, key: string): Promise<boolean> {
  const client = createClient();
  if (!client) return false;
  try {
    const flags = await client.evaluateFlags(distinctId);
    return flags.isEnabled(key);
  } finally {
    await client.shutdown();
  }
}

/** A feature flag's value/variant, or `undefined` when unconfigured. */
export async function getFeatureFlag(
  distinctId: string,
  key: string,
): Promise<string | boolean | undefined> {
  const client = createClient();
  if (!client) return undefined;
  try {
    const flags = await client.evaluateFlags(distinctId);
    return flags.getFlag(key);
  } finally {
    await client.shutdown();
  }
}

/** A feature flag's JSON payload, or `undefined` when unconfigured. */
export async function getFeatureFlagPayload(distinctId: string, key: string): Promise<unknown> {
  const client = createClient();
  if (!client) return undefined;
  try {
    const flags = await client.evaluateFlags(distinctId);
    return flags.getFlagPayload(key);
  } finally {
    await client.shutdown();
  }
}
