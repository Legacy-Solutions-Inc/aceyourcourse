import { beforeEach, describe, expect, it } from "vitest";

import { effectiveStatus, paidAfterExpiry } from "@/lib/payments/order-ledger";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleOrders } from "./orders";

// The sample Orders (Phase 4, ticket 07): the dev server's data and the e2e
// specs' reset start with Paid, Pending and Failed Orders, one older than 30
// days and one Test Order, for buyers no sample Member is; one Paid Order has
// an Invoice Request to send (ticket 08). The last two, the sample Members
// Bea's and Lou's, are refunded (ticket 09): Bea's in part, so it's still
// Paid, and Lou's in full. The Overview's three (ticket 11) come after them:
// Paid over the last two weeks, one after it expired. Ticket 14's two come
// last, both older than 30 days: Lou's Paid CE 3 months, and one paid after
// its buyer's account was deleted, with no account. Unit tests start without
// them.

const BOOT = new Date("2026-11-25T02:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("sampleOrders", () => {
  const { orders, nextOrderNumber, invoiceRequests, orderRefunds } = sampleOrders(
    BOOT,
    CATALOGUE_SEED,
  );

  it("has one Invoice Request, not yet sent, on Maria's Paid Order, asked for after it was paid", () => {
    const maria = orders.find((order) => order.reference === "AYC-10002");
    expect(invoiceRequests).toEqual([
      {
        orderId: maria?.id,
        name: "Sample Builders Inc.",
        address: "12 Sample St, Jaro, Iloilo City",
        tin: "123-456-789-000",
        requestedAt: new Date(BOOT.getTime() - 19 * DAY).toISOString(),
        sentAt: null,
        sentBy: null,
      },
    ]);
    expect(maria?.status).toBe("paid");
  });

  it("numbers them from AYC-10001, oldest first but the Overview's three and ticket 14's two, and the next Order after them", () => {
    expect(orders.map(({ reference }) => reference)).toEqual([
      "AYC-10001",
      "AYC-10002",
      "AYC-10003",
      "AYC-10004",
      "AYC-10005",
      "AYC-10006",
      "AYC-10007",
      "AYC-10008",
      "AYC-10009",
      "AYC-10010",
      "AYC-10011",
      "AYC-10012",
      "AYC-10013",
    ]);
    expect(nextOrderNumber).toBe(10_014);
    const made = orders.slice(0, 8).map(({ createdAt }) => createdAt);
    expect([...made].sort()).toEqual(made);
  });

  it("pays the Overview's three over the last two weeks, one 26 hours after it was made (ticket 11)", () => {
    const overviews = orders.slice(8, 11);
    expect(overviews.map(({ paidAt }) => paidAt)).toEqual([
      new Date(BOOT.getTime() - 3 * DAY + 2 * 60_000).toISOString(),
      new Date(BOOT.getTime() - 9 * DAY + 2 * 60_000).toISOString(),
      new Date(BOOT.getTime() - 22 * 60 * 60_000).toISOString(),
    ]);
    expect(overviews.map(paidAfterExpiry)).toEqual([false, false, true]);
    expect(overviews.every(({ livemode, status }) => livemode && status === "paid")).toBe(true);
  });

  it("has Paid, Pending, Failed and Refunded ones, a Test Order, and one older than 30 days", () => {
    expect(orders.map((order) => effectiveStatus(order, BOOT))).toEqual([
      "paid",
      "paid",
      "paid",
      "failed",
      "paid",
      "pending",
      "paid",
      "refunded",
      "paid",
      "paid",
      "paid",
      "paid",
      "paid",
    ]);
    expect(orders.filter(({ livemode }) => !livemode)).toHaveLength(1);
    expect(
      orders.filter(({ createdAt }) => new Date(createdAt) < new Date(BOOT.getTime() - 30 * DAY)),
    ).toHaveLength(3);
    expect(
      orders.filter(({ method, status }) => method === "gcash" && status === "paid"),
    ).toHaveLength(3);
  });

  it("keeps the ledger's rules: paid at once Paid (Refunded ones too), a payment ID only once paid", () => {
    for (const order of orders) {
      const paid = order.status === "paid" || order.status === "refunded";
      expect(order.paidAt !== null).toBe(paid);
      expect(order.paymentId !== null).toBe(paid);
    }
  });

  it("uses made-up example.com buyers, and the sample Members only for the refunds and Lou's other Order", () => {
    for (const { buyerEmail } of orders) expect(buyerEmail).toMatch(/@example\.com$/);
    expect(
      orders
        .filter(({ buyerEmail }) =>
          ["tester@example.com", "lapsed@example.com"].includes(buyerEmail),
        )
        .map(({ reference }) => reference),
    ).toEqual(["AYC-10007", "AYC-10008", "AYC-10012"]);
  });

  it("gives Lou a second paid Order, and pays one after its account was deleted (ticket 14)", () => {
    const [lou, orphaned] = orders.slice(11);
    expect(lou).toMatchObject({
      buyerEmail: "lapsed@example.com",
      status: "paid",
      days: 90,
      paidWithoutAccount: false,
    });
    expect(lou?.userId).not.toBeNull();
    // Her lapsed CE pass (members.ts) ended 3 days before boot, as these days did.
    expect(lou?.createdAt).toBe(new Date(BOOT.getTime() - 93 * DAY).toISOString());
    expect(orphaned).toMatchObject({
      userId: null,
      status: "paid",
      paidWithoutAccount: true,
      paidAt: new Date(BOOT.getTime() - 40 * DAY + 30 * 60 * 60_000).toISOString(),
    });
    expect(orphaned && paidAfterExpiry(orphaned)).toBe(true);
    expect(orders.filter(({ paidWithoutAccount }) => paidWithoutAccount)).toHaveLength(1);
    // Neither is a GCash Paid Order the Orders e2e's "All time" list would show.
    expect([lou?.method, orphaned?.method]).toEqual(["card", "maya"]);
  });

  it("refunds ₱300 of Bea's ₱1,299 Order and all of Lou's, each after it was paid (ticket 09)", () => {
    const bea = orders.find((order) => order.reference === "AYC-10007");
    const lou = orders.find((order) => order.reference === "AYC-10008");
    expect(orderRefunds).toEqual([
      {
        id: "ref_sample10007",
        orderId: bea?.id,
        amountCentavos: 30_000,
        status: "succeeded",
        refundedAt: new Date(BOOT.getTime() - 30 * 60_000).toISOString(),
      },
      {
        id: "ref_sample10008",
        orderId: lou?.id,
        amountCentavos: 49_900,
        status: "succeeded",
        refundedAt: new Date(BOOT.getTime() - 20 * 60_000).toISOString(),
      },
    ]);
    expect(bea).toMatchObject({ status: "paid", priceCentavos: 129_900 });
    expect(lou).toMatchObject({
      status: "refunded",
      priceCentavos: 49_900,
      statusChangedAt: new Date(BOOT.getTime() - 20 * 60_000).toISOString(),
    });
    for (const refund of orderRefunds) {
      const paidAt = orders.find(({ id }) => id === refund.orderId)?.paidAt ?? "";
      expect(refund.refundedAt && refund.refundedAt > paidAt).toBe(true);
    }
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
    expect(getSampleStore().orders).toHaveLength(13);
    expect(getSampleStore().nextOrderNumber).toBe(10_014);
    expect(getSampleStore().orderRefunds).toHaveLength(2);
  });
});
