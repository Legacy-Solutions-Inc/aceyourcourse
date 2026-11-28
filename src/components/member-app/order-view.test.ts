import { describe, expect, it } from "vitest";

import type { MemberOrder } from "@/services/member.types";

import { orderLine, orderScreen, paymentLine, STILL_WAITING_MS, stillWaiting } from "./order-view";

// The Order screens, worded (Phase 4, ticket 03; BUILD-MAP §3 Pay pending,
// Pay failed, Pay success; spec, Phase 4 → Return flow): which screen an
// Order shows, its summary and payment lines, and when Confirming payment
// says it's still waiting (about 2 minutes on).
const ORDER: MemberOrder = {
  id: "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b",
  reference: "AYC-10483",
  examCode: "CE",
  courseId: null,
  planName: "CE All-Access",
  days: 90,
  priceCentavos: 129_900,
  method: "qrph",
  status: "pending",
  createdAt: "2026-11-17T03:42:00.000Z",
  paidAt: null,
  accessUntil: null,
  paidAfterExpiry: false,
  livemode: false,
  invoice: null,
  refundedCentavos: 0,
  refundedAt: null,
};

describe("orderScreen", () => {
  it.each([
    ["pending", "confirming"],
    ["paid", "paid"],
    ["failed", "failed"],
    ["expired", "billing"],
    ["refunded", "billing"],
  ] as const)("shows a %s Order the %s screen", (status, screen) => {
    expect(orderScreen(status)).toBe(screen);
  });
});

describe("orderLine", () => {
  it("names the Plan, its period and price in capitals", () => {
    expect(orderLine(ORDER)).toBe("CE ALL-ACCESS · 3 MONTHS · ₱1,299");
  });
});

describe("paymentLine", () => {
  it("gives the amount, method and reference, and where the receipt is", () => {
    expect(paymentLine(ORDER)).toBe("₱1,299 · QR PH · REF AYC-10483 · ACKNOWLEDGEMENT IN BILLING");
  });
});

describe("stillWaiting", () => {
  const at = (ms: number) => new Date(new Date(ORDER.createdAt).getTime() + ms);

  it("waits quietly for about 2 minutes", () => {
    expect(STILL_WAITING_MS).toBe(120_000);
    expect(stillWaiting(ORDER.createdAt, at(119_999))).toBe(false);
  });

  it("says it's still waiting from 2 minutes on", () => {
    expect(stillWaiting(ORDER.createdAt, at(120_000))).toBe(true);
    expect(stillWaiting(ORDER.createdAt, at(3_600_000))).toBe(true);
  });
});
