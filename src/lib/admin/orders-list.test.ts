import { describe, expect, it } from "vitest";

import type { AdminOrder, OrderListQuery } from "@/services/admin.types";

import {
  DEFAULT_ORDER_QUERY,
  filterOrders,
  orderStats,
  ordersExportHref,
  ordersHref,
  paidTileLabel,
  parseOrdersParams,
  rangeStart,
} from "./orders-list";

// The Orders list's URL, filters and tiles (Phase 4, ticket 07; story 147;
// BUILD-MAP §3.9), pure. The search, status, Payment Method, range and "Include
// test orders" live in the URL. The range is on Manila days: "last 7 days"
// starts at midnight in Manila six days before today. Test Orders are left
// out unless ticked. The tiles count the Orders the filters match.

// 25 Nov 2026, 10:00 in Manila.
const NOW = new Date("2026-11-25T02:00:00.000Z");

let next = 10_001;

/** An Order as the Admin shows it: Paid by GCash, live, made an hour before NOW. */
function order(fields: Partial<AdminOrder> = {}): AdminOrder {
  const reference = `AYC-${next++}`;
  return {
    id: `id-${reference}`,
    reference,
    userId: null,
    examCode: "CE",
    planId: "plan-ce-90",
    planName: "CE All-Access",
    days: 90,
    priceCentavos: 129_900,
    method: "gcash",
    status: "paid",
    recordedStatus: "paid",
    paidAfterExpiry: false,
    livemode: true,
    checkoutId: "cs_1",
    paymentId: "pay_1",
    buyerName: "Maria Santos",
    buyerEmail: "maria.santos@example.com",
    createdAt: "2026-11-25T01:00:00.000Z",
    paidAt: "2026-11-25T01:01:00.000Z",
    statusChangedAt: "2026-11-25T01:01:00.000Z",
    ...fields,
  };
}

const query = (fields: Partial<OrderListQuery> = {}): OrderListQuery => ({
  ...DEFAULT_ORDER_QUERY,
  ...fields,
});

const references = (rows: AdminOrder[]) => rows.map((row) => row.reference);

describe("parseOrdersParams", () => {
  it("opens with no search, any status, every method, the last 30 days and no Test Orders", () => {
    expect(parseOrdersParams({})).toEqual({
      q: null,
      status: "any",
      method: "all",
      range: "30d",
      tests: false,
    });
  });

  it("reads every filter", () => {
    expect(
      parseOrdersParams({
        q: "  AYC-10482 ",
        status: "PAID",
        method: "gcash",
        range: "7d",
        tests: "1",
      }),
    ).toEqual({ q: "AYC-10482", status: "paid", method: "gcash", range: "7d", tests: true });
  });

  it("falls back to each default for values it doesn't know", () => {
    expect(
      parseOrdersParams({ q: "   ", status: "lost", method: "cash", range: "90d", tests: "yes" }),
    ).toEqual(DEFAULT_ORDER_QUERY);
  });

  it("reads the first of a repeated value, and keeps a long search to 100 characters", () => {
    expect(parseOrdersParams({ status: ["failed", "paid"], q: "x".repeat(150) })).toMatchObject({
      status: "failed",
      q: "x".repeat(100),
    });
  });
});

describe("ordersHref and ordersExportHref", () => {
  it("leave the defaults out", () => {
    expect(ordersHref(DEFAULT_ORDER_QUERY)).toBe("/admin/orders");
    expect(ordersExportHref(DEFAULT_ORDER_QUERY)).toBe("/admin/orders/export");
  });

  it("carry every filter that isn't the default, and round-trip through the parser", () => {
    const filtered = query({
      q: "maria@example.com",
      status: "paid",
      method: "gcash",
      range: "all",
      tests: true,
    });
    const href = ordersHref(filtered);
    expect(href).toBe(
      "/admin/orders?q=maria%40example.com&status=paid&method=gcash&range=all&tests=1",
    );
    const params = Object.fromEntries(new URL(href, "https://example.com").searchParams);
    expect(parseOrdersParams(params)).toEqual(filtered);
    expect(ordersExportHref(filtered)).toBe(
      "/admin/orders/export?q=maria%40example.com&status=paid&method=gcash&range=all&tests=1",
    );
  });
});

describe("rangeStart", () => {
  it("starts the last 7 days at midnight in Manila six days before today", () => {
    expect(rangeStart("7d", NOW)).toEqual(new Date("2026-11-18T16:00:00.000Z"));
  });

  it("starts the last 30 days at midnight in Manila 29 days before today", () => {
    expect(rangeStart("30d", NOW)).toEqual(new Date("2026-10-26T16:00:00.000Z"));
  });

  it("uses Manila's date, not UTC's, just after midnight in Manila", () => {
    // 26 Nov, 00:30 in Manila is still 25 Nov in UTC.
    expect(rangeStart("7d", new Date("2026-11-25T16:30:00.000Z"))).toEqual(
      new Date("2026-11-19T16:00:00.000Z"),
    );
  });

  it("has no start for all time", () => {
    expect(rangeStart("all", NOW)).toBeNull();
  });
});

describe("filterOrders", () => {
  it("finds an Order by part of its reference, ignoring case", () => {
    const wanted = order({ reference: "AYC-10482" });
    const rows = [order(), wanted, order()];
    expect(references(filterOrders(rows, query({ q: "ayc-10482" }), NOW))).toEqual(["AYC-10482"]);
    expect(references(filterOrders(rows, query({ q: "10482" }), NOW))).toEqual(["AYC-10482"]);
  });

  it("finds Orders by part of the buyer's email, ignoring case", () => {
    const paolo = order({ buyerEmail: "paolo.reyes@example.com" });
    const rows = [order(), paolo];
    expect(references(filterOrders(rows, query({ q: "PAOLO.R" }), NOW))).toEqual([paolo.reference]);
  });

  it("filters by status as every screen shows it, Expired included", () => {
    const pending = order({ status: "pending", recordedStatus: "pending", paidAt: null });
    const expired = order({ status: "expired", recordedStatus: "pending", paidAt: null });
    const failed = order({ status: "failed", recordedStatus: "failed", paidAt: null });
    const refunded = order({ status: "refunded", recordedStatus: "refunded" });
    const paid = order();
    const rows = [pending, expired, failed, refunded, paid];
    const only = (status: OrderListQuery["status"]) =>
      references(filterOrders(rows, query({ status }), NOW));

    expect(only("pending")).toEqual([pending.reference]);
    expect(only("expired")).toEqual([expired.reference]);
    expect(only("failed")).toEqual([failed.reference]);
    expect(only("refunded")).toEqual([refunded.reference]);
    expect(only("paid")).toEqual([paid.reference]);
    expect(only("any")).toHaveLength(5);
  });

  it("filters by Payment Method, and combines it with the status", () => {
    const gcashPaid = order({ method: "gcash" });
    const gcashFailed = order({ method: "gcash", status: "failed", recordedStatus: "failed" });
    const mayaPaid = order({ method: "maya" });
    const rows = [gcashPaid, gcashFailed, mayaPaid];

    expect(references(filterOrders(rows, query({ method: "gcash" }), NOW))).toEqual([
      gcashFailed.reference,
      gcashPaid.reference,
    ]);
    expect(references(filterOrders(rows, query({ method: "gcash", status: "paid" }), NOW))).toEqual(
      [gcashPaid.reference],
    );
  });

  it("keeps an Order made at 00:30 in Manila on the range's first day, and leaves out one at 23:59 the day before", () => {
    // The last 7 days from NOW start on 19 Nov in Manila.
    const firstDay = order({ createdAt: "2026-11-18T16:30:00.000Z" });
    const dayBefore = order({ createdAt: "2026-11-18T15:59:00.000Z" });
    const rows = [firstDay, dayBefore];

    expect(references(filterOrders(rows, query({ range: "7d" }), NOW))).toEqual([
      firstDay.reference,
    ]);
    expect(references(filterOrders(rows, query({ range: "all" }), NOW))).toHaveLength(2);
  });

  it("leaves out Test Orders unless they're included", () => {
    const live = order();
    const test = order({ livemode: false });
    const rows = [live, test];

    expect(references(filterOrders(rows, query(), NOW))).toEqual([live.reference]);
    // Made together, the later reference comes first.
    expect(references(filterOrders(rows, query({ tests: true }), NOW))).toEqual([
      test.reference,
      live.reference,
    ]);
  });

  it("lists the newest Order first, then by reference for Orders made together", () => {
    const older = order({ reference: "AYC-20001", createdAt: "2026-11-24T01:00:00.000Z" });
    const a = order({ reference: "AYC-20002", createdAt: "2026-11-25T01:00:00.000Z" });
    const b = order({ reference: "AYC-20003", createdAt: "2026-11-25T01:00:00.000Z" });
    expect(references(filterOrders([older, a, b], query(), NOW))).toEqual([
      "AYC-20003",
      "AYC-20002",
      "AYC-20001",
    ]);
  });

  it("matches nothing for a search no Order holds", () => {
    expect(filterOrders([order(), order()], query({ q: "nobody@example.com" }), NOW)).toEqual([]);
  });
});

describe("orderStats", () => {
  it("adds up the Paid Orders' amounts and counts the Orders, the Pending and the Failed", () => {
    const rows = [
      order({ priceCentavos: 129_900 }),
      order({ priceCentavos: 49_900 }),
      order({ status: "pending", recordedStatus: "pending", priceCentavos: 44_900 }),
      order({ status: "failed", recordedStatus: "failed", priceCentavos: 44_900 }),
      order({ status: "expired", recordedStatus: "pending", priceCentavos: 44_900 }),
      order({ status: "refunded", recordedStatus: "refunded", priceCentavos: 229_900 }),
    ];
    expect(orderStats(rows)).toEqual({
      paidCentavos: 179_800,
      orders: 6,
      pending: 1,
      failed: 1,
    });
  });

  it("is all zero for no Orders", () => {
    expect(orderStats([])).toEqual({ paidCentavos: 0, orders: 0, pending: 0, failed: 0 });
  });
});

describe("paidTileLabel", () => {
  it("names the range", () => {
    expect(paidTileLabel("7d")).toBe("PAID · LAST 7 DAYS");
    expect(paidTileLabel("30d")).toBe("PAID · LAST 30 DAYS");
    expect(paidTileLabel("all")).toBe("PAID · ALL TIME");
  });
});
