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
});
