import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { orderReference } from "@/lib/payments/order-ledger";
import { examsForMembers } from "@/services/member.rules";
import { samplePlanId } from "@/services/mock/plans";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import type { PaymentsClient } from "@/services/payments.types";
import { createFakePaymentsClient } from "@/services/payments.fake";

import { orderCalls, type OrderStore } from "./orders.core";

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
    addOrder: async (draft) => {
      added.push(draft.id);
      return { ...draft, reference: orderReference(10_001) };
    },
    recordCheckout: async () => {
      throw new Error("connection lost");
    },
    claimStatusCheck: async () => true,
    findOwnOrder: async () => null,
    withOrder: async () => null,
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
