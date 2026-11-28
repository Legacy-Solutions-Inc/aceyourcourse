import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberAccess } from "@/lib/member-app/access";
import { PAYMONGO_SYSTEM_ACTOR } from "@/lib/payments/order-ledger";
import { sampleCourseId } from "@/services/mock/courses";
import { samplePlanId } from "@/services/mock/plans";
import { createFakePaymentsClient, type FakePaymentsClient } from "@/services/payments.fake";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";
import { CE_OFFICIAL, withExamDates } from "../../test/member-inputs";

// Buying a Course (Phase 5, ticket 06; spec, Phase 5 planning decisions →
// Buying a Course, The Order ledger for Course Orders; Testing Decisions →
// Phase 5 seams → Member seam), run against every arm with the payments
// fake. A separately sold, Visible Course on sale is bought through the
// Plans checkout: Pay makes a Pending Order holding the Course, with its
// name and price copied at Pay and no days. Paid grants Course Ownership,
// with the Order as its source, logged as "PayMongo (system)", and adds the
// Exam to the Member's Target Exams. A second paid Order for a Course
// already owned grants nothing and is marked for a refund. Pay is refused
// on the server for an owned Course, a Hidden one, one not on sale, an
// included one, and with no payments client.
//
// The data: "PSAD Masterclass" (CE · PSAD, sold separately at ₱1,499, on
// sale, owned by nobody), "HPGE Crash Course" (CE · HPGE, sold separately,
// not on sale) and "Surveying & Curves Lectures" (CE · MSTC, included in CE
// All-Access). "Now" is 28 Nov 2026, 20:00 in Manila.
const BOOT = new Date("2026-11-28T12:00:00.000Z");
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

const PSAD = sampleCourseId("PSAD Masterclass");
const HPGE = sampleCourseId("HPGE Crash Course");
const SURVEYING = sampleCourseId("Surveying & Curves Lectures");

describe.each(MEMBER_ARMS)("Member seam: buying a Course ($name)", (arm) => {
  const { seam, admin } = arm;
  let fake: FakePaymentsClient;

  const payFor = (courseId = PSAD, userId = BEA.userId, examCode = "CE") =>
    seam.payForCourse(userId, { examCode, courseId, method: "qrph" }, fake);
  /** Pays for the Course, then has the fake report `outcome` and asks for the Order's status. */
  async function bought(outcome: "paid" | "failed", userId = BEA.userId) {
    const result = await payFor(PSAD, userId);
    if (!result.ok) throw new Error(`Pay was refused: ${result.reason}`);
    const order = await seam.getMemberOrder(userId, result.reference);
    fake.simulate(order!.id, outcome);
    return seam.checkOrderStatus(userId, result.reference, fake);
  }
  const ownerships = () => arm.courseOwnerships();

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset(withExamDates);
    await seam.getOrCreateMember(BEA);
    await seam.getOrCreateMember(SAM);
    await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: CE_OFFICIAL });
    fake = createFakePaymentsClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("payForCourse", () => {
    it("makes a Pending Order holding the Course, its name and price copied, with no days", async () => {
      // References count on from the store's sequence (AYC-10001 on fresh sample data).
      const result = await payFor();
      if (!result.ok) throw new Error(`Pay was refused: ${result.reason}`);
      expect(result).toEqual({
        ok: true,
        reference: expect.stringMatching(/^AYC-\d{5,}$/),
        redirectTo: `/app/plans/orders/${result.reference}`,
      });

      expect(await arm.orders()).toEqual([
        expect.objectContaining({
          reference: result.reference,
          userId: BEA.userId,
          examCode: "CE",
          planId: null,
          courseId: PSAD,
          planName: "PSAD Masterclass",
          days: null,
          priceCentavos: 149_900,
          method: "qrph",
          status: "pending",
          paidAlreadyOwned: false,
        }),
      ]);
      expect(fake.started).toEqual([
        expect.objectContaining({
          reference: result.reference,
          description: "PSAD Masterclass · Video course · yours to keep",
          priceCentavos: 149_900,
          cancelPath: "/app/plans?exam=CE&payment=cancelled",
        }),
      ]);
    });

    it("keeps the price shown at Pay after an Owner changes it", async () => {
      await payFor();
      const changed = await admin.setCoursePrice(OWNER, { id: PSAD, price: "1999" });
      expect(changed.ok).toBe(true);

      expect((await arm.orders())[0]?.priceCentavos).toBe(149_900);
      await payFor();
      expect((await arm.orders())[1]?.priceCentavos).toBe(199_900);
    });

    it("is refused for a Course the Member already owns", async () => {
      await arm.putCourseOwnership({
        userId: BEA.userId,
        courseId: PSAD,
        since: BOOT.toISOString(),
        orderId: null,
      });

      expect(await payFor()).toEqual({ ok: false, reason: "owned" });
      expect(await arm.orders()).toEqual([]);
    });

    it("is refused for a Hidden Course", async () => {
      await admin.setCourseVisibility(OWNER, PSAD, false);

      expect(await payFor()).toEqual({ ok: false, reason: "not-on-sale" });
      expect(await arm.orders()).toEqual([]);
    });

    it("is refused for a Course not on sale", async () => {
      expect(await payFor(HPGE)).toEqual({ ok: false, reason: "not-on-sale" });
      expect(await arm.orders()).toEqual([]);
    });

    it("is refused for a Course included in All-Access", async () => {
      expect(await payFor(SURVEYING)).toEqual({ ok: false, reason: "not-on-sale" });
      expect(await arm.orders()).toEqual([]);
    });

    it("is refused for an id that isn't a Course's, or another Exam than the one posted", async () => {
      expect(await payFor("not-a-course")).toEqual({ ok: false, reason: "not-on-sale" });
      expect(await payFor(crypto.randomUUID())).toEqual({ ok: false, reason: "not-on-sale" });
      expect(await payFor(PSAD, BEA.userId, "ME")).toEqual({ ok: false, reason: "wrong-exam" });
      expect(await arm.orders()).toEqual([]);
    });

    it("is refused where buying isn't set up (no PayMongo key)", async () => {
      expect(
        await seam.payForCourse(
          BEA.userId,
          { examCode: "CE", courseId: PSAD, method: "qrph" },
          null,
        ),
      ).toEqual({ ok: false, reason: "unavailable" });
      expect(await arm.orders()).toEqual([]);
    });

    it("is refused for a method that isn't one of the four", async () => {
      expect(
        await seam.payForCourse(
          BEA.userId,
          { examCode: "CE", courseId: PSAD, method: "bitcoin" },
          fake,
        ),
      ).toEqual({ ok: false, reason: "bad-method" });
    });
  });

  describe("Paid", () => {
    it("grants Course Ownership with the Order as its source, and nothing else", async () => {
      const order = await bought("paid");

      expect(order).toMatchObject({
        status: "paid",
        courseId: PSAD,
        days: null,
        accessUntil: null,
      });
      const [paid] = await arm.orders();
      expect(await ownerships()).toEqual([
        { userId: BEA.userId, courseId: PSAD, since: BOOT.toISOString(), orderId: paid?.id },
      ]);
      expect(await seam.listAccessPasses(BEA.userId)).toEqual([]);
    });

    it("makes the Course the Member's own on the Courses screen", async () => {
      const before = await seam.openCourse(BEA.userId, PSAD, await memberAccess(BEA.userId));
      expect(before).toMatchObject({ status: "open", course: { owned: false } });

      await bought("paid");

      const after = await seam.openCourse(BEA.userId, PSAD, await memberAccess(BEA.userId));
      expect(after).toMatchObject({ status: "open", course: { owned: true } });
    });

    it("adds the Exam to the Member's Target Exams when it's missing", async () => {
      await seam.removeTargetExam(BEA.userId, "CE");
      await seam.addTargetExam(BEA.userId, { examCode: "ME", examDate: "2027-04-20" });

      await bought("paid");

      expect((await seam.listTargetExams(BEA.userId)).map(({ examCode }) => examCode)).toContain(
        "CE",
      );
    });

    it("logs the grant as PayMongo (system)", async () => {
      await bought("paid");
      const [order] = await arm.orders();

      const activity = await arm.adminArm.staffActivity();
      expect(activity).toContainEqual(
        expect.objectContaining({
          actor: PAYMONGO_SYSTEM_ACTOR,
          entity: "course-ownership",
          action: "order-paid",
          after: expect.objectContaining({ courseId: PSAD, reference: order?.reference }),
        }),
      );
    });

    it("grants once: the same paid outcome checked again changes nothing", async () => {
      const result = await payFor();
      if (!result.ok) throw new Error("Pay was refused.");
      const order = await seam.getMemberOrder(BEA.userId, result.reference);
      fake.simulate(order!.id, "paid");
      await seam.checkOrderStatus(BEA.userId, result.reference, fake);
      await seam.checkOrderStatus(BEA.userId, result.reference, fake);

      expect(await ownerships()).toHaveLength(1);
    });

    it("grants nothing on Failed", async () => {
      expect(await bought("failed")).toMatchObject({ status: "failed" });
      expect(await ownerships()).toEqual([]);
    });

    it("records a second paid Order for a Course already owned Paid, granting nothing, marked for a refund", async () => {
      // Two tabs: both Orders made before either is paid.
      const first = await payFor();
      const second = await payFor();
      if (!first.ok || !second.ok) throw new Error("Pay was refused.");
      for (const { reference } of [first, second]) {
        const order = await seam.getMemberOrder(BEA.userId, reference);
        fake.simulate(order!.id, "paid");
        await seam.checkOrderStatus(BEA.userId, reference, fake);
      }

      const orders = await arm.orders();
      expect(orders.map(({ status, paidAlreadyOwned }) => ({ status, paidAlreadyOwned }))).toEqual([
        { status: "paid", paidAlreadyOwned: false },
        { status: "paid", paidAlreadyOwned: true },
      ]);
      expect(await ownerships()).toEqual([
        expect.objectContaining({ userId: BEA.userId, courseId: PSAD, orderId: orders[0]?.id }),
      ]);
    });
  });

  describe("the Plans page's One-time purchases", () => {
    it("lists the Exam's separately sold, Visible Courses on sale, with their price", async () => {
      const ce = (await seam.listMemberPlans(BEA.userId)).find((exam) => exam.examCode === "CE");

      expect(ce?.courses).toEqual([
        { id: PSAD, title: "PSAD Masterclass", priceCentavos: 149_900, owned: false },
      ]);
    });

    it("marks a Course the Member owns", async () => {
      await bought("paid");

      const ce = (await seam.listMemberPlans(BEA.userId)).find((exam) => exam.examCode === "CE");
      expect(ce?.courses).toEqual([expect.objectContaining({ id: PSAD, owned: true })]);
    });

    it("leaves out a Hidden Course, and one taken off sale", async () => {
      await admin.setCourseVisibility(OWNER, PSAD, false);
      expect(
        (await seam.listMemberPlans(BEA.userId)).find((exam) => exam.examCode === "CE")?.courses,
      ).toEqual([]);

      await admin.setCourseVisibility(OWNER, PSAD, true);
      await admin.setCourseOnSale(OWNER, { id: PSAD, onSale: false });
      expect(
        (await seam.listMemberPlans(BEA.userId)).find((exam) => exam.examCode === "CE")?.courses,
      ).toEqual([]);
    });

    it("gives an Exam with only a Course on sale its pill", async () => {
      for (const days of [30, 90, 180] as const) {
        await admin.setPlanOnSale(OWNER, samplePlanId("CE", days), false);
      }

      const ce = (await seam.listMemberPlans(BEA.userId)).find((exam) => exam.examCode === "CE");
      expect(ce).toMatchObject({ plans: [], courses: [expect.objectContaining({ id: PSAD })] });
    });
  });

  /** The Member's side of the access decision now, as the server gathers it: their own passes. */
  async function memberAccess(userId: string): Promise<MemberAccess> {
    return {
      gate: "open",
      device: "active",
      activeStaff: false,
      passes: (await seam.listAccessPasses(userId)).map(({ examCode, endsAt }) => ({
        examCode,
        endsAt,
      })),
      now: new Date(),
    };
  }
});
