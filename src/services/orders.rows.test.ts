import { describe, expect, it } from "vitest";

import type { Order } from "@/lib/payments/order-ledger";
import type { OrderRefund } from "@/lib/payments/refunds";

import { orderFromRow, orderRefundFromRow, orderRefundToRow, orderToRow } from "./orders.rows";

// The Orders table's rows (Phase 4, ticket 03): an Order written as a row
// reads back as the same Order, times as ISO strings and empty ones as null.

const PAID: Order = {
  id: "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b",
  reference: "AYC-10001",
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  examCode: "CE",
  planId: "5d7c9e1a-3b2f-4a6d-9c8e-7f6a5b4c3d2e",
  planName: "CE All-Access",
  days: 90,
  priceCentavos: 129_900,
  method: "gcash",
  status: "paid",
  livemode: false,
  checkoutId: null,
  paymentId: null,
  buyerName: "Bea Tester",
  buyerEmail: "tester@example.com",
  createdAt: "2026-11-17T03:42:00.000Z",
  paidAt: "2026-11-17T03:43:00.000Z",
  statusChangedAt: "2026-11-17T03:43:00.000Z",
};

describe("orders.rows", () => {
  it("writes times as dates", () => {
    expect(orderToRow(PAID)).toMatchObject({
      createdAt: new Date(PAID.createdAt),
      paidAt: new Date(PAID.paidAt ?? ""),
      statusChangedAt: new Date(PAID.statusChangedAt),
    });
  });

  it.each([
    ["a Paid Order", PAID],
    [
      "a Pending Order of a deleted account",
      { ...PAID, status: "pending", paidAt: null, userId: null },
    ],
  ] as const)("reads %s back unchanged", (_what, order) => {
    expect(orderFromRow(orderToRow(order))).toEqual(order);
  });
});

// PayMongo's refunds (ticket 09): one row per refund id, read back unchanged.
describe("order refund rows", () => {
  const SUCCEEDED: OrderRefund = {
    id: "ref_FakeRefund0001TestOnly",
    orderId: PAID.id,
    amountCentavos: 30_000,
    status: "succeeded",
    refundedAt: "2026-11-18T03:00:00.000Z",
  };

  it("writes the refund's id and time as the table holds them", () => {
    expect(orderRefundToRow(SUCCEEDED)).toEqual({
      refundId: SUCCEEDED.id,
      orderId: PAID.id,
      amountCentavos: 30_000,
      status: "succeeded",
      refundedAt: new Date("2026-11-18T03:00:00.000Z"),
    });
  });

  it.each([
    ["a succeeded refund", SUCCEEDED],
    ["a pending refund", { ...SUCCEEDED, status: "pending", refundedAt: null }],
  ] as const)("reads %s back unchanged", (_what, refund) => {
    expect(orderRefundFromRow(orderRefundToRow(refund))).toEqual(refund);
  });
});
