import type * as schema from "@/lib/db/schema";
import type { InvoiceRequest } from "@/lib/payments/invoice-requests";
import type { Order } from "@/lib/payments/order-ledger";
import type { OrderRefund } from "@/lib/payments/refunds";
import { toPlanDays } from "@/lib/plans/plan-rules";

// The Orders table's rows as Orders, and back (Phase 4, ticket 03). The
// Member seam reads and writes them here, and the Orders admin (ticket 07)
// reads them the same way.

// status_checked_at isn't part of an Order: only the status-check backup's
// claim reads and writes it (ticket 04), so writing an Order never moves it.
// Nor is internal_note: only the Orders admin's note reads and writes it
// (ticket 07), so an outcome never touches the note.
type OrderRow = Omit<typeof schema.orders.$inferSelect, "statusCheckedAt" | "internalNote">;

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
  paidWithoutAccount: row.paidWithoutAccount,
});

export const orderToRow = (order: Order): OrderRow => ({
  ...order,
  createdAt: new Date(order.createdAt),
  paidAt: order.paidAt === null ? null : new Date(order.paidAt),
  statusChangedAt: new Date(order.statusChangedAt),
});

// Invoice Requests (ticket 08): who marked one sent is two columns, set together.
type InvoiceRequestRow = typeof schema.invoiceRequests.$inferSelect;

export const invoiceRequestFromRow = (row: InvoiceRequestRow): InvoiceRequest => ({
  orderId: row.orderId,
  name: row.name,
  address: row.address,
  tin: row.tin,
  requestedAt: row.requestedAt.toISOString(),
  sentAt: row.sentAt?.toISOString() ?? null,
  sentBy:
    row.sentByEmail !== null && row.sentByName !== null
      ? { email: row.sentByEmail, name: row.sentByName }
      : null,
});

export const invoiceRequestToRow = (request: InvoiceRequest): InvoiceRequestRow => ({
  orderId: request.orderId,
  name: request.name,
  address: request.address,
  tin: request.tin,
  requestedAt: new Date(request.requestedAt),
  sentAt: request.sentAt === null ? null : new Date(request.sentAt),
  sentByEmail: request.sentBy?.email ?? null,
  sentByName: request.sentBy?.name ?? null,
});

// PayMongo's refunds (ticket 09): the refund's id is the key.
type OrderRefundRow = typeof schema.orderRefunds.$inferSelect;

export const orderRefundFromRow = (row: OrderRefundRow): OrderRefund => ({
  id: row.refundId,
  orderId: row.orderId,
  amountCentavos: row.amountCentavos,
  status: row.status,
  refundedAt: row.refundedAt?.toISOString() ?? null,
});

export const orderRefundToRow = (refund: OrderRefund): OrderRefundRow => ({
  refundId: refund.id,
  orderId: refund.orderId,
  amountCentavos: refund.amountCentavos,
  status: refund.status,
  refundedAt: refund.refundedAt === null ? null : new Date(refund.refundedAt),
});
