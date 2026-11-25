import type * as schema from "@/lib/db/schema";
import type { Order } from "@/lib/payments/order-ledger";
import { toPlanDays } from "@/lib/plans/plan-rules";

// The Orders table's rows as Orders, and back (Phase 4, ticket 03). The
// Member seam reads and writes them here; the Orders Admin (ticket 07) will
// read them the same way.

// status_checked_at isn't part of an Order: only the status-check backup's
// claim reads and writes it (ticket 04), so writing an Order never moves it.
type OrderRow = Omit<typeof schema.orders.$inferSelect, "statusCheckedAt">;

export const orderFromRow = (row: OrderRow): Order => ({
  id: row.id,
  reference: row.reference,
  userId: row.userId,
  examCode: row.examCode,
  planId: row.planId,
  planName: row.planName,
  // The table's check keeps the days to a Plan's durations.
  days: toPlanDays(row.days),
  priceCentavos: row.priceCentavos,
  method: row.method,
  status: row.status,
  livemode: row.livemode,
  checkoutId: row.checkoutId,
  paymentId: row.paymentId,
  buyerName: row.buyerName,
  buyerEmail: row.buyerEmail,
  createdAt: row.createdAt.toISOString(),
  paidAt: row.paidAt?.toISOString() ?? null,
  statusChangedAt: row.statusChangedAt.toISOString(),
});

export const orderToRow = (order: Order): OrderRow => ({
  ...order,
  createdAt: new Date(order.createdAt),
  paidAt: order.paidAt === null ? null : new Date(order.paidAt),
  statusChangedAt: new Date(order.statusChangedAt),
});
