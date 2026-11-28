import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { samplePlanId } from "@/services/mock/plans";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";
import { CE_OFFICIAL, withExamDates } from "../../test/member-inputs";

// The Member seam's Plans read (Phase 4, ticket 02; spec, Phase 4 planning
// decisions → Who buys, and which Exams; Phase 4 seams → Member seam,
// extended; stories 134 and 151c), run against every arm. The Plans page
// shows each Exam with at least one Plan on sale, and for the signed-in
// Member, when their own Access Pass for it ends and the Exam Date a Plan
// would count towards. A Plan switched off isn't there. Nothing another
// Member holds is ever read.
//
// The data: the starting Plans, on sale (CE 30/90/180 days, every other
// Exam 30 days); CE has an Official Exam Date (21 Nov 2026), and CHE is an
// Exam with no Product, so it isn't on the Website. "Now" is 17 Nov 2026,
// 11:42 in Manila.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
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

const inDays = (days: number) => new Date(BOOT.getTime() + days * DAY).toISOString();

describe.each(MEMBER_ARMS)("Member seam: Plans ($name)", (arm) => {
  const { seam, admin } = arm;

  const exam = async (userId: string, code: string) =>
    (await seam.listMemberPlans(userId)).find((candidate) => candidate.examCode === code);

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset(withExamDates);
    await seam.getOrCreateMember(BEA);
    await seam.getOrCreateMember(SAM);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("listMemberPlans", () => {
    it("gives each Exam on the Website with a Plan on sale, in the catalogue's order", async () => {
      const exams = await seam.listMemberPlans(BEA.userId);

      // CHE has a Plan on sale too, but isn't on the Website, so no Member can study it.
      expect(exams.map((candidate) => candidate.examCode)).toEqual(["CE", "ME", "EE", "MT", "CPA"]);
    });

    it("gives an Exam's Plans on sale, shortest first, with their names, days, prices and Best value", async () => {
      expect(await exam(BEA.userId, "CE")).toEqual({
        examCode: "CE",
        board: "CELE",
        name: "Civil Engineering",
        plans: [
          {
            id: samplePlanId("CE", 30),
            name: "CE All-Access",
            days: 30,
            priceCentavos: 49_900,
            bestValue: false,
          },
          {
            id: samplePlanId("CE", 90),
            name: "CE All-Access",
            days: 90,
            priceCentavos: 129_900,
            bestValue: true,
          },
          {
            id: samplePlanId("CE", 180),
            name: "CE All-Access",
            days: 180,
            priceCentavos: 229_900,
            bestValue: false,
          },
        ],
        passEndsAt: null,
        examDate: CE_OFFICIAL,
      });
    });

    it("leaves out a Plan switched off", async () => {
      expect(await admin.setPlanOnSale(OWNER, samplePlanId("CE", 30), false)).toMatchObject({
        ok: true,
      });

      expect((await exam(BEA.userId, "CE"))?.plans.map((plan) => plan.days)).toEqual([90, 180]);
    });

    it("leaves out an Exam once its last Plan on sale is switched off", async () => {
      expect(await admin.setPlanOnSale(OWNER, samplePlanId("ME", 30), false)).toMatchObject({
        ok: true,
      });

      const codes = (await seam.listMemberPlans(BEA.userId)).map((candidate) => candidate.examCode);
      expect(codes).toEqual(["CE", "EE", "MT", "CPA"]);
    });

    it("gives when the Member's own Access Pass ends, ended or not", async () => {
      await arm.putAccessPass({ userId: BEA.userId, examCode: "CE", endsAt: inDays(20) });
      await arm.putAccessPass({ userId: BEA.userId, examCode: "ME", endsAt: inDays(-3) });

      expect((await exam(BEA.userId, "CE"))?.passEndsAt).toBe(inDays(20));
      expect((await exam(BEA.userId, "ME"))?.passEndsAt).toBe(inDays(-3));
      expect((await exam(BEA.userId, "EE"))?.passEndsAt).toBeNull();
    });

    it("never gives another Member's Access Pass", async () => {
      await arm.putAccessPass({ userId: SAM.userId, examCode: "CE", endsAt: inDays(200) });

      expect((await exam(BEA.userId, "CE"))?.passEndsAt).toBeNull();
      expect((await exam(SAM.userId, "CE"))?.passEndsAt).toBe(inDays(200));
    });

    it("gives the Member's own Exam Date for a Target Exam", async () => {
      await seam.addTargetExam(BEA.userId, { examCode: "ME", examDate: "2027-03-14" });

      expect((await exam(BEA.userId, "ME"))?.examDate).toBe("2027-03-14");
    });

    it("never gives another Member's Exam Date", async () => {
      await seam.addTargetExam(SAM.userId, { examCode: "ME", examDate: "2027-03-14" });

      expect((await exam(BEA.userId, "ME"))?.examDate).toBeNull();
    });

    it("gives the Official Exam Date for an Exam that isn't one of the Member's", async () => {
      expect((await exam(BEA.userId, "CE"))?.examDate).toBe(CE_OFFICIAL);
      expect((await exam(BEA.userId, "EE"))?.examDate).toBeNull();
    });

    it("throws for a User id that isn't one", async () => {
      await expect(seam.listMemberPlans("not-a-user-id")).rejects.toThrow();
    });
  });

  describe("listExamsOnSale", () => {
    it("gives the codes of the Exams on the Website with a Plan on sale, in order", async () => {
      expect(await seam.listExamsOnSale()).toEqual(["CE", "ME", "EE", "MT", "CPA"]);
    });

    it("leaves out an Exam with nothing on sale", async () => {
      await admin.setPlanOnSale(OWNER, samplePlanId("EE", 30), false);

      expect(await seam.listExamsOnSale()).toEqual(["CE", "ME", "MT", "CPA"]);
    });
  });
});
