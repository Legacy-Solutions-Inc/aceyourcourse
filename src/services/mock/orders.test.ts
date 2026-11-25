import { beforeEach, describe, expect, it } from "vitest";

import { effectiveStatus } from "@/lib/payments/order-ledger";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleOrders } from "./orders";

// The sample Orders (Phase 4, ticket 07): the dev server's data and the e2e
// specs' reset start with Paid, Pending and Failed Orders, one older than 30
// days and one Test Order, for buyers no sample Member is. Unit tests start
// without them.

const BOOT = new Date("2026-11-25T02:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("sampleOrders", () => {
  const { orders, nextOrderNumber } = sampleOrders(BOOT, CATALOGUE_SEED);

  it("numbers them from AYC-10001, oldest first, and the next Order after them", () => {
    expect(orders.map(({ reference }) => reference)).toEqual([
      "AYC-10001",
      "AYC-10002",
      "AYC-10003",
      "AYC-10004",
      "AYC-10005",
      "AYC-10006",
    ]);
    expect(nextOrderNumber).toBe(10_007);
    const made = orders.map(({ createdAt }) => createdAt);
    expect([...made].sort()).toEqual(made);
  });

  it("has Paid, Pending and Failed ones, a Test Order, and one older than 30 days", () => {
    expect(orders.map((order) => effectiveStatus(order, BOOT))).toEqual([
      "paid",
      "paid",
      "paid",
      "failed",
      "paid",
      "pending",
    ]);
    expect(orders.filter(({ livemode }) => !livemode)).toHaveLength(1);
    expect(
      orders.filter(({ createdAt }) => new Date(createdAt) < new Date(BOOT.getTime() - 30 * DAY)),
    ).toHaveLength(1);
    expect(
      orders.filter(({ method, status }) => method === "gcash" && status === "paid"),
    ).toHaveLength(2);
  });

  it("keeps the ledger's rules: paid at once Paid, a payment ID only once paid", () => {
    for (const order of orders) {
      expect(order.paidAt !== null).toBe(order.status === "paid");
      expect(order.paymentId !== null).toBe(order.status === "paid");
    }
  });

  it("uses made-up example.com buyers, never a sample Member", () => {
    for (const { buyerEmail } of orders) expect(buyerEmail).toMatch(/@example\.com$/);
    expect(orders.map(({ buyerEmail }) => buyerEmail)).not.toContain("tester@example.com");
  });

  it("leaves out an Exam the catalogue doesn't have", () => {
    const withoutMe = structuredClone(CATALOGUE_SEED);
    withoutMe.exams = withoutMe.exams.filter(({ code }) => code !== "ME");
    const kept = sampleOrders(BOOT, withoutMe).orders;
    expect(kept.map(({ examCode }) => examCode)).not.toContain("ME");
    expect(kept.at(-1)?.reference).toBe(`AYC-${10_000 + kept.length}`);
  });
});

describe("the sample store's Orders", () => {
  beforeEach(() => {
    resetSampleStore();
  });

  it("starts without them in tests, so a first Pay is AYC-10001", () => {
    expect(getSampleStore().orders).toEqual([]);
    expect(getSampleStore().nextOrderNumber).toBe(10_001);
  });

  it("starts with them when asked, as the dev server and its reset do", () => {
    resetSampleStore(CATALOGUE_SEED, { sampleOrders: true });
    expect(getSampleStore().orders).toHaveLength(6);
    expect(getSampleStore().nextOrderNumber).toBe(10_007);
  });
});
