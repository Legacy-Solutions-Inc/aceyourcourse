import { describe, expect, it } from "vitest";

import type { AdminOrder } from "@/services/admin.types";

import {
  checkMessage,
  orderItem,
  orderStatusLabel,
  orderStatusTag,
  orderTimeline,
  partialRefundLabel,
  payMongoDashboardUrl,
  payMongoReference,
  statusNote,
} from "./order-view";

// What the Order detail page says (Phase 4, ticket 07; story 148; BUILD-MAP
// §3.9), pure: the item, the status, the timeline by status (with "Paid after
// expiry" where it applies), the status note, what "Check status with
// PayMongo" found, and the PayMongo reference and dashboard link. Refunds
// (ticket 09) show on the timeline and the status note, and a partial one
// as "PARTIALLY REFUNDED · ₱300".

const MADE = "2026-11-24T12:14:00.000Z";
const PAID = "2026-11-24T12:16:00.000Z";
const DAY_LATER = "2026-11-25T12:14:00.000Z";

function order(fields: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "id-1",
    reference: "AYC-10479",
    userId: "user-1",
    examCode: "ME",
    planId: "plan-me-30",
    planName: "ME All-Access",
    days: 30,
    priceCentavos: 44_900,
    method: "maya",
    status: "pending",
    recordedStatus: "pending",
    paidAfterExpiry: false,
    invoice: null,
    refunds: [],
    refundedCentavos: 0,
    livemode: true,
    checkoutId: "cs_Checkout0001",
    paymentId: null,
    buyerName: "Paolo Reyes",
    buyerEmail: "paolo.reyes@example.com",
    createdAt: MADE,
    paidAt: null,
    statusChangedAt: MADE,
    ...fields,
  };
}

const paid = (fields: Partial<AdminOrder> = {}) =>
  order({
    status: "paid",
    recordedStatus: "paid",
    method: "gcash",
    paidAt: PAID,
    statusChangedAt: PAID,
    paymentId: "pay_Payment0001",
    ...fields,
  });

describe("orderItem and the status", () => {
  it("names the Plan and its months", () => {
    expect(orderItem(order())).toBe("ME All-Access · 1 month");
    expect(orderItem(paid({ planName: "CE All-Access", days: 90 }))).toBe(
      "CE All-Access · 3 months",
    );
  });

  it("labels each status", () => {
    expect(orderStatusLabel("paid")).toBe("Paid");
    expect(orderStatusLabel("expired")).toBe("Expired");
    expect(orderStatusTag("pending")).toBe("PENDING");
    expect(orderStatusTag("refunded")).toBe("REFUNDED");
  });
});

describe("orderTimeline", () => {
  it("shows a Paid Order's checkout, payment and PayMongo's confirmation", () => {
    expect(orderTimeline(paid())).toEqual([
      { label: "Checkout started", at: MADE, tone: "info" },
      { label: "Paid with GCash", at: PAID, tone: "info" },
      { label: "PayMongo confirmed · access granted", at: PAID, tone: "done" },
    ]);
  });

  it("shows a Pending Order waiting for its method", () => {
    expect(orderTimeline(order())).toEqual([
      { label: "Checkout started", at: MADE, tone: "info" },
      { label: "Sent to Maya", at: MADE, tone: "info" },
      { label: "Waiting for Maya to confirm", at: null, tone: "waiting" },
    ]);
  });

  it("shows a Pending Order past its 24 hours as Expired then", () => {
    expect(orderTimeline(order({ status: "expired" })).at(-1)).toEqual({
      label: "Expired · no payment confirmed within 24 hours",
      at: DAY_LATER,
      tone: "failed",
    });
  });

  it("shows a declined card, and another method's failed payment", () => {
    const failed = { status: "failed", recordedStatus: "failed", statusChangedAt: PAID } as const;
    expect(orderTimeline(order({ ...failed, method: "card" }))).toEqual([
      { label: "Checkout started", at: MADE, tone: "info" },
      { label: "Card declined by the bank", at: PAID, tone: "failed" },
    ]);
    expect(orderTimeline(order({ ...failed, method: "gcash" })).at(-1)?.label).toBe(
      "GCash payment didn’t go through",
    );
  });

  it("shows Paid after expiry where it applies", () => {
    const late = "2026-11-25T14:00:00.000Z";
    expect(orderTimeline(paid({ paidAfterExpiry: true, paidAt: late }))).toEqual([
      { label: "Checkout started", at: MADE, tone: "info" },
      { label: "Expired · no payment confirmed within 24 hours", at: DAY_LATER, tone: "failed" },
      { label: "Paid after expiry · with GCash", at: late, tone: "info" },
      { label: "PayMongo confirmed · access granted", at: late, tone: "done" },
    ]);
  });

  it("ends a Refunded Order with its refund", () => {
    const refunded = "2026-11-26T01:00:00.000Z";
    expect(
      orderTimeline(
        paid({ status: "refunded", recordedStatus: "refunded", statusChangedAt: refunded }),
      ).at(-1),
    ).toEqual({ label: "Refunded in PayMongo", at: refunded, tone: "failed" });
  });

  // Ticket 09: each succeeded refund is a step, at the time PayMongo refunded it.
  const refund = (id: string, amountCentavos: number, refundedAt: string) => ({
    id,
    orderId: "id-AYC-10483",
    amountCentavos,
    status: "succeeded" as const,
    refundedAt,
  });
  const FIRST = "2026-11-26T01:00:00.000Z";
  const SECOND = "2026-11-27T01:00:00.000Z";

  it("ends a fully refunded Order with its refund and amount, its unused days removed", () => {
    expect(
      orderTimeline(
        paid({
          status: "refunded",
          recordedStatus: "refunded",
          priceCentavos: 49_900,
          refunds: [refund("ref_a", 49_900, FIRST)],
          refundedCentavos: 49_900,
        }),
      ).slice(-2),
    ).toEqual([
      { label: "PayMongo confirmed · access granted", at: PAID, tone: "done" },
      {
        label: "Refunded in full in PayMongo · ₱499 · unused days removed",
        at: FIRST,
        tone: "failed",
      },
    ]);
  });

  it("adds a partial refund to a Paid Order's timeline, access unchanged", () => {
    expect(
      orderTimeline(
        paid({ refunds: [refund("ref_a", 30_000, FIRST)], refundedCentavos: 30_000 }),
      ).at(-1),
    ).toEqual({
      label: "Partially refunded in PayMongo · ₱300 · access unchanged",
      at: FIRST,
      tone: "info",
    });
  });

  it("shows partial refunds adding up to the whole amount, the last one refunding it in full", () => {
    expect(
      orderTimeline(
        paid({
          status: "refunded",
          recordedStatus: "refunded",
          priceCentavos: 49_900,
          refunds: [refund("ref_a", 30_000, FIRST), refund("ref_b", 19_900, SECOND)],
          refundedCentavos: 49_900,
        }),
      ).slice(-2),
    ).toEqual([
      {
        label: "Partially refunded in PayMongo · ₱300 · access unchanged",
        at: FIRST,
        tone: "info",
      },
      {
        label: "Refunded in full in PayMongo · ₱199 · unused days removed",
        at: SECOND,
        tone: "failed",
      },
    ]);
  });
});

describe("partialRefundLabel (ticket 09)", () => {
  it("names a Paid Order's partial refund: PARTIALLY REFUNDED · ₱300", () => {
    expect(partialRefundLabel(paid({ refundedCentavos: 30_000 }))).toBe(
      "PARTIALLY REFUNDED · ₱300",
    );
  });

  it("names nothing for an Order with no refund, or a Refunded one (its status says so)", () => {
    expect(partialRefundLabel(paid())).toBeNull();
    expect(
      partialRefundLabel(
        paid({ status: "refunded", recordedStatus: "refunded", refundedCentavos: 129_900 }),
      ),
    ).toBeNull();
  });
});

describe("statusNote", () => {
  it("tells a Pending Order's waiting rules", () => {
    expect(statusNote(order())).toBe(
      "Maya hasn’t confirmed this payment yet. Access is granted automatically when PayMongo confirms. Pending payments expire after 24 hours.",
    );
  });

  it("tells a Paid Order's, and adds when it was paid after expiry", () => {
    expect(statusNote(paid())).toBe(
      "Paid and confirmed by PayMongo. Access started right away. Refunds, if any, are issued from the PayMongo dashboard.",
    );
    expect(statusNote(paid({ paidAfterExpiry: true }))).toMatch(
      /^Paid after expiry: PayMongo confirmed it more than 24 hours after checkout started/,
    );
  });

  it("tells a partially refunded Order's amount, and that access didn't change (ticket 09)", () => {
    expect(statusNote(paid({ refundedCentavos: 30_000 }))).toBe(
      "Paid and confirmed by PayMongo. Access started right away. PayMongo refunded ₱300 of it, which changed no access: adjust it on the Member’s page if needed.",
    );
  });

  it("tells a Refunded Order that its unused days came off and the Member was told", () => {
    expect(statusNote(paid({ status: "refunded", recordedStatus: "refunded" }))).toBe(
      "Refunded in full in PayMongo. This Order’s unused days came off the Access Pass, and the Member was told in the app.",
    );
  });

  it("tells a Failed Order what the Member saw", () => {
    expect(statusNote(order({ status: "failed", method: "card" }))).toBe(
      "The payment didn’t go through and the Member wasn’t charged. They saw “Your card was declined” with other ways to pay.",
    );
  });

  it("tells an Expired Order that a late payment still counts", () => {
    expect(statusNote(order({ status: "expired" }))).toBe(
      "No payment was confirmed within 24 hours, so this Order expired and granted nothing. If PayMongo confirms a late payment, it still counts and access is granted.",
    );
  });
});

describe("checkMessage", () => {
  it("says what PayMongo said", () => {
    expect(checkMessage({ outcome: "still-pending", order: order() })).toBe(
      "CHECKED JUST NOW · STILL PENDING AT MAYA",
    );
    expect(checkMessage({ outcome: "paid", order: paid() })).toBe(
      "CHECKED JUST NOW · PAID · ACCESS GRANTED",
    );
    expect(checkMessage({ outcome: "failed", order: order({ status: "failed" }) })).toBe(
      "CHECKED JUST NOW · PAYMENT FAILED · NOTHING GRANTED",
    );
    expect(checkMessage({ outcome: "unknown", order: order() })).toBe(
      "CHECKED JUST NOW · PAYMONGO COULDN’T SAY · NOTHING CHANGED",
    );
  });

  it("says nothing was asked about an Order that isn't Pending", () => {
    expect(checkMessage({ outcome: "not-pending", order: paid() })).toBe(
      "NOTHING TO CHECK · THIS ORDER IS PAID",
    );
  });
});

describe("PayMongo's reference and dashboard link", () => {
  it("gives the payment ID, or the checkout's while there's no payment", () => {
    expect(payMongoReference(paid())).toBe("pay_Payment0001");
    expect(payMongoReference(order())).toBe("cs_Checkout0001");
    expect(payMongoReference(order({ checkoutId: null }))).toBeNull();
  });

  it("links to the payment in the dashboard's Payments search, only with a payment ID", () => {
    expect(payMongoDashboardUrl(paid())).toBe(
      "https://dashboard.paymongo.com/payments?search=pay_Payment0001",
    );
    expect(payMongoDashboardUrl(order())).toBeNull();
  });
});
