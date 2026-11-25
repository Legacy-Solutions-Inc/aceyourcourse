import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { accessDecision } from "@/lib/member-app/access";
import { noticeText } from "@/lib/member-app/notices";
import { sampleTopicId } from "@/services/mock/content";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor, UNUSED_EXAM } from "../../test/admin-inputs";
import { CE_OFFICIAL, withExamDates } from "../../test/member-inputs";

// Grant, extend and end a Member's Access Pass (Phase 3, ticket 17; stories
// 131, 133h and 133j; spec, Phase 3 planning decisions → Grants and ending
// access, In-app notices, Target Exams), run against every arm. Owners only,
// each with a reason Staff Activity keeps with the pass's end before and
// after. Each grant's days are kept as their own history row. The Member gets
// an in-app notice, never an email; a grant for an Exam they don't have adds
// it to their Target Exams. Editors are refused everything.
//
// The data: Bea's CE pass ends in 90 days, Lou's CE pass ended 3 days ago,
// and Sam has none. CE has an Official Exam Date (21 Nov 2026), ME has none,
// and CHE is an Exam with no Product, so it isn't on the Website. "Now" is
// 17 Nov 2026, 11:42 in Manila.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");

const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
const LOU = {
  userId: "0b6e4d2a-7c1f-4e3b-9a85-2d4c6e8f0a12",
  email: "lapsed@example.com",
  name: "Lou Lapsed",
};
const SAM = {
  userId: "1c9d7e52-3b0a-4f6e-8d2c-5a4b3c2d1e0f",
  email: "stranger@example.com",
  name: null,
};
/** A User id no Member has. */
const NOBODY = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const ME_DATE = "2027-02-08";
/** When the tests act: 10 minutes after BOOT. */
const NOW = 10 * MINUTE;

const at = (ms: number) => new Date(BOOT.getTime() + ms).toISOString();

describe.each(ADMIN_ARMS)("Admin seam: Access Passes ($name)", (arm) => {
  const { seam, member } = arm;
  const later = (ms: number) => vi.setSystemTime(new Date(BOOT.getTime() + ms));

  const passOf = async (userId: string, examCode = "CE") =>
    (await member.listAccessPasses(userId)).find((pass) => pass.examCode === examCode) ?? null;
  const codes = async (userId: string) =>
    (await member.listTargetExams(userId)).map(({ examCode }) => examCode);

  /** What the access decision answers the Member for CE study content now. */
  const decisionFor = async (userId: string) =>
    accessDecision({
      gate: "open",
      device: "active",
      content: { examCode: "CE", available: true, freePreview: false },
      activeStaff: false,
      passes: await member.listAccessPasses(userId),
      now: new Date(),
    });

  /** Everything a refused call must leave as it was. */
  const snapshot = async () => ({
    passes: await Promise.all([BEA, LOU, SAM].map(({ userId }) => member.listAccessPasses(userId))),
    activity: await arm.staffActivity(),
    notices: await Promise.all([BEA, LOU, SAM].map(({ userId }) => member.listNotices(userId))),
    targetExams: await Promise.all([BEA, LOU, SAM].map(({ userId }) => codes(userId))),
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset(withExamDates);
    for (const user of [BEA, LOU, SAM]) await member.getOrCreateMember(user);
    await arm.putAccessPass({ userId: BEA.userId, examCode: "CE", endsAt: at(90 * DAY) });
    await arm.putAccessPass({ userId: LOU.userId, examCode: "CE", endsAt: at(-3 * DAY) });
    await member.addTargetExam(BEA.userId, { examCode: "CE", examDate: null });
    await member.addTargetExam(LOU.userId, { examCode: "CE", examDate: null });
    await member.addTargetExam(SAM.userId, { examCode: "ME", examDate: ME_DATE });
    later(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("grantAccess", () => {
    const grant = { userId: SAM.userId, examCode: "CE", days: 30, reason: "  Beta tester  " };

    it("gives a Member with no pass the days from now", async () => {
      const result = await seam.grantAccess(OWNER, grant);

      expect(result).toEqual({
        ok: true,
        tags: [],
        value: {
          userId: SAM.userId,
          examCode: "CE",
          endsBefore: null,
          endsAt: at(NOW + 30 * DAY),
          days: 30,
          reason: "Beta tester",
          targetExam: "added",
        },
      });
      expect(await passOf(SAM.userId)).toEqual({
        userId: SAM.userId,
        examCode: "CE",
        endsAt: at(NOW + 30 * DAY),
      });
    });

    it("lets the Member open the Exam's locked content", async () => {
      expect(await decisionFor(SAM.userId)).toEqual({ outcome: "locked" });
      await seam.grantAccess(OWNER, grant);
      expect(await decisionFor(SAM.userId)).toEqual({ outcome: "allowed", via: "pass" });
    });

    it("adds the days to the end of an active pass", async () => {
      const result = await seam.grantAccess(OWNER, { ...grant, userId: BEA.userId });

      expect(result).toMatchObject({
        ok: true,
        value: { endsBefore: at(90 * DAY), endsAt: at(120 * DAY), targetExam: null },
      });
      expect(await passOf(BEA.userId)).toMatchObject({ endsAt: at(120 * DAY) });
    });

    it("starts from now on a pass that has ended, not from its old end", async () => {
      const result = await seam.grantAccess(OWNER, { ...grant, userId: LOU.userId });

      expect(result).toMatchObject({
        ok: true,
        value: { endsBefore: at(-3 * DAY), endsAt: at(NOW + 30 * DAY) },
      });
      expect(await decisionFor(LOU.userId)).toEqual({ outcome: "allowed", via: "pass" });
    });

    it("gives a custom number of days", async () => {
      await seam.grantAccess(OWNER, { ...grant, days: 45 });
      expect(await passOf(SAM.userId)).toMatchObject({ endsAt: at(NOW + 45 * DAY) });
    });

    it("keeps the grant's days as their own history row", async () => {
      await seam.grantAccess(OWNER, { ...grant, userId: BEA.userId });

      const detail = await seam.getMemberForAdmin(OWNER, BEA.userId);
      expect(detail.ok && detail.value.accessPasses).toEqual([
        {
          examCode: "CE",
          endsAt: at(120 * DAY),
          grants: [
            {
              days: 30,
              startsAt: at(90 * DAY),
              endsAt: at(120 * DAY),
              reason: "Beta tester",
              grantedBy: { email: OWNER.email, name: OWNER.name },
              grantedAt: at(NOW),
              orderId: null,
            },
          ],
        },
      ]);
    });

    it("records the grant in Staff Activity, with the ends before and after and the reason", async () => {
      await seam.grantAccess(OWNER, grant);

      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: at(NOW),
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "access-pass",
          entityId: `${SAM.userId}/CE`,
          action: "grant-access",
          before: { email: SAM.email, examCode: "CE", endsAt: null },
          after: {
            email: SAM.email,
            examCode: "CE",
            endsAt: at(NOW + 30 * DAY),
            days: 30,
            reason: "Beta tester",
            targetExam: "added",
          },
        },
      ]);
    });

    it("leaves the Member a notice of the grant, with its end", async () => {
      await seam.grantAccess(OWNER, grant);

      const notices = await member.listNotices(SAM.userId);
      expect(notices).toEqual([
        {
          id: expect.any(String),
          userId: SAM.userId,
          examCode: "CE",
          kind: "granted",
          endsAt: at(NOW + 30 * DAY),
          createdAt: at(NOW),
          dismissedAt: null,
        },
      ]);
      // 30 days from 11:52 on 17 Nov in Manila.
      expect(notices.map(noticeText)).toEqual(["You now have CE All-Access until 17 Dec 2026"]);
    });

    describe("the Member's Target Exams", () => {
      it("adds an Exam the Member doesn't have, with its Official Exam Date, leaving their selection", async () => {
        await seam.grantAccess(OWNER, grant);

        expect(await member.listTargetExams(SAM.userId)).toEqual([
          expect.objectContaining({ examCode: "ME", examDate: ME_DATE, selected: true }),
          expect.objectContaining({
            examCode: "CE",
            examDate: CE_OFFICIAL,
            dateSetBy: "official",
            selected: false,
            addedAt: at(NOW),
          }),
        ]);
      });

      it("restores one the Member removed, with the date they had set", async () => {
        await member.addTargetExam(SAM.userId, { examCode: "CE", examDate: "2027-05-01" });
        await member.removeTargetExam(SAM.userId, "CE");
        later(NOW + MINUTE);

        const result = await seam.grantAccess(OWNER, grant);

        expect(result).toMatchObject({ ok: true, value: { targetExam: "restored" } });
        expect(await member.listTargetExams(SAM.userId)).toEqual([
          expect.objectContaining({ examCode: "ME" }),
          expect.objectContaining({ examCode: "CE", examDate: "2027-05-01", dateSetBy: "member" }),
        ]);
      });

      it("leaves a Target Exam the Member has alone", async () => {
        const before = await member.listTargetExams(BEA.userId);
        await seam.grantAccess(OWNER, { ...grant, userId: BEA.userId });
        expect(await member.listTargetExams(BEA.userId)).toEqual(before);
      });

      it("adds an Exam that isn't on the Website, which an Owner can grant for a beta", async () => {
        const result = await seam.grantAccess(OWNER, { ...grant, examCode: UNUSED_EXAM.code });

        expect(result).toMatchObject({ ok: true, value: { targetExam: "added" } });
        expect(await codes(SAM.userId)).toEqual(["ME", UNUSED_EXAM.code]);
      });
    });

    it.each([
      ["0 days", 0],
      ["366 days", 366],
      ["a part of a day", 1.5],
      ["days that aren't a number", "thirty"],
    ])("refuses %s, and changes nothing", async (_, days) => {
      const before = await snapshot();

      // Days the panel can't send, as a forged request might.
      const result = await seam.grantAccess(OWNER, { ...grant, days });

      expect(result).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { days: ["GRANT 1 TO 365 WHOLE DAYS"] } },
      });
      expect(await snapshot()).toEqual(before);
    });

    it.each([
      ["an empty reason", ""],
      ["a reason of spaces", "   "],
    ])("refuses %s, and changes nothing", async (_, reason) => {
      const before = await snapshot();

      const result = await seam.grantAccess(OWNER, { ...grant, reason });

      expect(result).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { reason: [expect.any(String)] } },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("refuses an Exam that isn't in the catalogue, and changes nothing", async () => {
      const before = await snapshot();

      const result = await seam.grantAccess(OWNER, { ...grant, examCode: "XX" });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { examCode: [expect.stringMatching(/isn’t an Exam/i)] },
        },
      });
      expect(await snapshot()).toEqual(before);
    });

    it.each([NOBODY, "not-a-uuid"])("answers not-found for the Member %j", async (userId) => {
      expect(await seam.grantAccess(OWNER, { ...grant, userId })).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses an Editor, and changes nothing", async () => {
      const before = await snapshot();
      expect(await seam.grantAccess(EDITOR, grant)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("extendAccess", () => {
    const extend = {
      userId: BEA.userId,
      examCode: "CE",
      days: 7,
      reason: "Payment confirmed late",
    };

    it("adds the days to the end of the pass", async () => {
      const result = await seam.extendAccess(OWNER, extend);

      expect(result).toEqual({
        ok: true,
        tags: [],
        value: {
          userId: BEA.userId,
          examCode: "CE",
          endsBefore: at(90 * DAY),
          endsAt: at(97 * DAY),
          days: 7,
          reason: "Payment confirmed late",
          targetExam: null,
        },
      });
      expect(await passOf(BEA.userId)).toMatchObject({ endsAt: at(97 * DAY) });
    });

    it("starts from now on a pass that has ended", async () => {
      await seam.extendAccess(OWNER, { ...extend, userId: LOU.userId, days: 14 });
      expect(await passOf(LOU.userId)).toMatchObject({ endsAt: at(NOW + 14 * DAY) });
    });

    it("keeps its days as a history row, and records it in Staff Activity", async () => {
      await seam.extendAccess(OWNER, extend);

      const detail = await seam.getMemberForAdmin(OWNER, BEA.userId);
      expect(detail.ok && detail.value.accessPasses[0]?.grants).toEqual([
        expect.objectContaining({ days: 7, startsAt: at(90 * DAY), endsAt: at(97 * DAY) }),
      ]);
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "access-pass",
          entityId: `${BEA.userId}/CE`,
          action: "extend-access",
          before: { email: BEA.email, examCode: "CE", endsAt: at(90 * DAY) },
          after: {
            email: BEA.email,
            examCode: "CE",
            endsAt: at(97 * DAY),
            days: 7,
            reason: "Payment confirmed late",
          },
        }),
      ]);
    });

    it("leaves the Member a notice with the new end", async () => {
      await seam.extendAccess(OWNER, extend);
      expect((await member.listNotices(BEA.userId)).map(noticeText)).toEqual([
        "Your CE access was extended to 22 Feb 2027",
      ]);
    });

    it("leaves the Member's Target Exams alone", async () => {
      await member.addTargetExam(BEA.userId, { examCode: "ME", examDate: ME_DATE });
      await member.removeTargetExam(BEA.userId, "CE");
      await seam.extendAccess(OWNER, extend);
      expect(await codes(BEA.userId)).toEqual(["ME"]);
    });

    it.each([
      ["12 days", 12],
      ["a grant's 90 days", 90],
      ["0 days", 0],
    ])("refuses %s, and changes nothing", async (_, days) => {
      const before = await snapshot();
      const result = await seam.extendAccess(OWNER, { ...extend, days });
      expect(result).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { days: ["PICK 3, 7, 14 OR 30 DAYS"] } },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("refuses a reason of spaces, and changes nothing", async () => {
      const before = await snapshot();
      expect(await seam.extendAccess(OWNER, { ...extend, reason: "  " })).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { reason: [expect.any(String)] } },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("says there's no pass to extend for a Member without one, and changes nothing", async () => {
      const before = await snapshot();

      const result = await seam.extendAccess(OWNER, { ...extend, userId: SAM.userId });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: expect.stringMatching(/no CE Access Pass to extend/),
        },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("refuses an Editor, and changes nothing", async () => {
      const before = await snapshot();
      expect(await seam.extendAccess(EDITOR, extend)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("endAccess", () => {
    const end = { userId: BEA.userId, examCode: "CE", reason: "Granted by mistake" };

    it("sets the pass's end to now, so the Member sees the expired state", async () => {
      const result = await seam.endAccess(OWNER, end);

      expect(result).toEqual({
        ok: true,
        tags: [],
        value: {
          userId: BEA.userId,
          examCode: "CE",
          endsBefore: at(90 * DAY),
          endsAt: at(NOW),
          days: null,
          reason: "Granted by mistake",
          targetExam: null,
        },
      });
      expect(await passOf(BEA.userId)).toMatchObject({ endsAt: at(NOW) });
      expect(await decisionFor(BEA.userId)).toEqual({ outcome: "expired", passEndedAt: at(NOW) });
    });

    it("keeps the Member's progress", async () => {
      const card = await seam.createCard(EDITOR, {
        topic: sampleTopicId("CE", "MSTC", "Surveying"),
        front: "What is a benchmark?",
        back: "A point of known elevation",
        note: "",
      });
      if (!card.ok) throw new Error(`No card: ${JSON.stringify(card)}`);
      await arm.putCardMark({
        userId: BEA.userId,
        cardId: card.value.id,
        verdict: "got",
        markedAt: at(NOW),
      });
      const marks = await arm.cardMarks();
      const targetExams = await member.listTargetExams(BEA.userId);

      await seam.endAccess(OWNER, end);

      expect(await arm.cardMarks()).toEqual(marks);
      expect(await member.listTargetExams(BEA.userId)).toEqual(targetExams);
    });

    it("records it in Staff Activity and leaves the Member a notice", async () => {
      await seam.endAccess(OWNER, end);

      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "access-pass",
          entityId: `${BEA.userId}/CE`,
          action: "end-access",
          before: { email: BEA.email, examCode: "CE", endsAt: at(90 * DAY) },
          after: {
            email: BEA.email,
            examCode: "CE",
            endsAt: at(NOW),
            reason: "Granted by mistake",
          },
        }),
      ]);
      expect((await member.listNotices(BEA.userId)).map(noticeText)).toEqual([
        "Your CE access has ended",
      ]);
    });

    it("adds no history row: the grants that made the pass stay as they were", async () => {
      await seam.grantAccess(OWNER, { ...end, days: 30 });
      const grants = async () => {
        const detail = await seam.getMemberForAdmin(OWNER, BEA.userId);
        return detail.ok ? detail.value.accessPasses[0]?.grants : null;
      };
      const before = await grants();

      await seam.endAccess(OWNER, end);

      expect(await grants()).toEqual(before);
    });

    it("lets a later grant start again from now", async () => {
      await seam.endAccess(OWNER, end);
      later(NOW + MINUTE);
      await seam.grantAccess(OWNER, { ...end, days: 30 });
      expect(await passOf(BEA.userId)).toMatchObject({ endsAt: at(NOW + MINUTE + 30 * DAY) });
    });

    it("says a pass that has already ended has nothing to end, and changes nothing", async () => {
      const before = await snapshot();

      const result = await seam.endAccess(OWNER, { ...end, userId: LOU.userId });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: expect.stringMatching(/CE Access Pass has already ended/),
        },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("says a pass ended just now has nothing to end", async () => {
      await seam.endAccess(OWNER, end);
      const before = await snapshot();
      expect(await seam.endAccess(OWNER, end)).toMatchObject({ ok: false });
      expect(await snapshot()).toEqual(before);
    });

    it("says there's no pass to end for a Member without one, and changes nothing", async () => {
      const before = await snapshot();
      expect(await seam.endAccess(OWNER, { ...end, userId: SAM.userId })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: expect.stringMatching(/no CE Access Pass to end/),
        },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("refuses a reason of spaces, and changes nothing", async () => {
      const before = await snapshot();
      expect(await seam.endAccess(OWNER, { ...end, reason: " " })).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { reason: [expect.any(String)] } },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("refuses an Editor, and changes nothing", async () => {
      const before = await snapshot();
      expect(await seam.endAccess(EDITOR, end)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await snapshot()).toEqual(before);
    });
  });

  it("writes nothing when Staff Activity can't be written", async () => {
    const before = {
      passes: await member.listAccessPasses(SAM.userId),
      codes: await codes(SAM.userId),
    };
    const restore = await arm.breakStaffActivity();
    try {
      await expect(
        seam.grantAccess(OWNER, { userId: SAM.userId, examCode: "CE", days: 30, reason: "Beta" }),
      ).rejects.toThrow();
    } finally {
      await restore();
    }
    expect(await member.listAccessPasses(SAM.userId)).toEqual(before.passes);
    expect(await codes(SAM.userId)).toEqual(before.codes);
    expect(await member.listNotices(SAM.userId)).toEqual([]);
  });
});
