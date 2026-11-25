import "server-only";

import { and, desc, eq, gte, type SQL } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import type { Database } from "@/lib/db/connect";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { staffActivityToRow } from "@/services/admin.rows";
import { databaseOrderStore } from "@/services/member.db";
import { orderFromRow } from "@/services/orders.rows";
import {
  type OrderRecord,
  type OrdersAdminStore,
  orderNoteRecord,
  ordersAdminCalls,
} from "@/services/orders-admin.core";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Orders & payments on Postgres (Phase 4, ticket 07): the
// shared calls (src/services/orders-admin.core.ts) over the orders table,
// with the Member seam's Order store (member.db.ts) for "Check status with
// PayMongo", so an outcome is written as the webhook's is. The list reads
// only the range's Orders, Test Orders only when included; the pure filter
// does the rest. A buyer's Member record is there while the Order keeps a
// User id: deleting the account empties it (the foreign key's set null). A
// note's save runs in one transaction that locks the Order's row, so two
// saves take turns and each one's conflict check sees the stamp the one
// before it wrote; then the note, its stamp (record_stamps) and its Staff
// Activity are written together, or none of them. Drizzle bypasses RLS, so
// authorisation is the seam's role check and the Staff Guard (coding
// standards §3).
// ─────────────────────────────────────────────────────────────────────────────

const { orders, recordStamps, staffActivity } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function inDatabase<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw asDatabaseError(error);
  }
}

/** The Order with this reference, read in `db` (its row locked with `lock`), or null. */
async function readRecord(
  db: Database | Transaction,
  reference: string,
  lock = false,
): Promise<OrderRecord | null> {
  const query = db.select().from(orders).where(eq(orders.reference, reference));
  const [row] = lock ? await query.for("update") : await query;
  if (!row) return null;
  const [stamp] = await db
    .select()
    .from(recordStamps)
    .where(eq(recordStamps.record, orderNoteRecord(row.id)));
  return {
    order: orderFromRow(row),
    memberExists: row.userId !== null,
    note: row.internalNote,
    noteStamp: stamp ? { savedAt: stamp.updatedAt.toISOString(), savedBy: stamp.updatedBy } : null,
  };
}

const databaseOrdersAdminStore: OrdersAdminStore = {
  listOrders: ({ since, tests }) =>
    inDatabase(async () => {
      const conditions: SQL[] = [];
      if (!tests) conditions.push(eq(orders.livemode, true));
      if (since) conditions.push(gte(orders.createdAt, since));
      const rows = await getDb()
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(desc(orders.createdAt), desc(orders.reference));
      return rows.map(orderFromRow);
    }),

  readOrder: (reference) => inDatabase(() => readRecord(getDb(), reference)),

  withOrderNote: (reference, work) =>
    inDatabase(() =>
      getDb().transaction(async (tx) => {
        const record = await readRecord(tx, reference, true);
        if (!record) return null;
        const { write, result } = work(record);
        if (!write) return result;
        await tx.insert(staffActivity).values(staffActivityToRow(write.activity));
        await tx
          .update(orders)
          .set({ internalNote: write.note })
          .where(eq(orders.id, write.orderId));
        const stamp = {
          updatedAt: new Date(write.stamp.savedAt),
          updatedBy: write.stamp.savedBy,
        };
        await tx
          .insert(recordStamps)
          .values({ record: orderNoteRecord(write.orderId), ...stamp })
          .onConflictDoUpdate({ target: recordStamps.record, set: stamp });
        return result;
      }),
    ),

  recordActivity: (activity) =>
    inDatabase(async () => {
      await getDb().insert(staffActivity).values(staffActivityToRow(activity));
    }),
};

export const {
  listOrdersForAdmin,
  getOrderForAdmin,
  saveOrderNote,
  checkOrderWithPayMongo,
  exportOrdersCsv,
} = ordersAdminCalls(databaseOrdersAdminStore, databaseOrderStore);
