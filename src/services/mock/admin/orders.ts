import { refundsOfOrder } from "@/lib/payments/refunds";
import { sampleOrderStore } from "@/services/member.mock";
import { getSampleStore } from "@/services/mock/sample-store";
import type { Order } from "@/lib/payments/order-ledger";
import {
  type AdminOrderRecord,
  type OrderRecord,
  type OrdersAdminStore,
  orderNoteRecord,
  ordersAdminCalls,
} from "@/services/orders-admin.core";

// The sample arm of the Admin seam's Orders & payments (Phase 4, ticket 07):
// the shared calls (src/services/orders-admin.core.ts) over the in-memory
// sample store, with the Member seam's sample Order store for "Check status
// with PayMongo". A Node process runs one call at a time here, so a note's
// save reads and writes in one step. A buyer's Member record is "there" while
// the sample data has it: an Order whose account was deleted has no User id,
// and a sample buyer who has never signed in has no record yet.

/** A sample Order's Invoice Request (ticket 08), or null for none. */
const invoiceOf = (orderId: string) =>
  getSampleStore().invoiceRequests.find((request) => request.orderId === orderId) ?? null;

/** A sample Order's PayMongo refunds (ticket 09). */
const refundsOf = (orderId: string) => refundsOfOrder(getSampleStore().orderRefunds)(orderId);

/**
 * A sample Order as the Admin reads it, with its Invoice Request and refunds;
 * the Overview's sales (mock/admin/sales.ts; ticket 11) read theirs the same way.
 */
export const sampleOrderRecord = (order: Order): AdminOrderRecord => ({
  order,
  invoice: invoiceOf(order.id),
  refunds: refundsOf(order.id),
});

function recordOf(reference: string): OrderRecord | null {
  const store = getSampleStore();
  const order = store.orders.find((candidate) => candidate.reference === reference);
  if (!order) return null;
  const { userId } = order;
  return structuredClone({
    order,
    invoice: invoiceOf(order.id),
    refunds: refundsOf(order.id),
    memberExists: userId !== null && store.members.some((member) => member.userId === userId),
    note: store.orderNotes[order.id] ?? null,
    noteStamp: store.stamps[orderNoteRecord(order.id)] ?? null,
  });
}

const sampleOrdersAdminStore: OrdersAdminStore = {
  async listOrders({ since, tests }) {
    return structuredClone(
      getSampleStore()
        .orders.filter(
          (order) =>
            (tests || order.livemode) && (since === null || new Date(order.createdAt) >= since),
        )
        .map(sampleOrderRecord),
    );
  },
  async readOrder(reference) {
    return recordOf(reference);
  },
  async withOrderNote(reference, work) {
    const record = recordOf(reference);
    if (!record) return null;
    const { write, result } = work(record);
    if (!write) return result;
    const store = getSampleStore();
    // The Staff Activity first: should it fail, the note stays as it was.
    store.staffActivity = [...store.staffActivity, structuredClone(write.activity)];
    const { [write.orderId]: _old, ...others } = store.orderNotes;
    store.orderNotes = write.note === null ? others : { ...others, [write.orderId]: write.note };
    store.stamps = { ...store.stamps, [orderNoteRecord(write.orderId)]: write.stamp };
    return result;
  },
  async withInvoiceRequest(reference, work) {
    const record = recordOf(reference);
    if (!record) return null;
    const { write, result } = work({ order: record.order, invoice: record.invoice });
    if (!write) return result;
    const store = getSampleStore();
    // The Staff Activity first: should it fail, the request stays as it was.
    store.staffActivity = [...store.staffActivity, structuredClone(write.activity)];
    store.invoiceRequests = store.invoiceRequests.map((request) =>
      request.orderId === write.request.orderId ? structuredClone(write.request) : request,
    );
    return result;
  },
  async recordActivity(activity) {
    const store = getSampleStore();
    store.staffActivity = [...store.staffActivity, structuredClone(activity)];
  },
};

export const {
  listOrdersForAdmin,
  getOrderForAdmin,
  saveOrderNote,
  checkOrderWithPayMongo,
  markInvoiceSent,
  exportOrdersCsv,
} = ordersAdminCalls(sampleOrdersAdminStore, sampleOrderStore);
