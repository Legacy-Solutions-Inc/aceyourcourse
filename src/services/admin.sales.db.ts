import "server-only";

import { and, eq, exists, gt, gte, isNotNull, isNull, or } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { adminOrderRecords } from "@/services/admin.orders.db";
import { salesCalls, type SalesStore } from "@/services/sales.core";

// ─────────────────────────────────────────────────────────────────────────────
// The Overview's sales on Postgres (Phase 4, ticket 11): the shared calls
// (src/services/sales.core.ts) over the orders, their refunds and Invoice
// Requests, and the Access Passes. Each read takes only what the figures
// count: live Orders paid or refunded since the instant asked, or still
// waiting (recorded Pending, or an invoice to send); and the passes active
// now whose holder has a Member record, with whether that Member's email is
// an active Staff User's. The pure rules do the counting, as in the sample
// arm. Drizzle bypasses RLS, so authorisation is the seam's role check and
// the Staff Guard (coding standards §3).
// ─────────────────────────────────────────────────────────────────────────────

const { accessPasses, invoiceRequests, members, orderRefunds, orders, staff } = schema;

async function inDatabase<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw asDatabaseError(error);
  }
}

const databaseSalesStore: SalesStore = {
  listSalesOrders: (since) =>
    inDatabase(async () => {
      const refundedSince = exists(
        getDb()
          .select({ refundId: orderRefunds.refundId })
          .from(orderRefunds)
          .where(and(eq(orderRefunds.orderId, orders.id), gte(orderRefunds.refundedAt, since))),
      );
      return adminOrderRecords(
        await getDb()
          .select({ order: orders, invoice: invoiceRequests })
          .from(orders)
          .leftJoin(invoiceRequests, eq(invoiceRequests.orderId, orders.id))
          .where(
            and(
              eq(orders.livemode, true),
              or(
                gte(orders.paidAt, since),
                eq(orders.status, "pending"),
                and(isNotNull(invoiceRequests.orderId), isNull(invoiceRequests.sentAt)),
                refundedSince,
              ),
            ),
          ),
      );
    }),

  listActivePasses: (now) =>
    inDatabase(async () => {
      const rows = await getDb()
        .select({
          userId: accessPasses.userId,
          endsAt: accessPasses.endsAt,
          staffEmail: staff.email,
        })
        .from(accessPasses)
        .innerJoin(members, eq(members.userId, accessPasses.userId))
        .leftJoin(staff, and(eq(staff.email, members.email), eq(staff.status, "active")))
        .where(gt(accessPasses.endsAt, now));
      return rows.map(({ userId, endsAt, staffEmail }) => ({
        userId,
        endsAt: endsAt.toISOString(),
        staff: staffEmail !== null,
      }));
    }),
};

export const { salesOverview, getPaidToday } = salesCalls(databaseSalesStore);
