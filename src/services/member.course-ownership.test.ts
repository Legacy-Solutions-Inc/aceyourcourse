import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberAccess } from "@/lib/member-app/access";
import { noticeText } from "@/lib/member-app/notices";
import { PAYMONGO_SYSTEM_ACTOR } from "@/lib/payments/order-ledger";
import type { PaymentRefund } from "@/lib/payments/refunds";
import { sampleCourseId } from "@/services/mock/courses";
import { createFakePaymentsClient, type FakePaymentsClient } from "@/services/payments.fake";
import type { PaymentRefundEvent } from "@/services/payments.types";

import { MEMBER_ARMS } from "../../test/member-arms";
import { CE_OFFICIAL, withExamDates } from "../../test/member-inputs";

// ─────────────────────────────────────────────────────────────────────────────
// After a Course is bought, on the Member seam (Phase 5, ticket 07; spec,
// Phase 5 planning decisions → The Order ledger for Course Orders, Everywhere
// else; stories 143, 144, 172, 182, 183), run against every arm with the
// payments fake.
//
// - A full refund of a Course Order (partials adding up to it included)
//   makes it Refunded and removes the Course Ownership it gave, unless
//   another Paid Order for the Course or a gift still holds it, with a notice
//   for the Member, logged as "PayMongo (system)". A partial refund changes
//   nothing. Refund events keep Phase 4's rules: applied once, and a late,
//   older one never moves a refund back.
// - Billing's "Your Courses": each Course the Member owns, since when, and
//   its source (the Order's reference, or given by Ace Your Course).
// - A Course Order's Payment Acknowledgement has no access period.
// - Another Member's Courses and Orders are never readable.
//
// The data: "PSAD Masterclass" (CE · PSAD, sold separately at ₱1,499, on
// sale, owned by nobody). "Now" is 28 Nov 2026, 20:00 in Manila.
// ─────────────────────────────────────────────────────────────────────────────

const BOOT = new Date("2026-11-28T12:00:00.000Z");
const MINUTE = 60 * 1000;
const PSAD = sampleCourseId("PSAD Masterclass");
const PSAD_PRICE = 149_900;

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

describe.each(MEMBER_ARMS)("Member seam: after a Course is bought ($name)", (arm) => {
  const { seam } = arm;
  let fake: FakePaymentsClient;
  let events = 0;

  /** Bea (or another Member) pays for the PSAD Masterclass: the Pending Order. */
  async function ordered(userId = BEA.userId) {
    const result = await seam.payForCourse(
      userId,
      { examCode: "CE", courseId: PSAD, method: "gcash" },
      fake,
    );
    if (!result.ok) throw new Error(`Pay was refused: ${result.reason}`);
    const order = (await arm.orders()).find((held) => held.reference === result.reference);
    if (!order) throw new Error("Pay made no Order.");
    return order;
  }

  /** PayMongo's paid event for an Order; gives the payment's id. */
  async function paid(order: { id: string; reference: string }) {
    const paymentId = `pay_Fake${order.reference.slice(4)}TestOnly`;
    const result = await seam.recordPaymentEvent({
      id: `evt_FakePaid${order.reference.slice(4)}`,
      type: "payment.paid",
      outcome: "paid",
      checkoutId: null,
      orderId: order.id,
      reference: order.reference,
      paymentId,
      livemode: false,
    });
    if (result !== "applied") throw new Error(`The paid event wasn't applied: ${result}`);
    return paymentId;
  }

  /** Bea buys the PSAD Masterclass and PayMongo confirms it: the Order and its payment's id. */
  async function bought(userId = BEA.userId) {
    const order = await ordered(userId);
    return { order, paymentId: await paid(order) };
  }

  /** A succeeded refund, as PayMongo's refund resource carries it: the whole price unless told. */
  const refund = (fields: Partial<PaymentRefund> = {}): PaymentRefund => ({
    id: "ref_FakeRefund0001TestOnly",
    amountCentavos: PSAD_PRICE,
    status: "succeeded",
    refundedAt: new Date().toISOString(),
    ...fields,
  });

  /** A payment.refund.updated event about a payment, by its id alone, as PayMongo sends it. */
  function refundEvent(
    paymentId: string,
    refunds: PaymentRefund[],
    fields: Partial<PaymentRefundEvent> = {},
  ): PaymentRefundEvent {
    events += 1;
    return {
      id: `evt_FakeRefund${String(events).padStart(4, "0")}`,
      type: "payment.refund.updated",
      outcome: "refund",
      checkoutId: null,
      orderId: null,
      reference: null,
      paymentId,
      livemode: false,
      refunds,
      ...fields,
    };
  }

  const ownerships = async (userId = BEA.userId) =>
    (await arm.courseOwnerships()).filter((ownership) => ownership.userId === userId);
  const orderOf = async (reference: string) =>
    (await arm.orders()).find((held) => held.reference === reference);
  const noticeTexts = async (userId = BEA.userId) =>
    (await seam.listNotices(userId)).map(noticeText);
  const accessOf = (): MemberAccess => ({
    gate: "open",
    device: "active",
    activeStaff: false,
    passes: [],
    now: new Date(),
  });
  /** The PSAD Masterclass's card on Bea's Courses screen. */
  const psadCard = async (userId = BEA.userId) =>
    (await seam.listCourses(userId, "CE", accessOf())).courses.find((course) => course.id === PSAD);

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset(withExamDates);
    await seam.getOrCreateMember(BEA);
    await seam.getOrCreateMember(SAM);
    await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: CE_OFFICIAL });
    await seam.addTargetExam(SAM.userId, { examCode: "CE", examDate: CE_OFFICIAL });
    fake = createFakePaymentsClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("a full refund of a Course Order", () => {
    it("makes it Refunded, takes the Course off her Courses screen and Billing, and tells her", async () => {
      const { order, paymentId } = await bought();
      expect((await psadCard())?.owned).toBe(true);
      vi.setSystemTime(new Date(BOOT.getTime() + 30 * MINUTE));

      const result = await seam.recordPaymentEvent(refundEvent(paymentId, [refund()]));

      expect(result).toBe("applied");
      expect(await orderOf(order.reference)).toMatchObject({ status: "refunded" });
      expect(await ownerships()).toEqual([]);
      expect(await psadCard()).toMatchObject({ owned: false, decision: { outcome: "locked" } });
      expect(await seam.listOwnedCourses(BEA.userId)).toEqual([]);
      expect(await noticeTexts()).toEqual([
        `Your refund for ${order.reference} was processed. You no longer own the PSAD Masterclass.`,
      ]);
    });

    it("logs the Course Ownership's removal as PayMongo (system)", async () => {
      const { order, paymentId } = await bought();

      await seam.recordPaymentEvent(refundEvent(paymentId, [refund()]));

      expect((await arm.adminArm.staffActivity()).at(-1)).toMatchObject({
        actor: { ...PAYMONGO_SYSTEM_ACTOR },
        entity: "course-ownership",
        entityId: `${BEA.userId}:${PSAD}`,
        action: "order-refunded",
        before: {
          email: BEA.email,
          courseId: PSAD,
          course: "PSAD Masterclass",
          reference: order.reference,
        },
        after: { reference: order.reference, refundedCentavos: PSAD_PRICE, owned: false },
      });
    });

    it("counts partial refunds adding up to the whole price as a full one", async () => {
      const { order, paymentId } = await bought();

      await seam.recordPaymentEvent(
        refundEvent(paymentId, [
          refund({ id: "ref_FakePart0001TestOnly", amountCentavos: 50_000 }),
        ]),
      );
      expect(await ownerships()).toHaveLength(1);
      await seam.recordPaymentEvent(
        refundEvent(paymentId, [
          refund({ id: "ref_FakePart0001TestOnly", amountCentavos: 50_000 }),
          refund({ id: "ref_FakePart0002TestOnly", amountCentavos: 99_900 }),
        ]),
      );

      expect(await orderOf(order.reference)).toMatchObject({ status: "refunded" });
      expect(await ownerships()).toEqual([]);
    });

    it("keeps the Course when another Paid Order for it holds it, which then gives it", async () => {
      // Two tabs: both Orders made, then both paid; the second granted nothing.
      const first = await ordered();
      const second = await ordered();
      const firstPayment = await paid(first);
      await paid(second);
      expect(await orderOf(second.reference)).toMatchObject({ paidAlreadyOwned: true });

      await seam.recordPaymentEvent(refundEvent(firstPayment, [refund()]));

      expect(await orderOf(first.reference)).toMatchObject({ status: "refunded" });
      expect(await ownerships()).toEqual([expect.objectContaining({ orderId: second.id })]);
      expect(await seam.listOwnedCourses(BEA.userId)).toEqual([
        expect.objectContaining({ courseId: PSAD, orderReference: second.reference }),
      ]);
      // The second Order now gives the Course, so it's no longer one to refund.
      expect(await orderOf(second.reference)).toMatchObject({
        status: "paid",
        paidAlreadyOwned: false,
      });
      expect(await noticeTexts()).toEqual([]);
    });

    it("keeps the Course when the refunded Order was the second, paid while she owned it", async () => {
      const first = await ordered();
      const second = await ordered();
      await paid(first);
      const secondPayment = await paid(second);

      await seam.recordPaymentEvent(refundEvent(secondPayment, [refund()]));

      expect(await orderOf(second.reference)).toMatchObject({ status: "refunded" });
      expect(await ownerships()).toEqual([expect.objectContaining({ orderId: first.id })]);
      expect(await noticeTexts()).toEqual([]);
    });

    it("never removes a given Course", async () => {
      // Paid after an Owner gave it (a late payment): recorded Paid, granting nothing.
      const order = await ordered();
      await arm.putCourseOwnership({
        userId: BEA.userId,
        courseId: PSAD,
        since: BOOT.toISOString(),
        orderId: null,
      });
      const paymentId = await paid(order);

      await seam.recordPaymentEvent(refundEvent(paymentId, [refund()]));

      expect(await orderOf(order.reference)).toMatchObject({ status: "refunded" });
      expect(await ownerships()).toEqual([expect.objectContaining({ orderId: null })]);
      expect(await seam.listOwnedCourses(BEA.userId)).toEqual([
        expect.objectContaining({ courseId: PSAD, orderReference: null }),
      ]);
    });

    it("is applied once: the same event again, and a late older one, change nothing", async () => {
      const { paymentId } = await bought();
      const event = refundEvent(paymentId, [refund()]);
      await seam.recordPaymentEvent(event);
      const before = {
        orders: await arm.orders(),
        notices: await seam.listNotices(BEA.userId),
        activity: await arm.adminArm.staffActivity(),
      };

      expect(await seam.recordPaymentEvent(event)).toBe("duplicate");
      // PayMongo's older event, saying the refund was still pending, arrives last.
      expect(
        await seam.recordPaymentEvent(
          refundEvent(paymentId, [refund({ status: "pending", refundedAt: null })]),
        ),
      ).toBe("no-change");

      expect(await ownerships()).toEqual([]);
      expect({
        orders: await arm.orders(),
        notices: await seam.listNotices(BEA.userId),
        activity: await arm.adminArm.staffActivity(),
      }).toEqual(before);
    });
  });

  describe("a partial refund of a Course Order", () => {
    it("leaves it Paid and the Course hers, showing what was refunded", async () => {
      const { order, paymentId } = await bought();

      await seam.recordPaymentEvent(refundEvent(paymentId, [refund({ amountCentavos: 30_000 })]));

      expect(await orderOf(order.reference)).toMatchObject({ status: "paid" });
      expect(await ownerships()).toEqual([expect.objectContaining({ orderId: order.id })]);
      expect(await seam.getMemberOrder(BEA.userId, order.reference)).toMatchObject({
        status: "paid",
        refundedCentavos: 30_000,
      });
      expect(await noticeTexts()).toEqual([]);
    });
  });

  describe("listOwnedCourses: Billing's Your Courses", () => {
    it("gives each Course she owns, since when, and the Order that gave it", async () => {
      const { order } = await bought();

      expect(await seam.listOwnedCourses(BEA.userId)).toEqual([
        {
          courseId: PSAD,
          title: "PSAD Masterclass",
          examCode: "CE",
          since: BOOT.toISOString(),
          orderReference: order.reference,
        },
      ]);
    });

    it("gives a given Course with no Order: given by Ace Your Course", async () => {
      await arm.putCourseOwnership({
        userId: BEA.userId,
        courseId: PSAD,
        since: BOOT.toISOString(),
        orderId: null,
      });

      expect(await seam.listOwnedCourses(BEA.userId)).toEqual([
        expect.objectContaining({ courseId: PSAD, orderReference: null }),
      ]);
    });

    it("gives nothing before she owns a Course", async () => {
      expect(await seam.listOwnedCourses(BEA.userId)).toEqual([]);
    });

    it("never gives another Member's Courses", async () => {
      await bought(SAM.userId);

      expect(await seam.listOwnedCourses(BEA.userId)).toEqual([]);
      expect(await seam.listOwnedCourses(SAM.userId)).toHaveLength(1);
    });
  });

  describe("the Payment Acknowledgement of a Course Order", () => {
    it("names the Course, with no access period", async () => {
      const { order, paymentId } = await bought();

      expect(await seam.getPaymentAcknowledgement(BEA.userId, order.reference)).toEqual({
        order: expect.objectContaining({
          reference: order.reference,
          courseId: PSAD,
          planName: "PSAD Masterclass",
          days: null,
          status: "paid",
          accessUntil: null,
        }),
        buyer: { name: BEA.name, email: BEA.email },
        access: null,
        payMongoReference: paymentId,
      });
    });

    it("can be asked for an official invoice, as a Plan Order can", async () => {
      const { order } = await bought();

      expect(
        await seam.requestInvoice(BEA.userId, order.reference, {
          name: "Sample Builders Inc.",
          address: "Jaro, Iloilo City",
          tin: "123456789000",
        }),
      ).toEqual({ ok: true });
      expect(await seam.getMemberOrder(BEA.userId, order.reference)).toMatchObject({
        invoice: { status: "requested" },
      });
    });
  });

  describe("another Member's Course Orders", () => {
    it("are never readable: not in her Orders, nor by reference, nor as an Acknowledgement", async () => {
      const { order } = await bought(SAM.userId);

      expect(await seam.listMemberOrders(BEA.userId)).toEqual([]);
      expect(await seam.getMemberOrder(BEA.userId, order.reference)).toBeNull();
      expect(await seam.getPaymentAcknowledgement(BEA.userId, order.reference)).toBeNull();
      expect((await psadCard())?.owned).toBe(false);
    });
  });
});
