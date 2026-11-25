import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PAYMONGO_SYSTEM_ACTOR } from "@/lib/payments/order-ledger";
import { samplePlanId } from "@/services/mock/plans";
import { createFakePaymentsClient, type FakePaymentsClient } from "@/services/payments.fake";
import type { PaymentEvent, PaymentsClient } from "@/services/payments.types";

import { MEMBER_ARMS } from "../../test/member-arms";
import { CE_OFFICIAL, withExamDates } from "../../test/member-inputs";

// PayMongo's webhook events and Order expiry on the Member seam (Phase 4,
// ticket 05; spec, Phase 4 → Order ledger, "Revised 2026-11-24"; Phase 4
// planning decisions → Recording an outcome; stories 137, 149, 151g and
// 151h), run against every arm. Each event is applied once, through the
// same ledger as the status check; Failed and Expired can still become
// Paid; Paid never moves back. A Pending Order older than 24 hours reads as
// Expired everywhere, and the daily sweep asks PayMongo once more before it
// records Expired. Every change is in Staff Activity under "PayMongo
// (system)".
//
// "Now" starts at 17 Nov 2026, 11:42 in Manila; Bea has CE as a Target Exam.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(BOOT.getTime() + ms);
const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
const CE_90 = samplePlanId("CE", 90);

describe.each(MEMBER_ARMS)("Member seam: payment events and expiry ($name)", (arm) => {
  const { seam } = arm;
  let fake: FakePaymentsClient;

  /** Bea pays for CE 3 months; gives the Pending Order as stored. */
  async function pending(client: PaymentsClient = fake) {
    const result = await seam.payForPlan(
      BEA.userId,
      { examCode: "CE", planId: CE_90, method: "gcash" },
      client,
    );
    if (!result.ok) throw new Error(`Pay was refused: ${result.reason}`);
    const order = (await arm.orders()).find((held) => held.reference === result.reference);
    if (!order) throw new Error("Pay made no Order.");
    return order;
  }
  /** A PayMongo event about an Order, by its id and reference as its checkout's metadata carries them. */
  const eventFor = (
    order: { id: string; reference: string },
    fields: Partial<PaymentEvent> = {},
  ): PaymentEvent => ({
    id: "evt_FakeCheckoutPaid0001",
    type: "checkout_session.payment.paid",
    outcome: "paid",
    checkoutId: null,
    orderId: order.id,
    reference: order.reference,
    paymentId: "pay_FakePaid0001TestOnly",
    livemode: false,
    ...fields,
  });
  const passEnd = async () =>
    (await seam.listAccessPasses(BEA.userId)).find((pass) => pass.examCode === "CE")?.endsAt ??
    null;
  const activity = async () =>
    (await arm.adminArm.staffActivity()).map(({ actor, entity, action, after }) => ({
      actor,
      entity,
      action,
      after,
    }));

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

  describe("recordPaymentEvent", () => {
    it("makes a Pending Order Paid on a paid event, extending the Access Pass, logged as PayMongo", async () => {
      const order = await pending();
      vi.setSystemTime(at(HOUR));

      expect(await seam.recordPaymentEvent(eventFor(order))).toBe("applied");

      expect(await arm.orders()).toMatchObject([
        { reference: "AYC-10001", status: "paid", paymentId: "pay_FakePaid0001TestOnly" },
      ]);
      expect(await passEnd()).toBe(at(HOUR + 90 * DAY).toISOString());
      expect(await activity()).toEqual([
        expect.objectContaining({
          actor: { ...PAYMONGO_SYSTEM_ACTOR },
          entity: "access-pass",
          action: "order-paid",
        }),
      ]);
    });

    it("finds the Order by its checkout's id when the event carries no metadata", async () => {
      const order = await pending({
        ...fake,
        startCheckout: async () => ({
          ok: true,
          checkoutId: "cs_FakeCreated0001TestOnly",
          redirectTo: "https://checkout.paymongo.com/cs_FakeCreated0001TestOnly",
          livemode: false,
        }),
      });

      expect(
        await seam.recordPaymentEvent(
          eventFor(order, {
            checkoutId: "cs_FakeCreated0001TestOnly",
            orderId: null,
            reference: null,
          }),
        ),
      ).toBe("applied");
      expect((await arm.orders())[0]?.status).toBe("paid");
    });

    it("finds the Order by its reference alone", async () => {
      const order = await pending();

      expect(await seam.recordPaymentEvent(eventFor(order, { orderId: null }))).toBe("applied");
      expect((await arm.orders())[0]?.status).toBe("paid");
    });

    it("applies the same event once, however often PayMongo sends it", async () => {
      const order = await pending();
      await seam.recordPaymentEvent(eventFor(order));
      const end = await passEnd();

      expect(await seam.recordPaymentEvent(eventFor(order))).toBe("duplicate");
      expect(await passEnd()).toBe(end);
      expect(await activity()).toHaveLength(1);
    });

    it("grants once when a paid checkout and its paid payment both arrive", async () => {
      const order = await pending();
      await seam.recordPaymentEvent(eventFor(order));
      const end = await passEnd();

      expect(
        await seam.recordPaymentEvent(
          eventFor(order, { id: "evt_FakePaymentPaid0001", type: "payment.paid" }),
        ),
      ).toBe("no-change");
      expect(await passEnd()).toBe(end);
    });

    it("marks a Pending Order Failed on a failed event, granting nothing, logged as PayMongo", async () => {
      const order = await pending();

      expect(
        await seam.recordPaymentEvent(
          eventFor(order, {
            id: "evt_FakePaymentFailed0001",
            type: "payment.failed",
            outcome: "failed",
            paymentId: "pay_FakeFailed0001TestOnly",
          }),
        ),
      ).toBe("applied");
      expect(await arm.orders()).toMatchObject([{ status: "failed", paidAt: null }]);
      expect(await passEnd()).toBeNull();
      expect(await activity()).toEqual([
        {
          actor: { ...PAYMONGO_SYSTEM_ACTOR },
          entity: "order",
          action: "order-failed",
          after: { reference: "AYC-10001", status: "failed" },
        },
      ]);
    });

    it("leaves a Paid Order Paid when a failed event arrives after the paid one", async () => {
      const order = await pending();
      await seam.recordPaymentEvent(eventFor(order));

      expect(
        await seam.recordPaymentEvent(
          eventFor(order, {
            id: "evt_FakePaymentFailed0001",
            type: "payment.failed",
            outcome: "failed",
          }),
        ),
      ).toBe("no-change");
      expect((await arm.orders())[0]?.status).toBe("paid");
    });

    it("makes a Failed Order Paid when a paid event follows: a retry on the same page", async () => {
      const order = await pending();
      await seam.recordPaymentEvent(
        eventFor(order, {
          id: "evt_FakePaymentFailed0001",
          type: "payment.failed",
          outcome: "failed",
        }),
      );
      vi.setSystemTime(at(HOUR));

      expect(await seam.recordPaymentEvent(eventFor(order))).toBe("applied");
      expect((await arm.orders())[0]?.status).toBe("paid");
      expect(await passEnd()).toBe(at(HOUR + 90 * DAY).toISOString());
    });

    it("acknowledges an event for no Order of ours, changing nothing", async () => {
      await pending();

      expect(
        await seam.recordPaymentEvent(
          eventFor(
            { id: "00000000-0000-4000-8000-000000000000", reference: "AYC-99999" },
            { checkoutId: "cs_Unknown" },
          ),
        ),
      ).toBe("unknown-order");
      expect((await arm.orders())[0]?.status).toBe("pending");
      expect(await activity()).toEqual([]);
    });

    it("makes an Expired Order Paid on a late payment, granting its days and noting Paid after expiry", async () => {
      const order = await pending();
      vi.setSystemTime(at(25 * HOUR));
      await seam.expireOverdueOrders(fake);
      expect((await arm.orders())[0]?.status).toBe("expired");
      vi.setSystemTime(at(26 * HOUR));

      expect(await seam.recordPaymentEvent(eventFor(order))).toBe("applied");

      expect(await seam.getMemberOrder(BEA.userId, "AYC-10001")).toMatchObject({
        status: "paid",
        paidAfterExpiry: true,
        accessUntil: at(26 * HOUR + 90 * DAY).toISOString(),
      });
      expect((await activity()).at(-1)).toMatchObject({
        action: "order-paid",
        after: { reference: "AYC-10001", paidAfterExpiry: true },
      });
    });
  });

  describe("expiry at read time", () => {
    it("shows a Pending Order made 25 hours ago as Expired before the sweep runs", async () => {
      await pending();
      vi.setSystemTime(at(25 * HOUR));

      expect(await seam.getMemberOrder(BEA.userId, "AYC-10001")).toMatchObject({
        status: "expired",
      });
      expect((await arm.orders())[0]?.status).toBe("pending");
    });

    it("keeps a Pending Order made 23 hours ago Pending", async () => {
      await pending();
      vi.setSystemTime(at(23 * HOUR));

      expect(await seam.getMemberOrder(BEA.userId, "AYC-10001")).toMatchObject({
        status: "pending",
        paidAfterExpiry: false,
      });
    });

    it("still records a late payment the status check finds on an Order shown Expired", async () => {
      const order = await pending();
      fake.simulate(order.id, "paid");
      vi.setSystemTime(at(25 * HOUR));

      expect(await seam.checkOrderStatus(BEA.userId, "AYC-10001", fake)).toMatchObject({
        status: "paid",
        paidAfterExpiry: true,
      });
    });
  });

  describe("expireOverdueOrders: the daily sweep", () => {
    it("records an overdue Order PayMongo didn't confirm as Expired, after asking, logged as PayMongo", async () => {
      const order = await pending();
      vi.setSystemTime(at(25 * HOUR));

      expect(await seam.expireOverdueOrders(fake)).toEqual({
        checked: 1,
        paid: 0,
        expired: 1,
        unanswered: 0,
      });
      expect(fake.statusChecks).toEqual([
        { orderId: order.id, reference: "AYC-10001", checkoutId: null },
      ]);
      expect(await arm.orders()).toMatchObject([{ status: "expired", paidAt: null }]);
      expect(await activity()).toEqual([
        {
          actor: { ...PAYMONGO_SYSTEM_ACTOR },
          entity: "order",
          action: "order-expired",
          after: { reference: "AYC-10001", status: "expired" },
        },
      ]);
    });

    it("makes an overdue Order PayMongo says is paid Paid, not Expired", async () => {
      const order = await pending();
      fake.simulate(order.id, "paid");
      vi.setSystemTime(at(25 * HOUR));

      expect(await seam.expireOverdueOrders(fake)).toEqual({
        checked: 1,
        paid: 1,
        expired: 0,
        unanswered: 0,
      });
      expect((await arm.orders())[0]?.status).toBe("paid");
      expect(await passEnd()).toBe(at(25 * HOUR + 90 * DAY).toISOString());
    });

    it("leaves Orders younger than 24 hours, and those no longer Pending, alone", async () => {
      const paid = await pending();
      await seam.recordPaymentEvent(eventFor(paid));
      vi.setSystemTime(at(2 * HOUR));
      await pending();
      vi.setSystemTime(at(25 * HOUR));

      expect(await seam.expireOverdueOrders(fake)).toEqual({
        checked: 0,
        paid: 0,
        expired: 0,
        unanswered: 0,
      });
      expect(fake.statusChecks).toEqual([]);
      expect((await arm.orders()).map((order) => order.status)).toEqual(["paid", "pending"]);
    });

    it("leaves an Order with a PayMongo checkout Pending when PayMongo can't answer, for the next sweep", async () => {
      const withCheckout = await pending({
        ...fake,
        startCheckout: async () => ({
          ok: true,
          checkoutId: "cs_FakeCreated0001TestOnly",
          redirectTo: "https://checkout.paymongo.com/cs_FakeCreated0001TestOnly",
          livemode: false,
        }),
      });
      vi.setSystemTime(at(25 * HOUR));

      expect(
        await seam.expireOverdueOrders({
          ...fake,
          checkoutStatus: async () => ({ status: "unknown" }),
        }),
      ).toEqual({ checked: 1, paid: 0, expired: 0, unanswered: 1 });
      expect((await arm.orders())[0]).toMatchObject({ id: withCheckout.id, status: "pending" });
    });

    it("goes on to the next Order when asking about one fails", async () => {
      await pending();
      vi.setSystemTime(at(HOUR));
      await pending();
      vi.setSystemTime(at(26 * HOUR));
      let asked = 0;
      const flaky: PaymentsClient = {
        ...fake,
        checkoutStatus: async () => {
          asked += 1;
          if (asked === 1) throw new Error("connection reset");
          return { status: "pending" };
        },
      };
      vi.spyOn(console, "error").mockImplementation(() => {});

      expect(await seam.expireOverdueOrders(flaky)).toEqual({
        checked: 2,
        paid: 0,
        expired: 1,
        unanswered: 1,
      });
      expect((await arm.orders()).map((order) => order.status)).toEqual(["pending", "expired"]);
      expect(console.error).toHaveBeenCalledWith(
        "The expiry sweep couldn't settle AYC-10001; it's left for the next sweep.",
      );
    });

    it("still expires overdue Orders on a server with no payments client", async () => {
      await pending();
      vi.setSystemTime(at(25 * HOUR));

      expect(await seam.expireOverdueOrders(null)).toEqual({
        checked: 1,
        paid: 0,
        expired: 1,
        unanswered: 0,
      });
    });
  });
});
