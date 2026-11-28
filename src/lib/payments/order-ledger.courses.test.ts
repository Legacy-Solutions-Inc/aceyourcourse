import { describe, expect, it } from "vitest";

import {
  applyOutcome,
  awaitsAlreadyOwnedRefund,
  type Order,
  orderItem,
  ownershipAfterRefund,
} from "./order-ledger";

// The Order ledger for Course Orders (Phase 5, ticket 06; spec, Phase 5
// planning decisions → The Order ledger for Course Orders; Testing Decisions
// → Seam 4), pure. A Course Order holds one Course and no days: Paid grants
// Course Ownership, never days on an Access Pass. Paid on a Course the buyer
// already owns (two tabs, a late payment) grants nothing and is marked for a
// refund in PayMongo. A full refund (ticket 07) removes the Course Ownership
// unless another Paid Order or a gift still holds it. "Now" is 28 Nov 2026,
// 20:00 in Manila.
const NOW = new Date("2026-11-28T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * HOUR).toISOString();

const COURSE_ORDER: Order = {
  id: "2c9d6a4e-1b3f-4e7a-9d8c-5b6a7f8e9d01",
  reference: "AYC-10007",
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  examCode: "CE",
  planId: null,
  courseId: "6a1e2d3c-4b5a-4f6e-8d7c-9b0a1f2e3d4c",
  planName: "PSAD Masterclass",
  days: null,
  priceCentavos: 149_900,
  method: "qrph",
  status: "pending",
  livemode: false,
  checkoutId: null,
  paymentId: null,
  buyerName: "Bea Tester",
  buyerEmail: "tester@example.com",
  createdAt: hoursAgo(1),
  paidAt: null,
  statusChangedAt: hoursAgo(1),
  paidWithoutAccount: false,
  paidAlreadyOwned: false,
};

const PLAN_ORDER: Order = {
  ...COURSE_ORDER,
  planId: "5d7c9e1a-3b2f-4a6d-9c8e-7f6a5b4c3d2e",
  courseId: null,
  planName: "CE All-Access",
  days: 90,
};

describe("applyOutcome: a Course Order", () => {
  it("grants Course Ownership on Paid, and no days on any pass", () => {
    const step = applyOutcome(COURSE_ORDER, "paid", "2026-12-20T15:59:59.999Z", NOW);

    expect(step).toEqual({
      changed: true,
      order: {
        ...COURSE_ORDER,
        status: "paid",
        paidAt: NOW.toISOString(),
        statusChangedAt: NOW.toISOString(),
      },
      paidDays: null,
      course: "owns",
    });
  });

  it("grants it too when a Failed Order becomes Paid (a retry on the same PayMongo page)", () => {
    const step = applyOutcome({ ...COURSE_ORDER, status: "failed" }, "paid", null, NOW);

    expect(step.changed && step.course).toBe("owns");
  });

  it("grants it too when an Expired Order becomes Paid (a late payment)", () => {
    const expired = { ...COURSE_ORDER, status: "expired" as const, createdAt: hoursAgo(30) };
    const step = applyOutcome(expired, "paid", null, NOW);

    expect(step.changed && step.course).toBe("owns");
    expect(step.changed && step.order.status).toBe("paid");
  });

  it("records Paid on a Course already owned, granting nothing, marked for a refund", () => {
    const step = applyOutcome(COURSE_ORDER, "paid", null, NOW, true);

    expect(step.changed && step.course).toBe("already-owned");
    expect(step.changed && step.order).toMatchObject({
      status: "paid",
      paidAlreadyOwned: true,
    });
  });

  it("grants nothing on Failed or Expired", () => {
    expect(applyOutcome(COURSE_ORDER, "failed", null, NOW)).toMatchObject({
      changed: true,
      paidDays: null,
      course: null,
    });
    expect(applyOutcome(COURSE_ORDER, "expired", null, NOW)).toMatchObject({
      changed: true,
      paidDays: null,
      course: null,
    });
  });

  it("applies Paid once: a second paid outcome changes nothing", () => {
    const paid = applyOutcome(COURSE_ORDER, "paid", null, NOW);
    if (!paid.changed) throw new Error("Expected Paid.");

    expect(applyOutcome(paid.order, "paid", null, NOW, true)).toEqual({ changed: false });
  });
});

describe("applyOutcome: a Plan Order, as before", () => {
  it("adds its days and grants no Course, even when told the buyer owns one", () => {
    const step = applyOutcome(PLAN_ORDER, "paid", null, NOW, true);

    expect(step.changed && step.course).toBeNull();
    expect(step.changed && step.paidDays?.days).toBe(90);
    expect(step.changed && step.order.paidAlreadyOwned).toBe(false);
  });
});

describe("awaitsAlreadyOwnedRefund", () => {
  it("is a Course Order paid while the Course was owned, still Paid: one to refund in PayMongo", () => {
    const paidTwice = { ...COURSE_ORDER, status: "paid" as const, paidAlreadyOwned: true };

    expect(awaitsAlreadyOwnedRefund(paidTwice)).toBe(true);
    expect(awaitsAlreadyOwnedRefund({ ...paidTwice, status: "refunded" })).toBe(false);
    expect(awaitsAlreadyOwnedRefund({ ...paidTwice, paidAlreadyOwned: false })).toBe(false);
  });
});

describe("orderItem", () => {
  it("names a Plan Order with its period", () => {
    expect(orderItem(PLAN_ORDER)).toBe("CE All-Access · 3 months");
  });

  it("names a Course Order as a video course, with no access period", () => {
    expect(orderItem(COURSE_ORDER)).toBe("PSAD Masterclass · Video course");
  });
});

describe("ownershipAfterRefund (ticket 07)", () => {
  const PAID = { ...COURSE_ORDER, status: "paid" as const, paidAt: hoursAgo(1) };
  const SECOND = { id: "8e7d6c5b-4a3f-4e2d-9c1b-0a9f8e7d6c5b", reference: "AYC-10009" };
  const THIRD = { id: "9f8e7d6c-5b4a-4f3e-8d2c-1b0a9f8e7d6c", reference: "AYC-10011" };
  const boughtWith = (order: Pick<Order, "id">) => ({ orderId: order.id });

  it("removes the Ownership a fully refunded Order gave, when nothing else holds it", () => {
    expect(ownershipAfterRefund(boughtWith(PAID), PAID, [])).toEqual({ kind: "removed" });
  });

  it("keeps it when another Paid Order for the Course holds it, which then gives it", () => {
    expect(ownershipAfterRefund(boughtWith(PAID), PAID, [SECOND, THIRD])).toEqual({
      kind: "moved",
      to: SECOND,
    });
  });

  it("keeps it when another Order gave it: refunding the second, paid while owned, removes nothing", () => {
    expect(ownershipAfterRefund(boughtWith(PAID), { ...PAID, ...SECOND }, [PAID])).toEqual({
      kind: "kept",
    });
  });

  it("never removes a given Ownership", () => {
    expect(ownershipAfterRefund({ orderId: null }, PAID, [])).toEqual({ kind: "kept" });
  });

  it("changes nothing when the buyer owns the Course no longer, or never did", () => {
    expect(ownershipAfterRefund(null, PAID, [])).toEqual({ kind: "kept" });
  });
});
