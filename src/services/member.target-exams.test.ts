import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";
import { CE_OFFICIAL, withExamDates } from "../../test/member-inputs";

// The Member seam's Target Exams (spec, Phase 3 → Target Exams and the
// 2026-11-17 Target Exams decisions; stories 84–88, 133g), run against every
// arm. A Member has any number of Target Exams: an Exam plus an Exam Date,
// which follows the Exam's Official Exam Date until the Member edits it. One
// is the selected one. A removed Target Exam is kept, and adding it back
// restores it.
//
// The data: CE has an Official Exam Date (21 Nov 2026), ME has none, and CHE
// is an Exam with no Product, so it isn't on the Website. "Now" is 17 Nov
// 2026, 11:42 in Manila.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const EDITOR = sampleActor("editor");

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

const refused = (kind: string) => ({ ok: false, error: kind });

describe.each(MEMBER_ARMS)("Member seam: Target Exams ($name)", (arm) => {
  const { seam, admin } = arm;
  const later = (ms: number) => vi.setSystemTime(new Date(BOOT.getTime() + ms));

  /** A Staff User changes an Exam's Official Exam Date in the Admin. */
  async function staffSetOfficialDate(code: string, officialExamDate: string) {
    const opened = await admin.getExamPageForAdmin(EDITOR, code);
    if (!opened) throw new Error(`No Exam page for ${code}`);
    const result = await admin.updateOfficialExamDate(
      EDITOR,
      code,
      { officialExamDate },
      opened.stamps.officialExamDate,
    );
    expect(result).toMatchObject({ ok: true });
  }

  const codes = async (userId: string) =>
    (await seam.listTargetExams(userId)).map((exam) => exam.examCode);
  const selected = async (userId: string) =>
    (await seam.listTargetExams(userId)).find((exam) => exam.selected)?.examCode ?? null;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset(withExamDates);
    await seam.getOrCreateMember(BEA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("listPickableExams", () => {
    it("lists the Exams on the Website, in their order, each with its Official Exam Date", async () => {
      const exams = await seam.listPickableExams();

      expect(exams.map((exam) => exam.code)).toEqual(["CE", "ME", "EE", "MT", "CPA"]);
      expect(exams[0]).toEqual({
        code: "CE",
        board: "CELE",
        name: "Civil Engineering",
        officialExamDate: CE_OFFICIAL,
      });
      expect(exams[1]).toMatchObject({ code: "ME", officialExamDate: null });
    });
  });

  describe("addTargetExam", () => {
    it("starts a Member with no Target Exams", async () => {
      expect(await seam.listTargetExams(BEA.userId)).toEqual([]);
    });

    it("adds the first one, selected, following the Official Exam Date the Member kept", async () => {
      const result = await seam.addTargetExam(BEA.userId, {
        examCode: "CE",
        examDate: CE_OFFICIAL,
      });

      const ce = {
        examCode: "CE",
        board: "CELE",
        name: "Civil Engineering",
        examDate: CE_OFFICIAL,
        dateSetBy: "official",
        selected: true,
        addedAt: BOOT.toISOString(),
      };
      expect(result).toEqual({ ok: true, value: { targetExam: ce, restored: false } });
      expect(await seam.listTargetExams(BEA.userId)).toEqual([ce]);
    });

    it("follows the Official Exam Date when the Member sends no date", async () => {
      const result = await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: null });

      expect(result).toMatchObject({
        ok: true,
        value: { targetExam: { examDate: CE_OFFICIAL, dateSetBy: "official" } },
      });
    });

    it("keeps the Member's own date when they changed it", async () => {
      const result = await seam.addTargetExam(BEA.userId, {
        examCode: "CE",
        examDate: "2027-04-18",
      });

      expect(result).toMatchObject({
        ok: true,
        value: { targetExam: { examDate: "2027-04-18", dateSetBy: "member" } },
      });
    });

    it("takes the Exam's code in any case", async () => {
      expect(
        await seam.addTargetExam(BEA.userId, { examCode: " ce ", examDate: null }),
      ).toMatchObject({ ok: true, value: { targetExam: { examCode: "CE" } } });
    });

    it("lets today in Manila be the Exam Date", async () => {
      expect(
        await seam.addTargetExam(BEA.userId, { examCode: "ME", examDate: "2026-11-17" }),
      ).toMatchObject({ ok: true });
    });

    it("adds more, in the order added, and selects the one just added", async () => {
      await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: null });
      later(60_000);
      await seam.addTargetExam(BEA.userId, { examCode: "ME", examDate: "2027-02-08" });

      expect(await codes(BEA.userId)).toEqual(["CE", "ME"]);
      expect(await selected(BEA.userId)).toBe("ME");
    });

    it("needs a date for an Exam with no Official Exam Date, and adds nothing", async () => {
      for (const examDate of [null, "", "   "]) {
        expect(await seam.addTargetExam(BEA.userId, { examCode: "ME", examDate })).toEqual(
          refused("date-required"),
        );
      }
      expect(await seam.listTargetExams(BEA.userId)).toEqual([]);
    });

    it.each([
      ["yesterday in Manila", "2026-11-16", "date-in-past"],
      ["a date long past", "2020-01-01", "date-in-past"],
      ["a date that isn't on the calendar", "2027-02-30", "invalid-date"],
      ["something that isn't a date", "next year", "invalid-date"],
    ])("refuses %s, and adds nothing", async (_label, examDate, kind) => {
      expect(await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate })).toEqual(
        refused(kind),
      );
      expect(await seam.listTargetExams(BEA.userId)).toEqual([]);
    });

    it.each([
      ["an Exam that isn't on the Website", "CHE"],
      ["an Exam that doesn't exist", "XYZ"],
      ["a blank code", ""],
      ["something that isn't a code", "CE'; drop table members; --"],
    ])("refuses %s, and adds nothing", async (_label, examCode) => {
      expect(await seam.addTargetExam(BEA.userId, { examCode, examDate: "2027-04-18" })).toEqual(
        refused("not-an-exam"),
      );
      expect(await seam.listTargetExams(BEA.userId)).toEqual([]);
    });

    it("refuses an Exam that's already one of the Member's Target Exams, and changes nothing", async () => {
      await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: "2027-04-18" });
      const before = await seam.listTargetExams(BEA.userId);

      expect(
        await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: "2027-10-10" }),
      ).toEqual(refused("already-yours"));
      expect(await seam.listTargetExams(BEA.userId)).toEqual(before);
    });

    it("refuses a User with no Member record, such as someone the gate turned away", async () => {
      await expect(
        seam.addTargetExam(SAM.userId, { examCode: "CE", examDate: null }),
      ).rejects.toThrow();
      expect(await seam.listTargetExams(SAM.userId)).toEqual([]);
    });

    it("refuses a User id that isn't one", async () => {
      await expect(seam.listTargetExams("not-a-uuid")).rejects.toThrow();
      await expect(
        seam.addTargetExam("not-a-uuid", { examCode: "CE", examDate: null }),
      ).rejects.toThrow();
    });
  });

  describe("the Exam Date and the Official Exam Date", () => {
    it("moves a Member who never edited their date when Staff change the Official Exam Date", async () => {
      await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: CE_OFFICIAL });

      await staffSetOfficialDate("CE", "2027-04-24");

      expect(await seam.listTargetExams(BEA.userId)).toMatchObject([
        { examCode: "CE", examDate: "2027-04-24", dateSetBy: "official" },
      ]);
    });

    it("leaves a Member who set their own date where they put it", async () => {
      await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: "2027-04-18" });

      await staffSetOfficialDate("CE", "2027-04-24");

      expect(await seam.listTargetExams(BEA.userId)).toMatchObject([
        { examCode: "CE", examDate: "2027-04-18", dateSetBy: "member" },
      ]);
    });

    it("has no date when Staff clear the Official Exam Date of a Member who never set one", async () => {
      await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: null });

      await staffSetOfficialDate("CE", "");

      expect(await seam.listTargetExams(BEA.userId)).toMatchObject([
        { examCode: "CE", examDate: null, dateSetBy: null },
      ]);
    });
  });

  describe("setExamDate", () => {
    beforeEach(async () => {
      await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: null });
    });

    it("makes the date the Member's own, and it stops following the Official Exam Date", async () => {
      const result = await seam.setExamDate(BEA.userId, "ce", "2027-04-18");

      expect(result).toMatchObject({
        ok: true,
        value: { examCode: "CE", examDate: "2027-04-18", dateSetBy: "member" },
      });
      await staffSetOfficialDate("CE", "2027-04-24");
      expect(await seam.listTargetExams(BEA.userId)).toMatchObject([{ examDate: "2027-04-18" }]);
    });

    it("keeps following when the date saved is the Official Exam Date they already follow", async () => {
      expect(await seam.setExamDate(BEA.userId, "CE", CE_OFFICIAL)).toMatchObject({
        ok: true,
        value: { examDate: CE_OFFICIAL, dateSetBy: "official" },
      });
      await staffSetOfficialDate("CE", "2027-04-24");

      expect(await seam.listTargetExams(BEA.userId)).toMatchObject([
        { examDate: "2027-04-24", dateSetBy: "official" },
      ]);
    });

    it("lets a Member who follows a passed Official Exam Date save it unchanged", async () => {
      vi.setSystemTime(new Date("2026-11-25T03:42:00.000Z"));
      expect(await seam.setExamDate(BEA.userId, "CE", CE_OFFICIAL)).toMatchObject({ ok: true });
    });

    it.each([
      ["a date in the past", "2026-11-16", "date-in-past"],
      ["a date that isn't one", "2027-13-01", "invalid-date"],
      ["no date", "", "date-required"],
    ])("refuses %s, and keeps the date as it was", async (_label, examDate, kind) => {
      expect(await seam.setExamDate(BEA.userId, "CE", examDate)).toEqual(refused(kind));
      expect(await seam.listTargetExams(BEA.userId)).toMatchObject([
        { examDate: CE_OFFICIAL, dateSetBy: "official" },
      ]);
    });

    it.each(["ME", "CHE", "XYZ", ""])(
      "refuses %j, which isn't one of the Member's Target Exams",
      async (examCode) => {
        expect(await seam.setExamDate(BEA.userId, examCode, "2027-04-18")).toEqual(
          refused("not-yours"),
        );
      },
    );
  });

  describe("selectTargetExam", () => {
    beforeEach(async () => {
      await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: null });
      later(60_000);
      await seam.addTargetExam(BEA.userId, { examCode: "ME", examDate: "2027-02-08" });
    });

    it("switches to another Target Exam, and remembers it", async () => {
      expect(await seam.selectTargetExam(BEA.userId, "ce")).toMatchObject({
        ok: true,
        value: { examCode: "CE", selected: true },
      });

      expect(await selected(BEA.userId)).toBe("CE");
      expect(await codes(BEA.userId)).toEqual(["CE", "ME"]);
    });

    it("refuses an Exam that isn't one of the Member's, and keeps the selection", async () => {
      expect(await seam.selectTargetExam(BEA.userId, "EE")).toEqual(refused("not-yours"));
      expect(await selected(BEA.userId)).toBe("ME");
    });
  });

  describe("removeTargetExam", () => {
    beforeEach(async () => {
      await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: "2027-04-18" });
      later(60_000);
      await seam.addTargetExam(BEA.userId, { examCode: "ME", examDate: "2027-02-08" });
      later(120_000);
      await seam.addTargetExam(BEA.userId, { examCode: "EE", examDate: "2027-09-01" });
    });

    it("takes the Target Exam off the Member's list", async () => {
      expect(await seam.removeTargetExam(BEA.userId, "me")).toMatchObject({
        ok: true,
        value: { examCode: "ME" },
      });
      expect(await codes(BEA.userId)).toEqual(["CE", "EE"]);
    });

    it("keeps the selection when another one is removed", async () => {
      await seam.removeTargetExam(BEA.userId, "CE");
      expect(await selected(BEA.userId)).toBe("EE");
    });

    it("falls back to the first remaining one, by the order added, when the selected one is removed", async () => {
      await seam.removeTargetExam(BEA.userId, "EE");
      expect(await selected(BEA.userId)).toBe("CE");
    });

    it("refuses to remove the Member's last Target Exam", async () => {
      await seam.removeTargetExam(BEA.userId, "CE");
      await seam.removeTargetExam(BEA.userId, "ME");

      expect(await seam.removeTargetExam(BEA.userId, "EE")).toEqual(refused("last-one"));
      expect(await codes(BEA.userId)).toEqual(["EE"]);
    });

    it("refuses an Exam that isn't one of the Member's, or was removed already", async () => {
      expect(await seam.removeTargetExam(BEA.userId, "MT")).toEqual(refused("not-yours"));
      await seam.removeTargetExam(BEA.userId, "ME");
      expect(await seam.removeTargetExam(BEA.userId, "ME")).toEqual(refused("not-yours"));
      expect(await codes(BEA.userId)).toEqual(["CE", "EE"]);
    });

    it("no longer lets a removed one be selected or have its date edited", async () => {
      await seam.removeTargetExam(BEA.userId, "ME");

      expect(await seam.selectTargetExam(BEA.userId, "ME")).toEqual(refused("not-yours"));
      expect(await seam.setExamDate(BEA.userId, "ME", "2027-05-05")).toEqual(refused("not-yours"));
    });

    it("restores a removed one when it's added again, with its own date and its place, selected", async () => {
      await seam.selectTargetExam(BEA.userId, "CE");
      await seam.removeTargetExam(BEA.userId, "ME");
      later(180_000);

      const result = await seam.addTargetExam(BEA.userId, {
        examCode: "ME",
        examDate: "2027-12-12",
      });

      expect(result).toEqual({
        ok: true,
        value: {
          restored: true,
          targetExam: {
            examCode: "ME",
            board: "MELE",
            name: "Mechanical Engineering",
            examDate: "2027-02-08",
            dateSetBy: "member",
            selected: true,
            addedAt: new Date(BOOT.getTime() + 60_000).toISOString(),
          },
        },
      });
      expect(await codes(BEA.userId)).toEqual(["CE", "ME", "EE"]);
    });

    it("restores one that followed the Official Exam Date still following it", async () => {
      // Start again, with CE following the Official Exam Date this time.
      await arm.reset(withExamDates);
      await seam.getOrCreateMember(BEA);
      await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: null });
      await seam.addTargetExam(BEA.userId, { examCode: "ME", examDate: "2027-02-08" });
      await seam.removeTargetExam(BEA.userId, "CE");
      await staffSetOfficialDate("CE", "2027-04-24");

      expect(
        await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: "2027-12-12" }),
      ).toMatchObject({
        ok: true,
        value: { restored: true, targetExam: { examDate: "2027-04-24", dateSetBy: "official" } },
      });
    });
  });

  describe("an Exam an Owner deletes", () => {
    it("leaves the Member's other Target Exams as they were, and can no longer be picked", async () => {
      await seam.addTargetExam(BEA.userId, { examCode: "ME", examDate: "2027-02-08" });
      // CHE has no Product, so it's the one Exam an Owner can delete.
      expect(await admin.deleteExam(sampleActor("owner"), "CHE")).toMatchObject({ ok: true });

      expect(await codes(BEA.userId)).toEqual(["ME"]);
      expect(await seam.addTargetExam(BEA.userId, { examCode: "CHE", examDate: null })).toEqual(
        refused("not-an-exam"),
      );
    });
  });

  describe("one Member and another", () => {
    beforeEach(async () => {
      await seam.getOrCreateMember(SAM);
      await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: "2027-04-18" });
      await seam.addTargetExam(BEA.userId, { examCode: "ME", examDate: "2027-02-08" });
    });

    it("never gives one Member another's Target Exams", async () => {
      expect(await seam.listTargetExams(SAM.userId)).toEqual([]);
    });

    it("never lets one Member change, select or remove another's Target Exams", async () => {
      const before = await seam.listTargetExams(BEA.userId);

      expect(await seam.setExamDate(SAM.userId, "CE", "2027-06-06")).toEqual(refused("not-yours"));
      expect(await seam.selectTargetExam(SAM.userId, "CE")).toEqual(refused("not-yours"));
      expect(await seam.removeTargetExam(SAM.userId, "CE")).toEqual(refused("not-yours"));

      expect(await seam.listTargetExams(BEA.userId)).toEqual(before);
    });

    it("gives each Member their own Target Exam for the same Exam, with their own date and selection", async () => {
      await seam.addTargetExam(SAM.userId, { examCode: "CE", examDate: null });

      expect(await seam.listTargetExams(SAM.userId)).toMatchObject([
        { examCode: "CE", examDate: CE_OFFICIAL, dateSetBy: "official", selected: true },
      ]);
      expect(await seam.listTargetExams(BEA.userId)).toMatchObject([
        { examCode: "CE", examDate: "2027-04-18", selected: false },
        { examCode: "ME", selected: true },
      ]);
    });
  });
});
