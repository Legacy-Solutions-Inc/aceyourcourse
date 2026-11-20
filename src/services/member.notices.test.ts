import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noticeText } from "@/lib/member-app/notices";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";

// The Member seam's in-app notices (ticket 17; spec, Phase 3 planning
// decisions → In-app notices; stories 131, 133h and 133j), run against every
// arm. An Owner's grant, extension or end of a Member's Access Pass leaves the
// Member a notice, which the Member App shows as one dismissible banner. A
// dismissed notice stays dismissed, on every device. A Member only ever reads
// or dismisses their own.
//
// "Now" is 17 Nov 2026, 11:42 in Manila; Bea and Sam have no pass.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const MINUTE = 60_000;
const OWNER = sampleActor("owner");

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

describe.each(MEMBER_ARMS)("Member seam: notices ($name)", (arm) => {
  const { seam, admin } = arm;
  const later = (ms: number) => vi.setSystemTime(new Date(BOOT.getTime() + ms));

  const grant = (userId: string, examCode = "CE") =>
    admin.grantAccess(OWNER, { userId, examCode, days: 30, reason: "Beta tester" });
  const texts = async (userId: string) => (await seam.listNotices(userId)).map(noticeText);

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    await seam.getOrCreateMember(BEA);
    await seam.getOrCreateMember(SAM);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives a Member with no notices none", async () => {
    expect(await seam.listNotices(BEA.userId)).toEqual([]);
  });

  it("gives the Member the notice an Owner's grant left them", async () => {
    await grant(BEA.userId);
    expect(await texts(BEA.userId)).toEqual(["You now have CE All-Access until 17 Dec 2026"]);
  });

  it("gives every notice, newest first: one banner each", async () => {
    await grant(BEA.userId);
    later(MINUTE);
    await grant(BEA.userId, "ME");
    later(2 * MINUTE);
    await admin.extendAccess(OWNER, {
      userId: BEA.userId,
      examCode: "CE",
      days: 7,
      reason: "Late payment",
    });

    expect(await texts(BEA.userId)).toEqual([
      "Your CE access was extended to 24 Dec 2026",
      "You now have ME All-Access until 17 Dec 2026",
      "You now have CE All-Access until 17 Dec 2026",
    ]);
  });

  it("shows the end of access above the grant before it", async () => {
    await grant(BEA.userId);
    later(MINUTE);
    await admin.endAccess(OWNER, { userId: BEA.userId, examCode: "CE", reason: "Mistake" });
    expect(await texts(BEA.userId)).toEqual([
      "Your CE access has ended",
      "You now have CE All-Access until 17 Dec 2026",
    ]);
  });

  describe("dismissNotice", () => {
    it("hides the notice for good, on every later read", async () => {
      await grant(BEA.userId);
      const [notice] = await seam.listNotices(BEA.userId);
      if (!notice) throw new Error("No notice");

      expect(await seam.dismissNotice(BEA.userId, notice.id)).toBe(true);

      expect(await seam.listNotices(BEA.userId)).toEqual([]);
      // Another visit, from another device: the Member's records are the same.
      later(60 * MINUTE);
      expect(await seam.listNotices(BEA.userId)).toEqual([]);
    });

    it("answers true again for a notice already dismissed, changing nothing", async () => {
      await grant(BEA.userId);
      const [notice] = await seam.listNotices(BEA.userId);
      if (!notice) throw new Error("No notice");
      await seam.dismissNotice(BEA.userId, notice.id);

      expect(await seam.dismissNotice(BEA.userId, notice.id)).toBe(true);
      expect(await seam.listNotices(BEA.userId)).toEqual([]);
    });

    it("shows a later notice for the same Exam after one was dismissed", async () => {
      await grant(BEA.userId);
      const [notice] = await seam.listNotices(BEA.userId);
      if (!notice) throw new Error("No notice");
      await seam.dismissNotice(BEA.userId, notice.id);
      later(MINUTE);

      await admin.endAccess(OWNER, { userId: BEA.userId, examCode: "CE", reason: "Mistake" });

      expect(await texts(BEA.userId)).toEqual(["Your CE access has ended"]);
    });

    it("leaves the Member's other notices showing, the same Exam's too", async () => {
      await grant(BEA.userId);
      later(MINUTE);
      await grant(BEA.userId, "ME");
      later(2 * MINUTE);
      await admin.endAccess(OWNER, { userId: BEA.userId, examCode: "CE", reason: "Mistake" });
      const [ended] = await seam.listNotices(BEA.userId);
      if (!ended) throw new Error("No notice");

      await seam.dismissNotice(BEA.userId, ended.id);

      expect(await texts(BEA.userId)).toEqual([
        "You now have ME All-Access until 17 Dec 2026",
        "You now have CE All-Access until 17 Dec 2026",
      ]);
    });

    it.each(["not-a-uuid", "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b"])(
      "answers false for %j, which is no notice of theirs",
      async (noticeId) => {
        await grant(BEA.userId);
        expect(await seam.dismissNotice(BEA.userId, noticeId)).toBe(false);
        expect(await seam.listNotices(BEA.userId)).toHaveLength(1);
      },
    );
  });

  describe("one Member and another", () => {
    it("never gives one Member another's notices", async () => {
      await grant(BEA.userId);
      expect(await seam.listNotices(SAM.userId)).toEqual([]);
      expect((await seam.listNotices(BEA.userId)).map(({ userId }) => userId)).toEqual([
        BEA.userId,
      ]);
    });

    it("never lets one Member dismiss another's notice", async () => {
      await grant(BEA.userId);
      const [notice] = await seam.listNotices(BEA.userId);
      if (!notice) throw new Error("No notice");

      expect(await seam.dismissNotice(SAM.userId, notice.id)).toBe(false);

      expect(await seam.listNotices(BEA.userId)).toHaveLength(1);
    });
  });

  it("throws for a User id that isn't one", async () => {
    await expect(seam.listNotices("not-a-uuid")).rejects.toThrow();
    await expect(seam.dismissNotice("not-a-uuid", "x")).rejects.toThrow();
  });
});
