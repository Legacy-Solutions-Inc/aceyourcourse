import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { env } from "@/env";
import { deviceLabel } from "@/lib/member-app/device-label";
import {
  DEVICE_COOKIE,
  type DeviceStatus,
  deviceCookieOptions,
  hashDeviceToken,
  newDeviceToken,
} from "@/lib/member-app/device-token";
import { claimDevice, deviceStatus } from "@/services/member";
import type { ActiveDevice } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// This request's device, for the Member App (spec, Phase 3 → Active Device;
// ADR 0011). The token lives in the ayc_device cookie, scoped to /app, so the
// Admin never receives, sets or checks it. Only the token's hash leaves this
// module: the Member seam stores and compares hashes, and the raw token is
// never stored or logged. Who the Member is comes from the gate
// (src/lib/member-app/guard.ts), never from the browser.
// ─────────────────────────────────────────────────────────────────────────────

/** This request's device token, or null when it carries none. An emptied cookie counts as none. */
async function requestToken(): Promise<string | null> {
  return (await cookies()).get(DEVICE_COOKIE)?.value || null;
}

/**
 * Is this request from the Member's Active Device? "active", "no-token" or
 * "replaced" (see DeviceStatus). Every Member App page and Server Action asks,
 * through requireMember; later tickets' protected reads ask too. It's read
 * once per request (the shell's layout and the page both ask) and fresh on
 * the next.
 */
export const checkDevice = cache(async (userId: string): Promise<DeviceStatus> => {
  const token = await requestToken();
  return deviceStatus(userId, token === null ? null : hashDeviceToken(token));
});

/**
 * Makes this device the Member's Active Device: a new random token goes into
 * this device's cookie, and only its hash, with the label read from the
 * User-Agent, to the Member seam, which replaces the record and logs the
 * claim. The cookie is set only once the claim is stored. The caller has run
 * the gate (and, for the confirm actions, consent).
 */
export async function claimThisDevice(userId: string): Promise<ActiveDevice> {
  const token = newDeviceToken();
  const claimed = await claimDevice(userId, {
    tokenHash: hashDeviceToken(token),
    deviceLabel: deviceLabel((await headers()).get("user-agent")),
  });
  (await cookies()).set(DEVICE_COOKIE, token, deviceCookieOptions(env.NODE_ENV));
  return claimed;
}

/**
 * Signing out of the Member App: this device forgets its token. The Member's
 * Active Device record stays, so nothing else changes until another claim.
 */
export async function forgetThisDevice(): Promise<void> {
  (await cookies()).set(DEVICE_COOKIE, "", { ...deviceCookieOptions(env.NODE_ENV), maxAge: 0 });
}
