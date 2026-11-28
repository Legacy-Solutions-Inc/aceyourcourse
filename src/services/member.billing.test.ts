import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { samplePlanId } from "@/services/mock/plans";
import { createFakePaymentsClient, type FakePaymentsClient } from "@/services/payments.fake";
import type { PaymentsClient } from "@/services/payments.types";

import { MEMBER_ARMS } from "../../test/member-arms";
import { CE_OFFICIAL, withExamDates } from "../../test/member-inputs";

// The Member seam's Billing reads (Phase 4, ticket 06; spec, Phase 4 →
// Payment Acknowledgement; stories 143, 144), run against every arm: every
// Order of the signed-in Member, newest first, as at the read (a Pending
// Order older than 24 hours reads Expired), and the Payment Acknowledgement
// of one of their own Paid Orders: nothing for anyone else's, or for one
// that isn't Paid.
//
// "Now" starts at 17 Nov 2026, 11:42 in Manila.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(BOOT.getTime() + ms);
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

describe.each(MEMBER_ARMS)("Member seam: Billing ($name)", (arm) => {
  const { seam } = arm;
  let fake: FakePaymentsClient;

  /** Pays for a CE Plan; gives the reference. */
  async function pay(userId = BEA.userId, days = 90, client: PaymentsClient = fake) {
    const result = await seam.payForPlan(
      userId,
      { examCode: "CE", planId: samplePlanId("CE", days), method: "gcash" },
      client,
    );
    if (!result.ok) throw new Error(`Pay was refused: ${result.reason}`);
    return result.reference;
  }
  /** Pays and has the payment go through (or fail). */
  async function settled(outcome: "paid" | "failed", userId = BEA.userId, days = 90) {
    const reference = await pay(userId, days);
    const order = await seam.getMemberOrder(userId, reference);
    fake.simulate(order!.id, outcome);
    await seam.checkOrderStatus(userId, reference, fake);
    return reference;
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset(withExamDates);
    for (const member of [BEA, SAM]) {
      await seam.getOrCreateMember(member);
      await seam.addTargetExam(member.userId, { examCode: "CE", examDate: CE_OFFICIAL });
    }
    fake = createFakePaymentsClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("listMemberOrders", () => {
    it("gives nothing before the Member has paid", async () => {
      expect(await seam.listMemberOrders(BEA.userId)).toEqual([]);
    });

    it("gives every Order of the Member's, newest first, with its status and livemode", async () => {
      await settled("paid");
      vi.setSystemTime(at(HOUR));
      await settled("failed", BEA.userId, 30);
      vi.setSystemTime(at(2 * HOUR));
      await pay(BEA.userId, 180);

      expect(
        (await seam.listMemberOrders(BEA.userId)).map(
          ({ reference, status, planName, days, livemode }) => ({
            reference,
            status,
            planName,
            days,
            livemode,
          }),
        ),
      ).toEqual([
        {
          reference: "AYC-10003",
          status: "pending",
          planName: "CE All-Access",
          days: 180,
          livemode: false,
        },
        {
          reference: "AYC-10002",
          status: "failed",
          planName: "CE All-Access",
          days: 30,
          livemode: false,
        },
        {
          reference: "AYC-10001",
          status: "paid",
          planName: "CE All-Access",
          days: 90,
          livemode: false,
        },
      ]);
    });

    it("reads a Pending Order older than 24 hours as Expired", async () => {
      await pay();
      vi.setSystemTime(at(25 * HOUR));

      expect(await seam.listMemberOrders(BEA.userId)).toMatchObject([
        { reference: "AYC-10001", status: "expired" },
      ]);
    });

    it("never gives another Member's Orders", async () => {
      await settled("paid", SAM.userId);

      expect(await seam.listMemberOrders(BEA.userId)).toEqual([]);
      expect(await seam.listMemberOrders(SAM.userId)).toHaveLength(1);
    });
  });

  describe("getPaymentAcknowledgement", () => {
    it("gives a Paid Order's Acknowledgement: the buyer as at Pay and the access period it paid for", async () => {
      const reference = await settled("paid");

      expect(await seam.getPaymentAcknowledgement(BEA.userId, reference)).toEqual({
        order: expect.objectContaining({
          reference: "AYC-10001",
          planName: "CE All-Access",
          days: 90,
          priceCentavos: 129_900,
          method: "gcash",
          status: "paid",
          paidAt: BOOT.toISOString(),
          livemode: false,
        }),
        buyer: { name: "Bea Tester", email: "tester@example.com" },
        access: { startsAt: BOOT.toISOString(), endsAt: at(90 * DAY).toISOString() },
        payMongoReference: null,
      });
    });

    it("gives PayMongo's payment id as its reference, or its checkout id while there's none", async () => {
      const payMongo: PaymentsClient = {
        ...fake,
        kind: "paymongo",
        startCheckout: async () => ({
          ok: true,
          checkoutId: "cs_FakeCreated0001TestOnly",
          redirectTo: "https://checkout.paymongo.com/cs_FakeCreated0001TestOnly",
          livemode: false,
        }),
        checkoutStatus: async () => ({ status: "paid", paymentId: "pay_FakePaid0001TestOnly" }),
      };
      const reference = await pay(BEA.userId, 90, payMongo);
      await seam.checkOrderStatus(BEA.userId, reference, payMongo);

      expect(await seam.getPaymentAcknowledgement(BEA.userId, reference)).toMatchObject({
        payMongoReference: "pay_FakePaid0001TestOnly",
      });
    });

    it.each([
      ["Pending", async () => pay()],
      ["Failed", async () => settled("failed")],
    ] as const)("gives nothing for a %s Order", async (_what, made) => {
      const reference = await made();
      expect(await seam.getPaymentAcknowledgement(BEA.userId, reference)).toBeNull();
    });

    it("gives nothing for an Order that's Expired", async () => {
      const reference = await pay();
      vi.setSystemTime(at(25 * HOUR));
      await seam.expireOverdueOrders(fake);

      expect(await seam.getPaymentAcknowledgement(BEA.userId, reference)).toBeNull();
    });

    it("never gives another Member's Acknowledgement", async () => {
      const reference = await settled("paid", SAM.userId);

      expect(await seam.getPaymentAcknowledgement(BEA.userId, reference)).toBeNull();
      expect(await seam.getPaymentAcknowledgement(SAM.userId, reference)).not.toBeNull();
    });

    it.each(["AYC-99999", "nonsense"])("gives nothing for %j", async (reference) => {
      await settled("paid");
      expect(await seam.getPaymentAcknowledgement(BEA.userId, reference)).toBeNull();
    });
  });
});
