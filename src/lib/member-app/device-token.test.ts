// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  DEVICE_COOKIE,
  deviceCookieOptions,
  deviceStatusFor,
  hashDeviceToken,
  newDeviceToken,
} from "./device-token";

// The Active Device's token (spec, Phase 3 → Active Device; ADR 0011): a
// random value in a cookie, of which only a SHA-256 hash is stored. The
// request's token is compared with the stored hash in constant time, and
// anything but an exact match is never "active".

/** SHA-256 of "abc", from FIPS 180-2's worked example: an independent check of the hash. */
const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("newDeviceToken", () => {
  it("is 32 random bytes in base64url: 43 characters, no padding", () => {
    const token = newDeviceToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("is different every time", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => newDeviceToken()));
    expect(tokens.size).toBe(50);
  });
});

describe("hashDeviceToken", () => {
  it("is the token's SHA-256, as 64 lowercase hex characters", () => {
    expect(hashDeviceToken("abc")).toBe(ABC_SHA256);
  });

  it("never contains the token itself", () => {
    const token = newDeviceToken();
    const hash = hashDeviceToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });
});

describe("deviceStatusFor", () => {
  const token = "the-device-token";
  const stored = hashDeviceToken(token);

  it("is active when the request's token hashes to the stored hash", () => {
    expect(deviceStatusFor(stored, hashDeviceToken(token))).toBe("active");
  });

  it("is no-token when the request carries none, whatever is stored", () => {
    expect(deviceStatusFor(stored, null)).toBe("no-token");
    expect(deviceStatusFor(null, null)).toBe("no-token");
  });

  it("is replaced for a token that isn't the stored one", () => {
    expect(deviceStatusFor(stored, hashDeviceToken("another-device-token"))).toBe("replaced");
  });

  it("is replaced, never active, for a tampered token one character off", () => {
    const tampered = `${token.slice(0, -1)}X`;
    expect(deviceStatusFor(stored, hashDeviceToken(tampered))).toBe("replaced");
  });

  it("is replaced for a token when the Member has no Active Device at all", () => {
    expect(deviceStatusFor(null, hashDeviceToken(token))).toBe("replaced");
  });

  it.each([
    ["the raw token instead of its hash", token],
    ["a hash cut short", stored.slice(0, 63)],
    ["a hash in capitals", stored.toUpperCase()],
    ["an empty string", ""],
  ])("is replaced, never active, for %s", (_label, sent) => {
    expect(deviceStatusFor(stored, sent)).toBe("replaced");
  });

  it("is replaced when the stored value is malformed, even if the request sends the same", () => {
    expect(deviceStatusFor("not-a-hash", "not-a-hash")).toBe("replaced");
  });
});

describe("deviceCookieOptions", () => {
  it("names the cookie ayc_device", () => {
    expect(DEVICE_COOKIE).toBe("ayc_device");
  });

  it("is httpOnly, SameSite=Lax, Secure and scoped to /app in production, for about a year", () => {
    expect(deviceCookieOptions("production")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/app",
      maxAge: 400 * 24 * 60 * 60,
    });
  });

  it("is Secure under test too: only local development drops it", () => {
    expect(deviceCookieOptions("test").secure).toBe(true);
  });

  it("drops Secure in local development, where the site runs on plain http", () => {
    expect(deviceCookieOptions("development")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/app",
    });
  });
});
