import { describe, expect, it } from "vitest";

import { passEndDate } from "@/lib/member-app/access";

import {
  applyOutcome,
  isOrderReference,
  type Order,
  orderReference,
  FIRST_REFERENCE_NUMBER,
} from "./order-ledger";

// The Order ledger (spec, Phase 4 → Order ledger, References; Phase 4
// planning decisions → Paying; Testing Decisions → Seam 4), pure. A Pending
// Order becomes Paid or Failed; Paid is the only state that grants access,
// adding the Order's days to the Member's Access Pass from its end, or from
// now when it has ended or there is none. Each outcome is applied once.
// "Now" is 17 Nov 2026, 11:42 in Manila (03:42 UTC).
const NOW = new Date("2026-11-17T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number, from = NOW) => new Date(from.getTime() + days * DAY).toISOString();

const PENDING: Order = {
  id: "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b",
  reference: "AYC-10001",
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  examCode: "CE",
  planId: "5d7c9e1a-3b2f-4a6d-9c8e-7f6a5b4c3d2e",
  planName: "CE All-Access",
  days: 90,
  priceCentavos: 129_900,
  method: "gcash",
  status: "pending",
  livemode: false,
  checkoutId: null,
  paymentId: null,
  buyerName: "Bea Tester",
  buyerEmail: "tester@example.com",
  createdAt: inDays(-1 / 24),
  paidAt: null,
  statusChangedAt: inDays(-1 / 24),
};

describe("applyOutcome: Pending → Paid", () => {
  it("adds the Order's days to an active pass from its end: 20 days left + 90 = 110", () => {
    const step = applyOutcome(PENDING, "paid", inDays(20), NOW);

    expect(step).toEqual({
      changed: true,
      order: {
        ...PENDING,
        status: "paid",
        paidAt: NOW.toISOString(),
        statusChangedAt: NOW.toISOString(),
      },
      paidDays: { days: 90, startsAt: inDays(20), endsAt: inDays(110) },
    });
  });

  it("counts from now once the pass has ended: 30 days bought are 30 days from now", () => {
    const step = applyOutcome({ ...PENDING, days: 30 }, "paid", inDays(-5), NOW);

    expect(step.changed && step.paidDays).toEqual({
      days: 30,
      startsAt: NOW.toISOString(),
      endsAt: inDays(30),
    });
  });

  it("counts from now with no pass", () => {
    const step = applyOutcome(PENDING, "paid", null, NOW);

    expect(step.changed && step.paidDays).toEqual({
      days: 90,
      startsAt: NOW.toISOString(),
      endsAt: inDays(90),
    });
  });

  it("dates the end in Manila: paid a minute before midnight there, 30 days end that same day", () => {
    // 23:59 on 17 Nov in Manila is 15:59 UTC.
    const lateEvening = new Date("2026-11-17T15:59:00.000Z");
    const step = applyOutcome({ ...PENDING, days: 30 }, "paid", null, lateEvening);

    expect(step.changed && step.paidDays && passEndDate(step.paidDays.endsAt)).toBe("17 Dec 2026");
  });

  it("dates the end in Manila: paid a minute after midnight there, the next day, though UTC isn't", () => {
    // 00:01 on 18 Nov in Manila is still 17 Nov, 16:01 UTC.
    const justAfter = new Date("2026-11-17T16:01:00.000Z");
    const step = applyOutcome({ ...PENDING, days: 30 }, "paid", null, justAfter);

    expect(step.changed && step.paidDays && passEndDate(step.paidDays.endsAt)).toBe("18 Dec 2026");
  });
});

describe("applyOutcome: Pending → Failed", () => {
  it("marks the Order Failed and grants nothing", () => {
    const step = applyOutcome(PENDING, "failed", inDays(20), NOW);

    expect(step).toEqual({
      changed: true,
      order: { ...PENDING, status: "failed", statusChangedAt: NOW.toISOString() },
      paidDays: null,
    });
  });
});

describe("applyOutcome: each outcome once", () => {
  const paid = {
    ...PENDING,
    status: "paid" as const,
    paidAt: inDays(-1),
    statusChangedAt: inDays(-1),
  };
  const failed = { ...PENDING, status: "failed" as const, statusChangedAt: inDays(-1) };

  it("changes nothing when Paid is applied to an Order already Paid: the pass is extended once", () => {
    expect(applyOutcome(paid, "paid", inDays(110), NOW)).toEqual({ changed: false });
  });

  it("changes nothing when Failed is applied twice", () => {
    expect(applyOutcome(failed, "failed", null, NOW)).toEqual({ changed: false });
  });

  it("never moves a Paid Order back to Failed", () => {
    expect(applyOutcome(paid, "failed", inDays(110), NOW)).toEqual({ changed: false });
  });

  it.each(["expired", "refunded"] as const)("changes nothing for an Order %s", (status) => {
    expect(applyOutcome({ ...PENDING, status }, "paid", null, NOW)).toEqual({ changed: false });
  });
});

describe("references", () => {
  it("run from AYC-10001 upward", () => {
    expect(FIRST_REFERENCE_NUMBER).toBe(10_001);
    expect(orderReference(10_001)).toBe("AYC-10001");
    expect(orderReference(123_456)).toBe("AYC-123456");
  });

  it("knows a reference from anything else an address could carry", () => {
    expect(isOrderReference("AYC-10483")).toBe(true);
    expect(isOrderReference("AYC-123456")).toBe(true);
    expect(isOrderReference("ayc-10483")).toBe(false);
    expect(isOrderReference("AYC-1")).toBe(false);
    expect(isOrderReference("AYC-10483 ")).toBe(false);
    expect(isOrderReference("10483")).toBe(false);
  });
});
