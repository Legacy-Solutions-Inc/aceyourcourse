import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MEMBER_ARMS } from "../../test/member-arms";
import { withExamDates } from "../../test/member-inputs";

// The Member seam's renewal reminders (Phase 4, ticket 12; spec, Phase 4
// planning decisions → Renewal reminders; Testing Decisions → Phase 4 seams;
// stories 141 and 142), run against every arm. A Member whose Access Pass
// ends within the next 7 Manila days gets one reminder per Exam, framed
// around their Exam Date; dismissing one hides it until the next Manila day,
// on every device. Staff get none, and a Member only ever reads or dismisses
// their own.
//
// "Now" starts at 17 Nov 2026, 10:00 in Manila (02:00 UTC). CE's Official
// Exam Date is 21 Nov; Bea sets her own, 19 Dec.
const BOOT = new Date("2026-11-17T02:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const inDays = (days: number) => new Date(BOOT.getTime() + days * DAY).toISOString();

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
const MEMBER = { activeStaff: false };

describe.each(MEMBER_ARMS)("Member seam: renewal reminders ($name)", (arm) => {
  const { seam } = arm;
  const later = (ms: number) => vi.setSystemTime(new Date(BOOT.getTime() + ms));
  const pass = (userId: string, examCode: string, endsAt: string) =>
    arm.putAccessPass({ userId, examCode, endsAt });
  const shown = async (userId: string) =>
    (await seam.listRenewalReminders(userId, MEMBER)).map((reminder) => reminder.examCode);

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset(withExamDates);
    for (const member of [BEA, SAM]) await seam.getOrCreateMember(member);
    await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: "2026-12-19" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reminds a Member whose CE pass ends in 5 days, 27 days before their exam", async () => {
    await pass(BEA.userId, "CE", inDays(5));

    expect(await seam.listRenewalReminders(BEA.userId, MEMBER)).toEqual([
      { examCode: "CE", endsAt: inDays(5), daysBeforeExam: 27 },
    ]);
  });

  it("reminds a Member with no pass, or one ending in 8 days, of nothing; one ending in exactly 7 days, of it", async () => {
    expect(await shown(BEA.userId)).toEqual([]);

    await pass(BEA.userId, "CE", inDays(8));
    expect(await shown(BEA.userId)).toEqual([]);

    later(DAY);
    expect(await shown(BEA.userId)).toEqual(["CE"]);
  });

  it("never reminds on a pass that has already ended", async () => {
    await pass(BEA.userId, "CE", inDays(-1));
    expect(await shown(BEA.userId)).toEqual([]);
  });

  it("gives no day count before the exam once the pass ends after the Exam Date, or with none", async () => {
    // Sam's CE follows the Official Exam Date, 21 Nov; his ME has no date at all.
    await seam.addTargetExam(SAM.userId, { examCode: "CE", examDate: null });
    await seam.addTargetExam(SAM.userId, { examCode: "ME", examDate: null });
    await pass(SAM.userId, "CE", inDays(5));
    await pass(SAM.userId, "ME", inDays(6));

    expect(await seam.listRenewalReminders(SAM.userId, MEMBER)).toEqual([
      { examCode: "CE", endsAt: inDays(5), daysBeforeExam: null },
      { examCode: "ME", endsAt: inDays(6), daysBeforeExam: null },
    ]);
  });

  it("never reminds Staff", async () => {
    await pass(BEA.userId, "CE", inDays(5));
    expect(await seam.listRenewalReminders(BEA.userId, { activeStaff: true })).toEqual([]);
  });

  it("reminds of two Exams ending soon, each dismissed on its own", async () => {
    await pass(BEA.userId, "CE", inDays(5));
    await pass(BEA.userId, "ME", inDays(3));
    expect(await shown(BEA.userId)).toEqual(["ME", "CE"]);

    expect(await seam.dismissRenewalReminder(BEA.userId, "CE")).toBe(true);
    expect(await shown(BEA.userId)).toEqual(["ME"]);

    expect(await seam.dismissRenewalReminder(BEA.userId, "me")).toBe(true);
    expect(await shown(BEA.userId)).toEqual([]);
  });

  it("hides a dismissed reminder for the rest of the Manila day, and brings it back the next", async () => {
    await pass(BEA.userId, "CE", inDays(5));
    await seam.dismissRenewalReminder(BEA.userId, "CE");

    // 23:59 the same day in Manila.
    later(14 * HOUR - 60_000);
    expect(await shown(BEA.userId)).toEqual([]);

    // 00:00 the next day in Manila, 16:00 UTC the same day.
    later(14 * HOUR);
    expect(await shown(BEA.userId)).toEqual(["CE"]);

    // Dismissed again that day, it's hidden again; dismissing twice changes nothing.
    expect(await seam.dismissRenewalReminder(BEA.userId, "CE")).toBe(true);
    expect(await seam.dismissRenewalReminder(BEA.userId, "CE")).toBe(true);
    expect(await shown(BEA.userId)).toEqual([]);
  });

  it("never hides another Member's reminder", async () => {
    await pass(BEA.userId, "CE", inDays(5));
    await pass(SAM.userId, "CE", inDays(5));

    await seam.dismissRenewalReminder(BEA.userId, "CE");

    expect(await shown(BEA.userId)).toEqual([]);
    expect(await shown(SAM.userId)).toEqual(["CE"]);
  });

  it("dismisses nothing for an Exam the Member holds no pass for", async () => {
    await pass(SAM.userId, "CE", inDays(5));

    expect(await seam.dismissRenewalReminder(BEA.userId, "CE")).toBe(false);
    expect(await seam.dismissRenewalReminder(BEA.userId, "NOT-AN-EXAM")).toBe(false);

    // Bea's later pass is reminded of: her refused dismissal kept nothing.
    await pass(BEA.userId, "CE", inDays(5));
    expect(await shown(BEA.userId)).toEqual(["CE"]);
  });

  it("throws for a User id that isn't one", async () => {
    await expect(seam.listRenewalReminders("nonsense", MEMBER)).rejects.toThrow();
    await expect(seam.dismissRenewalReminder("nonsense", "CE")).rejects.toThrow();
  });
});
