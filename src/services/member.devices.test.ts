import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashDeviceToken } from "@/lib/member-app/device-token";

import { MEMBER_ARMS } from "../../test/member-arms";

// The Member seam's Active Device (spec, Phase 3 → Active Device; ADR 0011;
// stories 107–109, 133f), run against every arm. Each Member has one Active
// Device record: the hash of the token the device holds, its label and when
// it was claimed. Every claim replaces the record and is logged with its time
// and the device label, the first one too. The seam only ever receives a
// token's hash, never the token.
const BOOT = new Date("2026-11-17T03:42:00.000Z");

const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
const SAM = {
  userId: "1c9d7e52-3b0a-4f6e-8d2c-5a4b3c2d1e0f",
  email: "stranger@example.com",
  name: "Sam Stranger",
};

// Two devices' tokens, as the cookie would hold them, and their hashes.
const PHONE_TOKEN = "phone-token-0000000000000000000000000000000";
const LAPTOP_TOKEN = "laptop-token-000000000000000000000000000000";
const PHONE = { tokenHash: hashDeviceToken(PHONE_TOKEN), deviceLabel: "Chrome on Android" };
const LAPTOP = { tokenHash: hashDeviceToken(LAPTOP_TOKEN), deviceLabel: "Safari on macOS" };

describe.each(MEMBER_ARMS)("Member seam: Active Device ($name)", (arm) => {
  const { seam } = arm;
  const later = (ms: number) => vi.setSystemTime(new Date(BOOT.getTime() + ms));
  const at = (ms: number) => new Date(BOOT.getTime() + ms).toISOString();

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    await seam.getOrCreateMember(BEA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("before the first claim", () => {
    it("has no Active Device and no switches", async () => {
      expect(await seam.getActiveDevice(BEA.userId)).toBeNull();
      expect(await seam.listDeviceSwitches(BEA.userId)).toEqual([]);
      expect(await seam.deviceSwitchCount(BEA.userId)).toBe(0);
    });

    it("answers no-token for a request without one", async () => {
      expect(await seam.deviceStatus(BEA.userId, null)).toBe("no-token");
    });

    it("answers replaced, never active, for a request with a token", async () => {
      expect(await seam.deviceStatus(BEA.userId, PHONE.tokenHash)).toBe("replaced");
    });
  });

  describe("claimDevice", () => {
    it("makes the device the Active Device, and logs the first claim", async () => {
      const claimed = await seam.claimDevice(BEA.userId, PHONE);

      expect(claimed).toEqual({ deviceLabel: "Chrome on Android", claimedAt: BOOT.toISOString() });
      expect(await seam.getActiveDevice(BEA.userId)).toEqual(claimed);
      expect(await seam.deviceStatus(BEA.userId, PHONE.tokenHash)).toBe("active");
      expect(await seam.listDeviceSwitches(BEA.userId)).toEqual([
        { userId: BEA.userId, deviceLabel: "Chrome on Android", switchedAt: BOOT.toISOString() },
      ]);
      expect(await seam.deviceSwitchCount(BEA.userId)).toBe(1);
    });

    it("replaces the first device when another claims: the old one is replaced, both claims logged", async () => {
      await seam.claimDevice(BEA.userId, PHONE);
      later(60_000);
      const laptop = await seam.claimDevice(BEA.userId, LAPTOP);

      expect(laptop).toEqual({ deviceLabel: "Safari on macOS", claimedAt: at(60_000) });
      expect(await seam.getActiveDevice(BEA.userId)).toEqual(laptop);
      expect(await seam.deviceStatus(BEA.userId, LAPTOP.tokenHash)).toBe("active");
      expect(await seam.deviceStatus(BEA.userId, PHONE.tokenHash)).toBe("replaced");
      expect(await seam.listDeviceSwitches(BEA.userId)).toEqual([
        { userId: BEA.userId, deviceLabel: "Chrome on Android", switchedAt: at(0) },
        { userId: BEA.userId, deviceLabel: "Safari on macOS", switchedAt: at(60_000) },
      ]);
      expect(await seam.deviceSwitchCount(BEA.userId)).toBe(2);
    });

    it("makes the first device active again when it claims back, replacing the second", async () => {
      await seam.claimDevice(BEA.userId, PHONE);
      later(60_000);
      await seam.claimDevice(BEA.userId, LAPTOP);
      later(120_000);
      const phoneAgain = { ...PHONE, tokenHash: hashDeviceToken("phone-token-after-sign-in") };
      await seam.claimDevice(BEA.userId, phoneAgain);

      expect(await seam.deviceStatus(BEA.userId, phoneAgain.tokenHash)).toBe("active");
      expect(await seam.deviceStatus(BEA.userId, LAPTOP.tokenHash)).toBe("replaced");
      expect(await seam.getActiveDevice(BEA.userId)).toEqual({
        deviceLabel: "Chrome on Android",
        claimedAt: at(120_000),
      });
      expect(await seam.deviceSwitchCount(BEA.userId)).toBe(3);
    });

    it("logs every claim, even of the device that is already active", async () => {
      await seam.claimDevice(BEA.userId, PHONE);
      later(60_000);
      await seam.claimDevice(BEA.userId, PHONE);

      expect(await seam.deviceStatus(BEA.userId, PHONE.tokenHash)).toBe("active");
      expect(await seam.deviceSwitchCount(BEA.userId)).toBe(2);
    });

    it("stores only the token's hash, never the token", async () => {
      await seam.claimDevice(BEA.userId, PHONE);

      const stored = await arm.activeDevices();
      expect(stored).toEqual([
        {
          userId: BEA.userId,
          tokenHash: PHONE.tokenHash,
          deviceLabel: "Chrome on Android",
          claimedAt: BOOT.toISOString(),
        },
      ]);
      const everything = JSON.stringify([stored, await arm.deviceSwitches()]);
      expect(everything).not.toContain(PHONE_TOKEN);
    });

    it("gives no read the hash: only the label and the time", async () => {
      await seam.claimDevice(BEA.userId, PHONE);

      const reads = JSON.stringify([
        await seam.getActiveDevice(BEA.userId),
        await seam.listDeviceSwitches(BEA.userId),
      ]);
      expect(reads).not.toContain(PHONE.tokenHash);
    });

    it.each([
      ["the raw token in place of its hash", { ...PHONE, tokenHash: PHONE_TOKEN }],
      ["a hash cut short", { ...PHONE, tokenHash: PHONE.tokenHash.slice(1) }],
      ["a hash in capitals", { ...PHONE, tokenHash: PHONE.tokenHash.toUpperCase() }],
      ["a blank device label", { ...PHONE, deviceLabel: "  " }],
      ["an overlong device label", { ...PHONE, deviceLabel: "x".repeat(81) }],
    ])("refuses %s, and records nothing", async (_label, claim) => {
      await expect(seam.claimDevice(BEA.userId, claim)).rejects.toThrow();
      expect(await arm.activeDevices()).toEqual([]);
      expect(await arm.deviceSwitches()).toEqual([]);
    });

    it("refuses a User with no Member record, such as someone the gate turned away, and records nothing", async () => {
      await expect(seam.claimDevice(SAM.userId, PHONE)).rejects.toThrow();
      expect(await arm.activeDevices()).toEqual([]);
      expect(await arm.deviceSwitches()).toEqual([]);
    });
  });

  describe("deviceStatus", () => {
    beforeEach(async () => {
      await seam.claimDevice(BEA.userId, PHONE);
    });

    it("answers no-token for a request without one, even with an Active Device", async () => {
      expect(await seam.deviceStatus(BEA.userId, null)).toBe("no-token");
    });

    it.each([
      ["a tampered token", hashDeviceToken(`${PHONE_TOKEN.slice(0, -1)}X`)],
      ["an unknown token", hashDeviceToken("never-issued")],
      ["the raw token instead of its hash", PHONE_TOKEN],
      ["a value that isn't a hash at all", "garbage"],
      ["an empty value", ""],
    ])("answers replaced, never active, for %s", async (_label, sent) => {
      expect(await seam.deviceStatus(BEA.userId, sent)).toBe("replaced");
    });
  });

  describe("one Member's devices and another's", () => {
    beforeEach(async () => {
      await seam.getOrCreateMember(SAM);
    });

    it("never matches one Member's token against another Member's record", async () => {
      await seam.claimDevice(BEA.userId, PHONE);

      expect(await seam.deviceStatus(SAM.userId, PHONE.tokenHash)).toBe("replaced");

      await seam.claimDevice(SAM.userId, LAPTOP);
      expect(await seam.deviceStatus(SAM.userId, PHONE.tokenHash)).toBe("replaced");
      expect(await seam.deviceStatus(BEA.userId, LAPTOP.tokenHash)).toBe("replaced");
      expect(await seam.deviceStatus(BEA.userId, PHONE.tokenHash)).toBe("active");
      expect(await seam.deviceStatus(SAM.userId, LAPTOP.tokenHash)).toBe("active");
    });

    it("keeps each Member's Active Device and switch log to themselves", async () => {
      await seam.claimDevice(BEA.userId, PHONE);
      later(60_000);
      await seam.claimDevice(SAM.userId, LAPTOP);
      later(120_000);
      await seam.claimDevice(BEA.userId, LAPTOP);

      expect(await seam.listDeviceSwitches(SAM.userId)).toEqual([
        { userId: SAM.userId, deviceLabel: "Safari on macOS", switchedAt: at(60_000) },
      ]);
      expect(await seam.deviceSwitchCount(SAM.userId)).toBe(1);
      expect(await seam.deviceSwitchCount(BEA.userId)).toBe(2);
      expect(await seam.getActiveDevice(SAM.userId)).toEqual({
        deviceLabel: "Safari on macOS",
        claimedAt: at(60_000),
      });
    });
  });

  it("refuses a User id that isn't one, for every read and the claim", async () => {
    await expect(seam.claimDevice("not-a-uuid", PHONE)).rejects.toThrow();
    await expect(seam.deviceStatus("not-a-uuid", PHONE.tokenHash)).rejects.toThrow();
    await expect(seam.getActiveDevice("not-a-uuid")).rejects.toThrow();
    await expect(seam.listDeviceSwitches("not-a-uuid")).rejects.toThrow();
    await expect(seam.deviceSwitchCount("not-a-uuid")).rejects.toThrow();
    expect(await arm.deviceSwitches()).toEqual([]);
  });
});
