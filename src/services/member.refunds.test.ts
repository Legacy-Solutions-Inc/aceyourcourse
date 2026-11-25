import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noticeText } from "@/lib/member-app/notices";
import { type Order, PAYMONGO_SYSTEM_ACTOR } from "@/lib/payments/order-ledger";
import type { PaymentRefund } from "@/lib/payments/refunds";
import { samplePlanId } from "@/services/mock/plans";
import { createFakePaymentsClient, type FakePaymentsClient } from "@/services/payments.fake";
import type { PaymentRefundEvent } from "@/services/payments.types";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";
import { CE_OFFICIAL, withExamDates } from "../../test/member-inputs";

// Refunds on the Member seam (Phase 4, ticket 09; spec, Phase 4 → Order
// ledger; Phase 4 planning decisions → Refunds; stories 150 and 151s), run
// against every arm. An Owner refunds in the PayMongo dashboard; PayMongo's
// refund events, applied once each, record each refund once. A full refund
// (partials adding up to it included) makes the Order Refunded and takes its
// unused days, only its own, off the Access Pass, ending access now when
// nothing is left, with an in-app notice. A partial refund leaves the Order
// Paid and access as it was. A refund of an Order that was never Paid is
// ignored. Each is in Staff Activity as "PayMongo (system)", with the end
// before and after.
//
// "Now" starts at 17 Nov 2026, 11:42 in Manila; Bea has CE as a Target Exam
// and no Access Pass until she buys one.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(BOOT.getTime() + ms);
const iso = (ms: number) => at(ms).toISOString();
const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
const OWNER = sampleActor("owner");
const CE_30 = samplePlanId("CE", 30);
const CE_90 = samplePlanId("CE", 90);
const CE_90_PRICE = 129_900;

describe.each(MEMBER_ARMS)("Member seam: refunds ($name)", (arm) => {
  const { seam } = arm;
  let fake: FakePaymentsClient;
  let events = 0;

  /** Bea buys a CE Plan and PayMongo confirms it now; gives the Paid Order and its payment's id. */
  async function bought(planId = CE_90) {
    const result = await seam.payForPlan(
      BEA.userId,
      { examCode: "CE", planId, method: "gcash" },
      fake,
    );
    if (!result.ok) throw new Error(`Pay was refused: ${result.reason}`);
    const order = (await arm.orders()).find((held) => held.reference === result.reference);
    if (!order) throw new Error("Pay made no Order.");
    const paymentId = `pay_Fake${order.reference.slice(4)}TestOnly`;
    const paid = await seam.recordPaymentEvent({
      id: `evt_FakePaid${order.reference.slice(4)}`,
      type: "payment.paid",
      outcome: "paid",
      checkoutId: null,
      orderId: order.id,
      reference: order.reference,
      paymentId,
      livemode: false,
    });
    if (paid !== "applied") throw new Error(`The paid event wasn't applied: ${paid}`);
    return { order, paymentId };
  }

  /** A succeeded refund of a payment, as PayMongo's refund resource carries it. */
  const refund = (fields: Partial<PaymentRefund> = {}): PaymentRefund => ({
    id: "ref_FakeRefund0001TestOnly",
    amountCentavos: CE_90_PRICE,
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

  const order = async (reference: string) =>
    (await arm.orders()).find((held) => held.reference === reference);
  const passEnd = async () =>
    (await seam.listAccessPasses(BEA.userId)).find((pass) => pass.examCode === "CE")?.endsAt ??
    null;
  const history = async () =>
    (await arm.adminArm.passHistory(BEA.userId, "CE")).map(({ orderId, startsAt, endsAt }) => ({
      orderId,
      startsAt,
      endsAt,
    }));
  const activity = async () =>
    (await arm.adminArm.staffActivity()).map(({ actor, entity, action, before, after }) => ({
      actor,
      entity,
      action,
      before,
      after,
    }));
  const refundActivity = async () =>
    (await activity()).filter(({ action }) => action.includes("refund"));

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset(withExamDates);
    await seam.getOrCreateMember(BEA);
    await seam.addTargetExam(BEA.userId, { examCode: "CE", examDate: CE_OFFICIAL });
    fake = createFakePaymentsClient();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("a full refund", () => {
    it("of a Member's only Order ends their access now, tells them, and logs the end before and after", async () => {
      const { order: paid, paymentId } = await bought();
      vi.setSystemTime(at(10 * DAY));

      expect(await seam.recordPaymentEvent(refundEvent(paymentId, [refund()]))).toBe("applied");

      expect(await order(paid.reference)).toMatchObject({
        status: "refunded",
        statusChangedAt: iso(10 * DAY),
        paidAt: iso(0),
      });
      expect(await passEnd()).toBe(iso(10 * DAY));
      expect(await history()).toEqual([
        { orderId: paid.id, startsAt: iso(0), endsAt: iso(10 * DAY) },
      ]);
      const notices = await seam.listNotices(BEA.userId);
      expect(notices[0]).toMatchObject({ kind: "refunded", reference: paid.reference });
      expect(notices[0] && noticeText(notices[0])).toBe(
        `Your refund for ${paid.reference} was processed. CE All-Access has ended`,
      );
      expect(await refundActivity()).toEqual([
        {
          actor: { ...PAYMONGO_SYSTEM_ACTOR },
          entity: "access-pass",
          action: "order-refunded",
          before: { email: BEA.email, examCode: "CE", endsAt: iso(90 * DAY) },
          after: {
            email: BEA.email,
            examCode: "CE",
            endsAt: iso(10 * DAY),
            reference: paid.reference,
            refundedCentavos: CE_90_PRICE,
          },
        },
      ]);
      expect(await arm.adminArm.orderRefunds()).toEqual([
        { ...refund({ refundedAt: iso(10 * DAY) }), orderId: paid.id },
      ]);
    });

    it("of the second of two stacked Orders takes off only its days, and says when access now ends", async () => {
      const first = await bought(CE_30);
      vi.setSystemTime(at(HOUR));
      const second = await bought(CE_90);
      expect(await passEnd()).toBe(iso(120 * DAY));
      vi.setSystemTime(at(DAY));

      await seam.recordPaymentEvent(refundEvent(second.paymentId, [refund()]));

      expect(await order(first.order.reference)).toMatchObject({ status: "paid" });
      expect(await order(second.order.reference)).toMatchObject({ status: "refunded" });
      expect(await passEnd()).toBe(iso(30 * DAY));
      expect(await history()).toEqual([
        { orderId: first.order.id, startsAt: iso(0), endsAt: iso(30 * DAY) },
        { orderId: second.order.id, startsAt: iso(30 * DAY), endsAt: iso(30 * DAY) },
      ]);
      const [notice] = await seam.listNotices(BEA.userId);
      expect(notice && noticeText(notice)).toBe(
        `Your refund for ${second.order.reference} was processed. CE All-Access now ends 17 Dec 2026`,
      );
    });

    it("by two partial refunds adding up to the whole amount makes the Order Refunded and takes its days off", async () => {
      const { order: paid, paymentId } = await bought();
      vi.setSystemTime(at(DAY));
      await seam.recordPaymentEvent(
        refundEvent(paymentId, [refund({ id: "ref_First", amountCentavos: 30_000 })]),
      );
      expect(await order(paid.reference)).toMatchObject({ status: "paid" });
      vi.setSystemTime(at(2 * DAY));

      expect(
        await seam.recordPaymentEvent(
          refundEvent(paymentId, [refund({ id: "ref_Second", amountCentavos: 99_900 })]),
        ),
      ).toBe("applied");

      expect(await order(paid.reference)).toMatchObject({ status: "refunded" });
      expect(await passEnd()).toBe(iso(2 * DAY));
      expect((await seam.getMemberOrder(BEA.userId, paid.reference))?.refundedCentavos).toBe(
        CE_90_PRICE,
      );
    });

    it("doesn't touch days from grants before or after it", async () => {
      // A 30-day grant 5 days ago, then 90 paid days on top, then a 7-day extension.
      await arm.adminArm.putAccessPass(
        { userId: BEA.userId, examCode: "CE", endsAt: iso(25 * DAY) },
        [
          {
            userId: BEA.userId,
            examCode: "CE",
            days: 30,
            startsAt: iso(-5 * DAY),
            endsAt: iso(25 * DAY),
            reason: "Beta",
            grantedBy: { email: OWNER.email, name: OWNER.name },
            grantedAt: iso(-5 * DAY),
            orderId: null,
          },
        ],
      );
      const { order: paid, paymentId } = await bought();
      const extended = await arm.admin.extendAccess(OWNER, {
        userId: BEA.userId,
        examCode: "CE",
        days: 7,
        reason: "Late start",
      });
      expect(extended.ok).toBe(true);
      expect(await passEnd()).toBe(iso(122 * DAY));
      vi.setSystemTime(at(10 * DAY));

      await seam.recordPaymentEvent(refundEvent(paymentId, [refund()]));

      // The paid days hadn't started: all 90 go; the extension moves 90 days earlier, whole.
      expect(await history()).toEqual([
        { orderId: null, startsAt: iso(-5 * DAY), endsAt: iso(25 * DAY) },
        { orderId: paid.id, startsAt: iso(25 * DAY), endsAt: iso(25 * DAY) },
        { orderId: null, startsAt: iso(25 * DAY), endsAt: iso(32 * DAY) },
      ]);
      expect(await passEnd()).toBe(iso(32 * DAY));
    });

    it("ends access now, never earlier, when the Order's days were the rest of the pass", async () => {
      const { paymentId } = await bought(CE_30);
      // A minute before the 30 days run out.
      vi.setSystemTime(at(30 * DAY - 60_000));

      await seam.recordPaymentEvent(refundEvent(paymentId, [refund({ amountCentavos: 49_900 })]));

      expect(await passEnd()).toBe(iso(30 * DAY - 60_000));
    });

    it("after the Owner ended access, refunds the Order and moves no end", async () => {
      const { order: paid, paymentId } = await bought();
      vi.setSystemTime(at(DAY));
      const ended = await arm.admin.endAccess(OWNER, {
        userId: BEA.userId,
        examCode: "CE",
        reason: "Asked to stop",
      });
      expect(ended.ok).toBe(true);
      vi.setSystemTime(at(2 * DAY));

      expect(await seam.recordPaymentEvent(refundEvent(paymentId, [refund()]))).toBe("applied");

      expect(await order(paid.reference)).toMatchObject({ status: "refunded" });
      expect(await passEnd()).toBe(iso(DAY));
      const [notice] = await seam.listNotices(BEA.userId);
      expect(notice && noticeText(notice)).toBe(
        `Your refund for ${paid.reference} was processed. CE All-Access has ended`,
      );
    });

    it("of an Order whose account is gone makes it Refunded, with no pass to change", async () => {
      const { order: paid, paymentId } = await bought();
      const orphan: Order = {
        ...paid,
        id: "4f1e2d3c-5b6a-4987-8a7b-6c5d4e3f2a1b",
        reference: "AYC-19999",
        userId: null,
        status: "paid",
        paidAt: iso(0),
        paymentId: "pay_FakeOrphan0001TestOnly",
      };
      await arm.adminArm.putOrder(orphan);
      vi.setSystemTime(at(DAY));

      expect(
        await seam.recordPaymentEvent(refundEvent("pay_FakeOrphan0001TestOnly", [refund()])),
      ).toBe("applied");

      expect(await order("AYC-19999")).toMatchObject({ status: "refunded" });
      expect(await passEnd()).toBe(iso(90 * DAY));
      expect(await refundActivity()).toEqual([
        expect.objectContaining({
          entity: "order",
          action: "order-refunded",
          after: expect.objectContaining({ reference: "AYC-19999", status: "refunded" }),
        }),
      ]);
      expect(paymentId).not.toBe("pay_FakeOrphan0001TestOnly");
    });
  });

  describe("a partial refund", () => {
    it("records the amount, leaves the Order Paid and the end as it was, and logs it", async () => {
      const { order: paid, paymentId } = await bought();
      vi.setSystemTime(at(DAY));

      expect(
        await seam.recordPaymentEvent(refundEvent(paymentId, [refund({ amountCentavos: 30_000 })])),
      ).toBe("applied");

      expect(await order(paid.reference)).toMatchObject({ status: "paid" });
      expect(await passEnd()).toBe(iso(90 * DAY));
      expect(await seam.getMemberOrder(BEA.userId, paid.reference)).toMatchObject({
        status: "paid",
        refundedCentavos: 30_000,
        refundedAt: iso(DAY),
      });
      expect(await seam.listNotices(BEA.userId)).not.toContainEqual(
        expect.objectContaining({ kind: "refunded" }),
      );
      expect(await refundActivity()).toEqual([
        {
          actor: { ...PAYMONGO_SYSTEM_ACTOR },
          entity: "order",
          action: "order-partially-refunded",
          before: { reference: paid.reference, refundedCentavos: 0, endsAt: iso(90 * DAY) },
          after: { reference: paid.reference, refundedCentavos: 30_000, endsAt: iso(90 * DAY) },
        },
      ]);
    });

    it("shows on the Order's Payment Acknowledgement, as a full refund does", async () => {
      const { order: paid, paymentId } = await bought();
      await seam.recordPaymentEvent(refundEvent(paymentId, [refund({ amountCentavos: 30_000 })]));
      expect(
        (await seam.getPaymentAcknowledgement(BEA.userId, paid.reference))?.order,
      ).toMatchObject({ status: "paid", refundedCentavos: 30_000 });

      await seam.recordPaymentEvent(
        refundEvent(paymentId, [refund({ id: "ref_Rest", amountCentavos: 99_900 })]),
      );
      expect(
        (await seam.getPaymentAcknowledgement(BEA.userId, paid.reference))?.order,
      ).toMatchObject({ status: "refunded", refundedCentavos: CE_90_PRICE });
    });
  });

  describe("applied once", () => {
    it("takes the days off once when PayMongo sends the same event twice", async () => {
      const { order: paid, paymentId } = await bought();
      vi.setSystemTime(at(DAY));
      const event = refundEvent(paymentId, [refund()]);

      expect(await seam.recordPaymentEvent(event)).toBe("applied");
      vi.setSystemTime(at(2 * DAY));
      expect(await seam.recordPaymentEvent(event)).toBe("duplicate");

      expect(await passEnd()).toBe(iso(DAY));
      expect(await history()).toEqual([{ orderId: paid.id, startsAt: iso(0), endsAt: iso(DAY) }]);
      expect(await refundActivity()).toHaveLength(1);
      expect(
        (await seam.listNotices(BEA.userId)).filter(({ kind }) => kind === "refunded"),
      ).toHaveLength(1);
    });

    it("counts a refund once when two events carry it (payment.refunded and payment.refund.updated)", async () => {
      const { order: paid, paymentId } = await bought();
      await seam.recordPaymentEvent(refundEvent(paymentId, [refund({ amountCentavos: 30_000 })]));

      expect(
        await seam.recordPaymentEvent(
          refundEvent(paymentId, [refund({ amountCentavos: 30_000 })], {
            type: "payment.refunded",
            orderId: paid.id,
            reference: paid.reference,
          }),
        ),
      ).toBe("no-change");

      expect(await order(paid.reference)).toMatchObject({ status: "paid" });
      expect((await seam.getMemberOrder(BEA.userId, paid.reference))?.refundedCentavos).toBe(
        30_000,
      );
      expect(await refundActivity()).toHaveLength(1);
    });

    it("counts a pending refund only once it has succeeded, whatever order its events come in", async () => {
      const { order: paid, paymentId } = await bought();
      const pending = refund({ status: "pending", refundedAt: null });
      vi.setSystemTime(at(DAY));

      expect(await seam.recordPaymentEvent(refundEvent(paymentId, [pending]))).toBe("applied");
      expect(await order(paid.reference)).toMatchObject({ status: "paid" });
      expect(await passEnd()).toBe(iso(90 * DAY));
      // Recorded, so its status can move on, and logged, though it refunded nothing yet.
      expect(await refundActivity()).toEqual([
        {
          actor: { ...PAYMONGO_SYSTEM_ACTOR },
          entity: "order",
          action: "order-refund-recorded",
          before: { reference: paid.reference, refundedCentavos: 0 },
          after: {
            reference: paid.reference,
            refundedCentavos: 0,
            refunds: [{ refundId: pending.id, status: "pending", amountCentavos: CE_90_PRICE }],
          },
        },
      ]);

      vi.setSystemTime(at(2 * DAY));
      expect(await seam.recordPaymentEvent(refundEvent(paymentId, [refund()]))).toBe("applied");
      expect(await order(paid.reference)).toMatchObject({ status: "refunded" });
      expect(await passEnd()).toBe(iso(2 * DAY));

      // The pending event, delivered again late, moves nothing back.
      expect(await seam.recordPaymentEvent(refundEvent(paymentId, [pending]))).toBe("no-change");
      expect(await arm.adminArm.orderRefunds()).toEqual([
        { ...refund({ refundedAt: iso(2 * DAY) }), orderId: paid.id },
      ]);
    });

    it("writes nothing when its Staff Activity can't be written, so PayMongo's retry applies it", async () => {
      const { order: paid, paymentId } = await bought();
      vi.setSystemTime(at(DAY));
      const event = refundEvent(paymentId, [refund()]);
      const mend = await arm.adminArm.breakStaffActivity();
      try {
        await expect(seam.recordPaymentEvent(event)).rejects.toThrow();
      } finally {
        await mend();
      }

      expect(await order(paid.reference)).toMatchObject({ status: "paid" });
      expect(await passEnd()).toBe(iso(90 * DAY));
      expect(await history()).toEqual([
        { orderId: paid.id, startsAt: iso(0), endsAt: iso(90 * DAY) },
      ]);
      expect(await arm.adminArm.orderRefunds()).toEqual([]);
      expect(await seam.listNotices(BEA.userId)).not.toContainEqual(
        expect.objectContaining({ kind: "refunded" }),
      );

      expect(await seam.recordPaymentEvent(event)).toBe("applied");
      expect(await order(paid.reference)).toMatchObject({ status: "refunded" });
    });

    it("never makes a Refunded Order Paid again, even when a late paid event arrives", async () => {
      const { order: paid, paymentId } = await bought();
      vi.setSystemTime(at(DAY));
      await seam.recordPaymentEvent(refundEvent(paymentId, [refund()]));

      expect(
        await seam.recordPaymentEvent({
          id: "evt_FakeCheckoutPaidLate",
          type: "checkout_session.payment.paid",
          outcome: "paid",
          checkoutId: null,
          orderId: paid.id,
          reference: paid.reference,
          paymentId,
          livemode: false,
        }),
      ).toBe("no-change");

      expect(await order(paid.reference)).toMatchObject({ status: "refunded" });
      expect(await passEnd()).toBe(iso(DAY));
    });
  });

  describe("ignored", () => {
    it.each([
      ["Pending", "pending"],
      ["Failed", "failed"],
      ["Expired", "expired"],
    ] as const)(
      "ignores and logs a refund of a %s Order, recording no refund",
      async (_, status) => {
        const result = await seam.payForPlan(
          BEA.userId,
          { examCode: "CE", planId: CE_90, method: "gcash" },
          fake,
        );
        if (!result.ok) throw new Error("Pay was refused.");
        const pending = await order(result.reference);
        if (!pending) throw new Error("Pay made no Order.");
        if (status === "failed") {
          fake.simulate(pending.id, "failed");
          await seam.checkOrderStatus(BEA.userId, result.reference, fake);
        }
        if (status === "expired") {
          vi.setSystemTime(at(25 * HOUR));
          await seam.expireOverdueOrders(null);
        }
        expect(await order(result.reference)).toMatchObject({ status });

        expect(
          await seam.recordPaymentEvent(
            refundEvent("pay_Unknown", [refund()], {
              type: "payment.refunded",
              orderId: pending.id,
              reference: pending.reference,
            }),
          ),
        ).toBe("ignored");

        expect(await order(result.reference)).toMatchObject({ status });
        expect(await arm.adminArm.orderRefunds()).toEqual([]);
        expect(await passEnd()).toBeNull();
        expect(await refundActivity()).toEqual([
          {
            actor: { ...PAYMONGO_SYSTEM_ACTOR },
            entity: "order",
            action: "order-refund-ignored",
            before: { reference: result.reference, status },
            after: { reference: result.reference, status, refundedCentavos: CE_90_PRICE },
          },
        ]);
      },
    );

    it("finds no Order for a refund of a payment that isn't ours", async () => {
      await bought();

      expect(await seam.recordPaymentEvent(refundEvent("pay_SomeoneElse", [refund()]))).toBe(
        "unknown-order",
      );
      expect(await arm.adminArm.orderRefunds()).toEqual([]);
    });
  });
});
