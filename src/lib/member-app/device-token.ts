import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { paths } from "@/paths";

// ─────────────────────────────────────────────────────────────────────────────
// The Active Device's token (spec, Phase 3 → Active Device; ADR 0011). Each
// claim gives the device a new random token, kept in an httpOnly cookie. Only
// its SHA-256 hash is stored, on the Member's Active Device record, so the
// raw token never leaves the browser and the request that carries it: it is
// never stored or logged. Everything here is pure; the cookie itself is read
// and set in src/lib/member-app/device.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** The cookie holding this device's token. */
export const DEVICE_COOKIE = "ayc_device";

/**
 * Is this request from the Member's Active Device? "active" when its token
 * matches; "no-token" when it carries none (signed in through the Admin, say);
 * "replaced" for any other token: another device claimed since, or the token
 * was tampered with or is unknown.
 */
export type DeviceStatus = "active" | "no-token" | "replaced";

/** A token hash, stored or sent: SHA-256 as 64 lowercase hex characters. The Member seam's schema uses it too. */
export const TOKEN_HASH_PATTERN = /^[0-9a-f]{64}$/;

/** 32 random bytes, base64url: a new device token for one claim. */
export function newDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The token's SHA-256 as 64 lowercase hex characters: the only form that is stored. */
export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Pure: the request's token hash against the Member's stored one. The two are
 * compared in constant time. Anything but an exact match of two well-formed
 * hashes is "replaced", never "active": a tampered token, a raw token sent
 * where its hash belongs, a Member with no Active Device yet.
 */
export function deviceStatusFor(stored: string | null, sent: string | null): DeviceStatus {
  if (sent === null) return "no-token";
  if (stored === null || !TOKEN_HASH_PATTERN.test(stored) || !TOKEN_HASH_PATTERN.test(sent)) {
    return "replaced";
  }
  const same = timingSafeEqual(Buffer.from(stored, "hex"), Buffer.from(sent, "hex"));
  return same ? "active" : "replaced";
}

/** How long a device keeps its token: 400 days, the longest browsers allow. */
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * Pure: the device cookie's attributes. httpOnly, so scripts can't read it;
 * SameSite=Lax; scoped to the Member App, so the Admin and the Website never
 * receive it. Secure everywhere but local development (`pnpm dev`), which
 * runs on plain http, even on a phone on the same network; that is stricter
 * than the sign-in cookies' "production only", on purpose.
 */
export function deviceCookieOptions(nodeEnv: "development" | "test" | "production") {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: nodeEnv !== "development",
    path: paths.memberApp.home,
    maxAge: MAX_AGE_SECONDS,
  };
}
