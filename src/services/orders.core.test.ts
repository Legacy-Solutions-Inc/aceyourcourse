import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type Order, orderReference, PAYMONGO_SYSTEM_ACTOR } from "@/lib/payments/order-ledger";
import { examsForMembers } from "@/services/member.rules";
import { samplePlanId } from "@/services/mock/plans";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import type { PaymentsClient } from "@/services/payments.types";
import { createFakePaymentsClient } from "@/services/payments.fake";

import { orderCalls, type OrderHolding, type OrderStore, settleOrder } from "./orders.core";

// Pay when the Order's checkout can't be kept (Phase 4, ticket 04): PayMongo
// started a Checkout Session, but recording it on the Order failed. The
// Member isn't sent to a checkout the Order doesn't know about: Pay is
// refused as a checkout that couldn't start, and the Order stays Pending.
// The arms' stores don't fail on demand, so this runs the shared core over a
// store whose write fails.

const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
  joinedAt: "2026-11-01T00:00:00.000Z",
};

const PAYMONGO: PaymentsClient = {
  ...createFakePaymentsClient(),
  kind: "paymongo",
  startCheckout: async () => ({
    ok: true,
    checkoutId: "cs_FakeCreated0001TestOnly",
    redirectTo: "https://checkout.paymongo.com/cs_FakeCreated0001TestOnly",
    livemode: false,
  }),
};

/** A store over the sample catalogue whose recording of the checkout fails. */
function storeFailingToRecord(): OrderStore & { added: string[] } {
  const added: string[] = [];
  return {
    added,
    readOnSale: async () => ({
      exams: examsForMembers(structuredClone(getSampleStore().catalogue)),
      plans: getSampleStore().plans.filter((plan) => plan.onSale),
    }),
    readMember: async () => BEA,
    readCourse: async () => null,
    readOwnedCourseIds: async () => [],
    addOrder: async (draft) => {
      added.push(draft.id);
      return { ...draft, reference: orderReference(10_001) };
    },
    recordCheckout: async () => {
      throw new Error("connection lost");
    },
    claimStatusCheck: async () => true,
    findOwnOrder: async () => null,
    listOwnOrders: async () => [],
    withOrder: async () => null,
    withPaymentEvent: async () => ({ recorded: true, found: false }),
    listOverdueOrders: async () => [],
    addInvoiceRequest: async () => false,
  };
}

beforeEach(() => {
  resetSampleStore();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("payForPlan when the checkout can't be recorded", () => {
  it("refuses as a checkout that couldn't start, sending the Member nowhere, and logs it", async () => {
    const store = storeFailingToRecord();
    const { payForPlan } = orderCalls(store);

    expect(
      await payForPlan(
        BEA.userId,
        { examCode: "CE", planId: samplePlanId("CE", 90), method: "gcash" },
        PAYMONGO,
      ),
    ).toEqual({ ok: false, reason: "checkout-failed" });
    expect(store.added).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith(
      "The checkout for AYC-10001 wasn't recorded, so the Member wasn't sent to it.",
    );
  });
});

// The Order ledger's outcome on an Order whose account was deleted (ticket 14):
// settleOrder records Paid with no grant, marks it paid without an account for
// an Owner to refund in PayMongo, and logs it under PayMongo (system).
describe("settleOrder on an Order with no account", () => {
  const NOW = new Date("2026-11-18T05:42:00.000Z");
  const EXPIRED: Order = {
    id: "00000000-0000-4000-8000-000000010001",
    reference: "AYC-10001",
    userId: null,
    examCode: "CE",
    planId: samplePlanId("CE", 90),
    courseId: null,
    planName: "CE All-Access",
    days: 90,
    priceCentavos: 129_900,
    method: "gcash",
    status: "expired",
    livemode: true,
    checkoutId: "cs_Sample10001",
    paymentId: null,
    buyerName: BEA.name,
    buyerEmail: BEA.email,
    createdAt: "2026-11-17T03:42:00.000Z",
    paidAt: null,
    statusChangedAt: "2026-11-18T03:42:00.000Z",
    paidWithoutAccount: false,
    paidAlreadyOwned: false,
  };
  const gone = (order: Order): OrderHolding => ({
    order,
    member: null,
    pass: null,
    targetExams: [],
    history: [],
    ownsCourse: false,
    refunds: [],
  });

  it("records a late payment Paid, granting nothing, marked to refund in PayMongo", () => {
    expect(settleOrder(gone(EXPIRED), "paid", "pay_Late0001", NOW)).toEqual({
      order: {
        ...EXPIRED,
        status: "paid",
        paidAt: NOW.toISOString(),
        statusChangedAt: NOW.toISOString(),
        paymentId: "pay_Late0001",
        paidWithoutAccount: true,
      },
      paid: null,
      ownership: null,
      refunds: [],
      reduction: null,
      activity: expect.objectContaining({
        actor: { ...PAYMONGO_SYSTEM_ACTOR },
        entity: "order",
        entityId: EXPIRED.id,
        action: "order-paid",
        before: { reference: "AYC-10001", status: "expired" },
        after: {
          reference: "AYC-10001",
          status: "paid",
          paidAfterExpiry: true,
          paidWithoutAccount: true,
        },
      }),
    });
  });

  it("leaves a failed or expired outcome unmarked: it was never paid", () => {
    const pending: Order = { ...EXPIRED, status: "pending", statusChangedAt: EXPIRED.createdAt };
    const write = settleOrder(gone(pending), "failed", null, NOW);
    expect(write?.order).toMatchObject({ status: "failed", paidWithoutAccount: false });
    expect(write?.activity?.after).toEqual({ reference: "AYC-10001", status: "failed" });
  });
});
