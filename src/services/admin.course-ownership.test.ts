import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_ORDER_QUERY } from "@/lib/admin/orders-list";
import type { MemberAccess } from "@/lib/member-app/access";
import { noticeText } from "@/lib/member-app/notices";
import type { Order } from "@/lib/payments/order-ledger";
import type { OrderListQuery } from "@/services/admin.types";
import { createFakeAuthAdmin } from "@/services/auth-admin.fake";
import {
  alreadyOwns,
  NOT_SOLD_SEPARATELY,
  notOwned,
  paidFor,
} from "@/services/course-ownership.core";
import { sampleCourseId, sampleLessonId } from "@/services/mock/courses";
import { samplePlanId } from "@/services/mock/plans";
import { createFakePaymentsClient, type FakePaymentsClient } from "@/services/payments.fake";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";
import { CE_OFFICIAL, withExamDates } from "../../test/member-inputs";

// ─────────────────────────────────────────────────────────────────────────────
// A Member's Courses through the Admin seam (Phase 5, ticket 07; spec, Phase
// 5 planning decisions → Giving a Course, Everywhere else, Course Orders
// follow Phase 4; Phase 4 planning decisions → Deleting an account that has
// Orders; stories 172, 182, 183), run over the Member arms, which carry the
// matching Admin arm, so Members can buy and watch.
//
// - "Give Course" (Owners only): a separately sold Course becomes the
//   Member's, given by Ace Your Course, with a notice and Staff Activity.
//   Refused for a Course they own already, and one included in All-Access.
// - "Remove Course" (Owners only): a given Course only; a paid one goes only
//   by a full refund in PayMongo.
// - Editors are refused both on the server, changing nothing.
// - The Member's page lists their Courses with each one's source.
// - Deleting an account removes its Course Ownerships and keeps its Course
//   Orders, detached; it's refused while a Course Order is Pending, and the
//   paid Orders it keeps count Course Orders. The data copy holds Course
//   Ownerships and Lesson progress.
//
// The data: "PSAD Masterclass" (CE · PSAD, sold separately at ₱1,499, on
// sale), "HPGE Crash Course" (CE · HPGE, sold separately, not on sale) and
// "Surveying & Curves Lectures" (CE · MSTC, included in CE All-Access, with a
// Free Preview Lesson). "Now" is 28 Nov 2026, 20:00 in Manila.
// ─────────────────────────────────────────────────────────────────────────────

const BOOT = new Date("2026-11-28T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");

const PSAD = sampleCourseId("PSAD Masterclass");
const HPGE = sampleCourseId("HPGE Crash Course");
const SURVEYING = sampleCourseId("Surveying & Curves Lectures");

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
/** A User id no Member has. */
const NOBODY = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

describe.each(MEMBER_ARMS)("Admin seam: a Member's Courses ($name)", (arm) => {
  const { seam, admin } = arm;
  let fake: FakePaymentsClient;

  const give = (courseId: string, userId = BEA.userId, actor = OWNER) =>
    admin.giveCourse(actor, { userId, courseId });
  const remove = (courseId: string, userId = BEA.userId, actor = OWNER) =>
    admin.removeCourse(actor, { userId, courseId });
  const refusedWith = (formError: string) => ({
    ok: false,
    error: { kind: "invalid", fieldErrors: {}, formError },
  });

  const accessOf = (): MemberAccess => ({
    gate: "open",
    device: "active",
    activeStaff: false,
    passes: [],
    now: new Date(),
  });
  /** A Course's card on the Member's Courses screen for CE. */
  const cardOf = async (courseId: string, userId = BEA.userId) =>
    (await seam.listCourses(userId, "CE", accessOf())).courses.find(
      (course) => course.id === courseId,
    );
  const noticeTexts = async (userId = BEA.userId) =>
    (await seam.listNotices(userId)).map(noticeText);
  const latestActivity = async () => (await arm.adminArm.staffActivity()).at(-1);
  const memberPage = async (userId = BEA.userId) => {
    const result = await admin.getMemberForAdmin(OWNER, userId);
    if (!result.ok) throw new Error(`Refused an Owner: ${result.error.kind}`);
    return result.value;
  };

  /** Everything a refused call must leave as it was. */
  const snapshot = async () => ({
    ownerships: await arm.courseOwnerships(),
    notices: await Promise.all([BEA, SAM].map(({ userId }) => seam.listNotices(userId))),
    targetExams: await Promise.all([BEA, SAM].map(({ userId }) => seam.listTargetExams(userId))),
    activity: await arm.adminArm.staffActivity(),
  });

  /** A Member pays for the PSAD Masterclass: the Pending Order's reference. */
  async function ordered(userId = BEA.userId) {
    const result = await seam.payForCourse(
      userId,
      { examCode: "CE", courseId: PSAD, method: "qrph" },
      fake,
    );
    if (!result.ok) throw new Error(`Pay was refused: ${result.reason}`);
    return result.reference;
  }

  /** PayMongo confirms the Member's Order: the fake says paid, and the status check records it. */
  async function confirmed(reference: string, userId = BEA.userId) {
    const order = await seam.getMemberOrder(userId, reference);
    if (!order) throw new Error(`No Order ${reference}`);
    fake.simulate(order.id, "paid");
    await seam.checkOrderStatus(userId, reference, fake);
  }

  /** A Member buys the PSAD Masterclass and PayMongo confirms it: the Order's reference. */
  async function bought(userId = BEA.userId) {
    const reference = await ordered(userId);
    await confirmed(reference, userId);
    return reference;
  }

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

  describe("giveCourse", () => {
    it("gives a Member a separately sold Course, not on sale too: OWNED on her Courses screen", async () => {
      expect((await cardOf(HPGE))?.owned).toBe(false);

      const result = await give(HPGE);

      expect(result).toEqual({
        ok: true,
        tags: [],
        value: {
          userId: BEA.userId,
          courseId: HPGE,
          course: "HPGE Crash Course",
          since: BOOT.toISOString(),
          targetExam: null,
        },
      });
      expect(await cardOf(HPGE)).toMatchObject({
        owned: true,
        decision: { outcome: "allowed" },
      });
    });

    it("tells her, and keeps it as given by Ace Your Course", async () => {
      await give(HPGE);

      expect(await noticeTexts()).toEqual(["You now own the HPGE Crash Course"]);
      expect(await seam.listOwnedCourses(BEA.userId)).toEqual([
        {
          courseId: HPGE,
          title: "HPGE Crash Course",
          examCode: "CE",
          since: BOOT.toISOString(),
          orderReference: null,
        },
      ]);
    });

    it("adds the Course's Exam to her Target Exams when she doesn't have it", async () => {
      expect(await seam.listTargetExams(SAM.userId)).toEqual([]);

      const result = await give(PSAD, SAM.userId);

      expect(result).toMatchObject({ ok: true, value: { targetExam: "added" } });
      expect((await seam.listTargetExams(SAM.userId)).map(({ examCode }) => examCode)).toEqual([
        "CE",
      ]);
    });

    it("logs it in Staff Activity, with who gave it", async () => {
      await give(HPGE);

      expect(await latestActivity()).toMatchObject({
        actor: { email: OWNER.email, name: OWNER.name },
        entity: "course-ownership",
        entityId: `${BEA.userId}:${HPGE}`,
        action: "give-course",
        before: null,
        after: {
          email: BEA.email,
          courseId: HPGE,
          course: "HPGE Crash Course",
          since: BOOT.toISOString(),
          targetExam: null,
        },
      });
    });

    it("lists the Course on her page in the Admin, with its source", async () => {
      await give(HPGE);
      vi.setSystemTime(new Date(BOOT.getTime() + HOUR));
      const reference = await bought();

      expect((await memberPage()).courses).toEqual([
        expect.objectContaining({ courseId: HPGE, orderReference: null }),
        expect.objectContaining({ courseId: PSAD, orderReference: reference }),
      ]);
    });

    it("refuses a Course she owns already, given or bought, changing nothing", async () => {
      await give(HPGE);
      await bought();
      const before = await snapshot();

      expect(await give(HPGE)).toEqual(refusedWith(alreadyOwns("HPGE Crash Course")));
      expect(await give(PSAD)).toEqual(refusedWith(alreadyOwns("PSAD Masterclass")));
      expect(await snapshot()).toEqual(before);
    });

    it("refuses a Course included in All-Access, or none, on the Course field", async () => {
      const before = await snapshot();
      const notToGive = {
        ok: false,
        error: { kind: "invalid", fieldErrors: { courseId: [NOT_SOLD_SEPARATELY] } },
      };

      expect(await give(SURVEYING)).toEqual(notToGive);
      expect(await give(crypto.randomUUID())).toEqual(notToGive);
      expect(await give("not-a-course")).toEqual(notToGive);
      expect(await snapshot()).toEqual(before);
    });

    it("answers not found for a User id no Member has", async () => {
      expect(await give(HPGE, NOBODY)).toEqual({ ok: false, error: { kind: "not-found" } });
    });

    it("refuses an Editor on the server, changing nothing", async () => {
      const before = await snapshot();

      expect(await give(HPGE, BEA.userId, EDITOR)).toEqual({
        ok: false,
        error: { kind: "forbidden", message: "ONLY AN OWNER CAN GIVE OR REMOVE A COURSE" },
      });
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("removeCourse", () => {
    it("removes a given Course: locked again on her Courses screen, with a notice", async () => {
      await give(HPGE);
      vi.setSystemTime(new Date(BOOT.getTime() + HOUR));

      const result = await remove(HPGE);

      expect(result).toEqual({
        ok: true,
        tags: [],
        value: {
          userId: BEA.userId,
          courseId: HPGE,
          course: "HPGE Crash Course",
          since: null,
          targetExam: null,
        },
      });
      expect(await seam.listOwnedCourses(BEA.userId)).toEqual([]);
      expect((await cardOf(HPGE))?.owned).toBe(false);
      expect(await noticeTexts()).toEqual([
        "You no longer own the HPGE Crash Course",
        "You now own the HPGE Crash Course",
      ]);
    });

    it("logs it in Staff Activity, with when it was given", async () => {
      await give(HPGE);
      await remove(HPGE);

      expect(await latestActivity()).toMatchObject({
        actor: { email: OWNER.email, name: OWNER.name },
        entity: "course-ownership",
        action: "remove-course",
        before: {
          email: BEA.email,
          courseId: HPGE,
          course: "HPGE Crash Course",
          since: BOOT.toISOString(),
        },
        after: null,
      });
    });

    it("refuses a paid Course: only a full refund in PayMongo removes it", async () => {
      const reference = await bought();
      const before = await snapshot();

      expect(await remove(PSAD)).toEqual(refusedWith(paidFor("PSAD Masterclass", reference)));
      expect(await snapshot()).toEqual(before);
    });

    it("refuses a given Course a Paid Order also holds: she paid for it", async () => {
      // She pays, an Owner gives it before PayMongo confirms, then the payment lands.
      const reference = await ordered();
      await give(PSAD);
      await confirmed(reference);
      const before = await snapshot();

      expect(await remove(PSAD)).toEqual(refusedWith(paidFor("PSAD Masterclass", reference)));
      expect(await snapshot()).toEqual(before);
    });

    it("refuses a Course she doesn't own", async () => {
      expect(await remove(HPGE)).toEqual(refusedWith(notOwned("HPGE Crash Course")));
    });

    it("refuses an Editor on the server, changing nothing", async () => {
      await give(HPGE);
      const before = await snapshot();

      expect(await remove(HPGE, BEA.userId, EDITOR)).toEqual({
        ok: false,
        error: { kind: "forbidden", message: "ONLY AN OWNER CAN GIVE OR REMOVE A COURSE" },
      });
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("the Orders admin and sales figures with Course Orders", () => {
    /** A live Order for Bea, paid at `paidAt`, behind the seam's back, as PayMongo's live payment would leave it. */
    const liveOrder = (reference: string, fields: Partial<Order>): Order => ({
      id: crypto.randomUUID(),
      reference,
      userId: BEA.userId,
      examCode: "CE",
      planId: null,
      courseId: PSAD,
      planName: "PSAD Masterclass",
      days: null,
      priceCentavos: 149_900,
      method: "gcash",
      status: "paid",
      livemode: true,
      checkoutId: `cs_${reference}`,
      paymentId: `pay_${reference}`,
      buyerName: BEA.name,
      buyerEmail: BEA.email,
      createdAt: new Date(BOOT.getTime() - HOUR).toISOString(),
      paidAt: new Date(BOOT.getTime() - HOUR).toISOString(),
      statusChangedAt: new Date(BOOT.getTime() - HOUR).toISOString(),
      paidWithoutAccount: false,
      paidAlreadyOwned: false,
      ...fields,
    });
    const PLAN = {
      planId: samplePlanId("CE", 90),
      courseId: null,
      planName: "CE All-Access",
      days: 90 as const,
      priceCentavos: 129_900,
    };
    const listed = async (fields: Partial<OrderListQuery>) => {
      const result = await admin.listOrdersForAdmin(OWNER, { ...DEFAULT_ORDER_QUERY, ...fields });
      if (!result.ok) throw new Error(`Refused an Owner: ${result.error.kind}`);
      return result.value.rows.map(({ reference }) => reference);
    };

    beforeEach(async () => {
      await arm.adminArm.putOrder(liveOrder("AYC-10101", {}));
      await arm.adminArm.putOrder(liveOrder("AYC-10102", PLAN));
      // A Test Order for the Course: never in the figures.
      await arm.adminArm.putOrder(liveOrder("AYC-10103", { livemode: false }));
    });

    it("filters the Orders to Courses, or to Plans", async () => {
      expect(await listed({ item: "courses" })).toEqual(["AYC-10101"]);
      expect(await listed({ item: "courses", tests: true })).toEqual(["AYC-10103", "AYC-10101"]);
      expect(await listed({ item: "plans" })).toEqual(["AYC-10102"]);
      expect(await listed({})).toEqual(["AYC-10102", "AYC-10101"]);
    });

    it("exports a CSV of the Course Orders that names the Course", async () => {
      const result = await admin.exportOrdersCsv(OWNER, {
        ...DEFAULT_ORDER_QUERY,
        item: "courses",
      });
      if (!result.ok) throw new Error(`Refused an Owner: ${result.error.kind}`);

      expect(result.value.rows).toBe(1);
      const [, row] = result.value.csv.split("\r\n");
      expect(row).toContain("AYC-10101");
      expect(row).toContain("PSAD Masterclass · Video course");
      expect(result.value.csv).not.toContain("CE All-Access");
    });

    it("names the Course on the Order's detail", async () => {
      const result = await admin.getOrderForAdmin(OWNER, "AYC-10101");

      expect(result).toMatchObject({
        ok: true,
        value: { order: { reference: "AYC-10101", courseId: PSAD, planName: "PSAD Masterclass" } },
      });
    });

    it("counts a paid Course Order in today's paid total, leaving the Test Order out", async () => {
      expect(await admin.getPaidToday(OWNER)).toMatchObject({
        netCentavos: 149_900 + 129_900,
        orders: 2,
      });
      const { sales } = await admin.getOverview(OWNER);
      expect(sales?.figures.today).toMatchObject({ paidCentavos: 149_900 + 129_900, orders: 2 });
    });
  });

  describe("deleting an account that owns Courses", () => {
    const auth = createFakeAuthAdmin();
    const askDeletion = async (userId = BEA.userId) =>
      (await seam.requestPrivacy(userId, "deletion")).request.id;
    const detail = async (id: string) => {
      const result = await admin.getPrivacyRequestForAdmin(OWNER, id);
      if (!result.ok) throw new Error(`Refused an Owner: ${result.error.kind}`);
      return result.value;
    };
    const deleteAccount = (requestId: string) =>
      admin.deleteMemberAccount(OWNER, { requestId, confirmation: BEA.email }, auth);

    it("removes its Course Ownerships and keeps its Course Orders, detached", async () => {
      const reference = await bought();
      await give(HPGE);
      await give(HPGE, SAM.userId);

      const result = await deleteAccount(await askDeletion());

      expect(result).toMatchObject({ ok: true });
      expect(await arm.courseOwnerships()).toEqual([
        expect.objectContaining({ userId: SAM.userId, courseId: HPGE }),
      ]);
      const kept = (await arm.orders()).find((order) => order.reference === reference);
      expect(kept).toMatchObject({ userId: null, courseId: PSAD, status: "paid" });
      const listed = await admin.listOrdersForAdmin(OWNER, {
        ...DEFAULT_ORDER_QUERY,
        tests: true,
        range: "all",
      });
      expect(listed.ok && listed.value.rows).toEqual([
        expect.objectContaining({ reference, userId: null, planName: "PSAD Masterclass" }),
      ]);
    });

    it("counts the paid Course Orders it keeps", async () => {
      await bought();

      expect((await detail(await askDeletion())).paidOrders).toBe(1);
    });

    it("is refused while a Course Order is Pending, deleting nothing", async () => {
      await ordered();
      await give(HPGE);
      const id = await askDeletion();
      expect((await detail(id)).deletionBlocked).toMatch(/payment in progress/);

      const refused = await deleteAccount(id);

      expect(refused).toMatchObject({ ok: false, error: { kind: "invalid" } });
      expect(await arm.courseOwnerships()).toEqual([
        expect.objectContaining({ userId: BEA.userId, courseId: HPGE }),
      ]);
      expect((await arm.members()).map(({ userId }) => userId)).toContain(BEA.userId);
    });
  });

  describe("the data copy", () => {
    const LESSON = sampleLessonId(
      "Surveying & Curves Lectures",
      "Horizontal curves",
      "Simple curves",
    );

    it("holds her Course Ownerships with their source, and her Lesson progress, only hers", async () => {
      const reference = await bought();
      await give(HPGE);
      await give(HPGE, SAM.userId);
      // A Free Preview Lesson, which any signed-in Member can watch.
      for (const userId of [BEA.userId, SAM.userId]) {
        const saved = await seam.saveLessonPosition(
          userId,
          { lessonId: LESSON, position: 30 },
          accessOf(),
        );
        if (!saved.ok) throw new Error(`Not saved: ${JSON.stringify(saved)}`);
      }
      const id = (await seam.requestPrivacy(BEA.userId, "data-copy")).request.id;

      const result = await admin.exportMemberData(OWNER, id);
      if (!result.ok) throw new Error(`Refused: ${JSON.stringify(result)}`);

      expect(result.value.data).toMatchObject({ version: 3 });
      expect(result.value.data.courses).toEqual([
        {
          courseId: PSAD,
          title: "PSAD Masterclass",
          examCode: "CE",
          since: BOOT.toISOString(),
          orderReference: reference,
        },
        {
          courseId: HPGE,
          title: "HPGE Crash Course",
          examCode: "CE",
          since: BOOT.toISOString(),
          orderReference: null,
        },
      ]);
      expect(result.value.data.lessonProgress).toEqual([
        {
          lessonId: LESSON,
          positionSeconds: 30,
          furthestSeconds: 30,
          doneAt: null,
          watchedAt: BOOT.toISOString(),
        },
      ]);
    });
  });
});
