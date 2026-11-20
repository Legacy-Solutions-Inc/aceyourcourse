import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";

// The Member seam (spec, Phase 3 → Phase 3 seams), run against every arm. It
// starts with what the Member App gate needs: whether an email is a Beta
// Tester's now, and the Member record made the first time someone passes the
// gate. The sample data starts with one Beta Tester, tester@example.com, and
// no Members.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const OWNER = sampleActor("owner");

const TESTER = "tester@example.com";
const STRANGER = "stranger@example.com";

const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: TESTER,
  name: "Bea Tester",
};
const SAM = {
  userId: "1c9d7e52-3b0a-4f6e-8d2c-5a4b3c2d1e0f",
  email: STRANGER,
  name: "Sam Stranger",
};

describe.each(MEMBER_ARMS)("Member seam ($name)", (arm) => {
  const { seam, admin } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isBetaTester", () => {
    it("says yes for an email on the Beta Tester list", async () => {
      expect(await seam.isBetaTester(TESTER)).toBe(true);
    });

    it("ignores the email's case, and spaces around it", async () => {
      expect(await seam.isBetaTester("  Tester@Example.COM ")).toBe(true);
    });

    it("says no for anyone else", async () => {
      expect(await seam.isBetaTester(STRANGER)).toBe(false);
    });

    it("says no for active Staff who aren't on the list: the staff list is the Guard's", async () => {
      expect(await seam.isBetaTester(OWNER.email)).toBe(false);
    });

    it.each(["", "not-an-email", "tester@", "@example.com"])(
      "says no for %j, which isn't an email address",
      async (email) => {
        expect(await seam.isBetaTester(email)).toBe(false);
      },
    );

    it("says yes from the moment an Owner adds the email", async () => {
      await admin.addBetaTester(OWNER, { email: STRANGER });
      expect(await seam.isBetaTester(STRANGER)).toBe(true);
    });

    it("says no from the moment an Owner removes the tester", async () => {
      await admin.removeBetaTester(OWNER, TESTER);
      expect(await seam.isBetaTester(TESTER)).toBe(false);
    });
  });

  describe("getOrCreateMember", () => {
    it("makes the Member record, keyed by the User, with their name and email", async () => {
      const member = await seam.getOrCreateMember(BEA);

      expect(member).toEqual({ ...BEA, joinedAt: BOOT.toISOString() });
      expect(await arm.members()).toEqual([member]);
    });

    it("stores the email lowercased, and keeps a missing name as none", async () => {
      const member = await seam.getOrCreateMember({
        ...BEA,
        email: "Tester@Example.com",
        name: null,
      });

      expect(member).toMatchObject({ email: TESTER, name: null });
    });

    it("gives the same record on every later request, and makes no second one", async () => {
      const first = await seam.getOrCreateMember(BEA);
      vi.setSystemTime(new Date(BOOT.getTime() + 60_000));

      expect(await seam.getOrCreateMember(BEA)).toEqual(first);
      expect(await seam.getOrCreateMember({ ...BEA, name: "Someone Else" })).toEqual(first);
      expect(await arm.members()).toEqual([first]);
    });

    it("gives each User their own record", async () => {
      const bea = await seam.getOrCreateMember(BEA);
      vi.setSystemTime(new Date(BOOT.getTime() + 60_000));
      const sam = await seam.getOrCreateMember(SAM);

      expect(sam.userId).toBe(SAM.userId);
      expect(await arm.members()).toEqual([bea, sam]);
    });

    it("makes one record when the same User's first requests arrive together", async () => {
      const made = await Promise.all([seam.getOrCreateMember(BEA), seam.getOrCreateMember(BEA)]);

      expect(made[0]).toEqual(made[1]);
      expect(await arm.members()).toHaveLength(1);
    });

    it.each([
      ["a User id that isn't one", { ...BEA, userId: "not-a-uuid" }],
      ["an email that isn't one", { ...BEA, email: "not-an-email" }],
    ])("refuses %s, and makes no record", async (_label, user) => {
      await expect(seam.getOrCreateMember(user)).rejects.toThrow();
      expect(await arm.members()).toEqual([]);
    });
  });

  // Consent (spec, Phase 3 → Consent; stories 82, 83, 133e): each agreement
  // is added to the Member's history, never changed, and the consent check
  // reads the latest one.
  describe("consent records", () => {
    const V1 = { termsVersion: "1.0", privacyVersion: "1.0" };
    const V2 = { termsVersion: "2.0", privacyVersion: "2.0" };
    const later = (ms: number) => vi.setSystemTime(new Date(BOOT.getTime() + ms));

    beforeEach(async () => {
      await seam.getOrCreateMember(BEA);
    });

    it("has no agreement for a Member who never agreed", async () => {
      expect(await seam.latestConsent(BEA.userId)).toBeNull();
      expect(await arm.consents()).toEqual([]);
    });

    it("records an agreement with both versions and the time, and reads it as the latest", async () => {
      const agreed = await seam.recordConsent(BEA.userId, V2);

      expect(agreed).toEqual({ userId: BEA.userId, ...V2, agreedAt: BOOT.toISOString() });
      expect(await seam.latestConsent(BEA.userId)).toEqual(agreed);
      expect(await arm.consents()).toEqual([agreed]);
    });

    it("keeps every agreement as history, unchanged, and reads the newest as the latest", async () => {
      const first = await seam.recordConsent(BEA.userId, V1);
      later(60_000);
      const second = await seam.recordConsent(BEA.userId, { ...V1, termsVersion: "2.0" });
      later(120_000);
      const third = await seam.recordConsent(BEA.userId, V2);

      expect(await seam.latestConsent(BEA.userId)).toEqual(third);
      expect(await arm.consents()).toEqual([first, second, third]);
      expect(first).toEqual({ userId: BEA.userId, ...V1, agreedAt: BOOT.toISOString() });
    });

    it("reads the last one recorded as the latest when two share a time", async () => {
      await seam.recordConsent(BEA.userId, V1);
      const second = await seam.recordConsent(BEA.userId, V2);

      expect(await seam.latestConsent(BEA.userId)).toEqual(second);
    });

    it("never gives one Member another Member's agreements", async () => {
      await seam.getOrCreateMember(SAM);
      const beas = await seam.recordConsent(BEA.userId, V2);

      expect(await seam.latestConsent(SAM.userId)).toBeNull();

      later(60_000);
      const sams = await seam.recordConsent(SAM.userId, V1);
      expect(await seam.latestConsent(BEA.userId)).toEqual(beas);
      expect(await seam.latestConsent(SAM.userId)).toEqual(sams);
      expect(sams.userId).toBe(SAM.userId);
    });

    it("refuses a User with no Member record, such as someone the gate turned away, and records nothing", async () => {
      await expect(seam.recordConsent(SAM.userId, V2)).rejects.toThrow();
      expect(await arm.consents()).toEqual([]);
      expect(await seam.latestConsent(SAM.userId)).toBeNull();
    });

    it.each([
      ["a Terms version that isn't one", { ...V2, termsVersion: "v2" }],
      ["a Privacy version that isn't one", { ...V2, privacyVersion: "2" }],
      ["a blank version", { ...V2, termsVersion: "" }],
    ])("refuses %s, and records nothing", async (_label, versions) => {
      await expect(seam.recordConsent(BEA.userId, versions)).rejects.toThrow();
      expect(await arm.consents()).toEqual([]);
    });

    it("refuses a User id that isn't one, reading or recording", async () => {
      await expect(seam.latestConsent("not-a-uuid")).rejects.toThrow();
      await expect(seam.recordConsent("not-a-uuid", V2)).rejects.toThrow();
      expect(await arm.consents()).toEqual([]);
    });
  });
});
