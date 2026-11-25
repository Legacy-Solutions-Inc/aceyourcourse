import { ordersCsv, ordersCsvFilename } from "@/lib/admin/orders-csv";
import { filterOrders, orderStats, rangeStart } from "@/lib/admin/orders-list";
import type { InvoiceRequest, OrderWithInvoice } from "@/lib/payments/invoice-requests";
import { effectiveStatus, isOrderReference, paidAfterExpiry } from "@/lib/payments/order-ledger";
import { type OrderRefund, refundedCentavos, succeededRefunds } from "@/lib/payments/refunds";
import {
  invalidInput,
  type OrderNoteInput,
  orderListQuerySchema,
  orderNoteInputSchema,
  roleRefusal,
} from "@/services/admin.schema";
import type {
  AdminOrder,
  AdminOrderDetail,
  AdminOrderList,
  AdminOrderNote,
  AdminResult,
  OrderCheckOutcome,
  OrderListQuery,
  OrdersCsv,
  OrderStatusCheck,
  RecordStamp,
  StaffActivity,
  StaffActor,
} from "@/services/admin.types";
import { activityRecord, formError, NOT_FOUND, refused } from "@/services/content-editor.core";
import { nextStamp } from "@/services/mock/sample-store";
import { checkCheckoutStatus, type OrderStore } from "@/services/orders.core";
import type { PaymentsClient } from "@/services/payments.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Orders & payments (Phase 4, ticket 07; stories 147, 148,
// 151o and 151z; spec, Phase 4 → Orders Admin; Phase 4 planning decisions →
// Orders and sales figures), shared by both arms. Owners only: an Editor is
// refused every read and write, as the Staff Guard refuses them the screens.
//
// - The list: the Orders the search and filters match, newest first, with
//   their tiles. Each arm reads the range's Orders (Test Orders only when
//   they're included); the pure filter in src/lib/admin/orders-list.ts does
//   the rest, so both arms match the same Orders.
// - Every read shows an Order's status as every screen does: a Pending Order
//   past its 24 hours is Expired (the Order ledger's effectiveStatus), while
//   the status recorded on it stays readable.
// - The detail: the Order, whether its buyer's Member record is still there
//   (for the link to their detail page), and its internal note.
// - The internal note: only Staff see it. It's saved with the conflict check
//   against the stamp the page opened with (a record stamp, "order-note:<id>";
//   one never saved carries the Order's making), and logged in Staff Activity.
// - "Check status with PayMongo": the status-check backup's own code
//   (checkCheckoutStatus in orders.core.ts), through the arm's Order store,
//   so an outcome lands through the Order ledger as the webhook's would. It
//   asks only while the Order is recorded Pending (one past its 24 hours too:
//   a late payment counts); for any other it asks nothing and changes nothing.
// - The CSV export: exactly the filtered Orders (src/lib/admin/orders-csv.ts),
//   logged in Staff Activity with the filters and the number of rows; the
//   search itself, often a Member's email, isn't kept there.
// - Invoice Requests (ticket 08): every read carries an Order's request, for
//   the "Invoice requested" filter, the detail and the CSV. "Mark invoice
//   sent" records when and by whom (as they were then) and Staff Activity,
//   as one step; a request already marked sent is given back as it is,
//   changing and logging nothing. The app sends no email: the Owner sends
//   the invoice from the support inbox first.
// - Refunds are issued from the PayMongo dashboard, never here. Every read
//   carries an Order's refunds that PayMongo's events recorded (ticket 09),
//   for its status, the timeline and the CSV's amount refunded.
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN = "ONLY AN OWNER CAN SEE ORDERS AND PAYMENTS";

export const NO_PAYMENTS_CLIENT =
  "Payments aren’t set up on this server, so there’s no PayMongo to ask. Set the PayMongo keys first.";

/** Pure: the record stamp an Order's internal note saves under. */
export const orderNoteRecord = (orderId: string) => `order-note:${orderId}`;

export const NO_INVOICE_REQUEST = "No invoice was requested for this Order.";

/** An Order as the Admin reads it: with its Invoice Request (ticket 08) and its refunds (ticket 09). */
export interface AdminOrderRecord extends OrderWithInvoice {
  refunds: OrderRefund[];
}

/** Pure: an Order, with its Invoice Request and refunds, as the Admin shows it at `now`. */
export const adminOrderOf = (
  { order, invoice, refunds }: AdminOrderRecord,
  now: Date,
): AdminOrder => ({
  ...order,
  status: effectiveStatus(order, now),
  recordedStatus: order.status,
  paidAfterExpiry: paidAfterExpiry(order),
  invoice,
  refunds: succeededRefunds(refunds),
  refundedCentavos: refundedCentavos(refunds),
});

/** One Order as the detail page reads it. */
export interface OrderRecord extends AdminOrderRecord {
  /** Whether the buyer's Member record is there: false once their account is deleted. */
  memberExists: boolean;
  /** The internal note, or null for none. */
  note: string | null;
  /** The note's last save, or null while it has never been saved. */
  noteStamp: RecordStamp | null;
}

/** What saving a note writes, all or nothing. */
export interface OrderNoteWrite {
  orderId: string;
  /** The note, or null to clear it. */
  note: string | null;
  stamp: RecordStamp;
  activity: StaffActivity;
}

/** What "Mark invoice sent" writes, all or nothing. */
export interface InvoiceSentWrite {
  request: InvoiceRequest;
  activity: StaffActivity;
}

/** How an arm reads and writes the Orders admin's records. */
export interface OrdersAdminStore {
  /**
   * Every Order made at or after `since` (all of them for null), with its
   * Invoice Request and refunds; Test Orders only with `tests`.
   */
  listOrders(filter: { since: Date | null; tests: boolean }): Promise<AdminOrderRecord[]>;
  /** The Order with this reference, or null for none. */
  readOrder(reference: string): Promise<OrderRecord | null>;
  /**
   * Runs `work` on the Order with this reference as it is now, then writes
   * the note it gives, with its stamp and Staff Activity, as one step: two
   * saves of one Order's note take turns. Gives work's result, or null for
   * no such Order.
   */
  withOrderNote<T>(
    reference: string,
    work: (record: OrderRecord) => { write: OrderNoteWrite | null; result: T },
  ): Promise<T | null>;
  /**
   * Runs `work` on the Order with this reference and its Invoice Request as
   * they are now, then writes the request it gives, with its Staff Activity,
   * as one step: two marks of one request take turns. Gives work's result,
   * or null for no such Order.
   */
  withInvoiceRequest<T>(
    reference: string,
    work: (held: OrderWithInvoice) => { write: InvoiceSentWrite | null; result: T },
  ): Promise<T | null>;
  /** Appends a Staff Activity record. */
  recordActivity(activity: StaffActivity): Promise<void>;
}

const saved = <T>(value: T): AdminResult<T> => ({ ok: true, value, tags: [] });

/** Pure: a note's stamp: its last save, or the Order's making while it has never been saved. */
const stampOf = ({ order, noteStamp }: OrderRecord): RecordStamp =>
  noteStamp ?? { savedAt: order.createdAt, savedBy: null };

/** Pure: an Order's note as the detail page shows it. */
const noteOf = (record: OrderRecord): AdminOrderNote => ({
  reference: record.order.reference,
  text: record.note ?? "",
  stamp: stampOf(record),
});

/** Pure: a reference as an address carries it, or null when it can't be one. */
const referenceOf = (sent: string): string | null => {
  const reference = sent.trim();
  return isOrderReference(reference) ? reference : null;
};

/** The Admin seam's Orders calls, over an arm's store and its Order store (the status check's). */
export function ordersAdminCalls(store: OrdersAdminStore, orders: Pick<OrderStore, "withOrder">) {
  /** The role check and the query: the refusal, or the query parsed. */
  function checkedQuery(
    actor: StaffActor,
    query: OrderListQuery,
  ): { refusal: AdminResult<never> } | { query: OrderListQuery } {
    const role = roleRefusal(actor, "owner", FORBIDDEN);
    if (role) return { refusal: refused(role) };
    const parsed = orderListQuerySchema.safeParse(query);
    return parsed.success
      ? { query: parsed.data }
      : { refusal: refused(invalidInput(parsed.error)) };
  }

  /** The Orders a parsed query matches at `now`, newest first. */
  async function matching(query: OrderListQuery, now: Date): Promise<AdminOrder[]> {
    const found = await store.listOrders({
      since: rangeStart(query.range, now),
      tests: query.tests,
    });
    return filterOrders(
      found.map((held) => adminOrderOf(held, now)),
      query,
      now,
    );
  }

  async function listOrdersForAdmin(
    actor: StaffActor,
    sent: OrderListQuery,
  ): Promise<AdminResult<AdminOrderList>> {
    const checks = checkedQuery(actor, sent);
    if ("refusal" in checks) return checks.refusal;
    const rows = await matching(checks.query, new Date());
    return saved({ query: checks.query, rows, stats: orderStats(rows) });
  }

  async function getOrderForAdmin(
    actor: StaffActor,
    sent: string,
  ): Promise<AdminResult<AdminOrderDetail>> {
    const role = roleRefusal(actor, "owner", FORBIDDEN);
    if (role) return refused(role);
    const reference = referenceOf(sent);
    const record = reference && (await store.readOrder(reference));
    if (!record) return NOT_FOUND;
    return saved({
      order: adminOrderOf(record, new Date()),
      memberUserId: record.memberExists ? record.order.userId : null,
      note: noteOf(record),
    });
  }

  async function saveOrderNote(
    actor: StaffActor,
    input: OrderNoteInput,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminOrderNote>> {
    const role = roleRefusal(actor, "owner", FORBIDDEN);
    if (role) return refused(role);
    const parsed = orderNoteInputSchema.safeParse(input);
    if (!parsed.success) return refused(invalidInput(parsed.error));
    const reference = referenceOf(parsed.data.reference);
    if (!reference) return NOT_FOUND;
    const note = parsed.data.note || null;
    const now = new Date();

    const result = await store.withOrderNote(reference, (record) => {
      const before = stampOf(record);
      if (expected && expected.savedAt !== before.savedAt) {
        return { write: null, result: refused({ kind: "conflict", ...before }) };
      }
      const { order } = record;
      const stamp = nextStamp(before, actor.name, now);
      return {
        write: {
          orderId: order.id,
          note,
          stamp,
          activity: activityRecord(
            actor,
            now,
            "order",
            order.id,
            "note",
            { reference, note: record.note ?? "" },
            { reference, note: note ?? "" },
          ),
        },
        result: saved<AdminOrderNote>({ reference, text: note ?? "", stamp }),
      };
    });
    return result ?? NOT_FOUND;
  }

  async function checkOrderWithPayMongo(
    actor: StaffActor,
    sent: string,
    client: PaymentsClient | null,
  ): Promise<AdminResult<OrderStatusCheck>> {
    const role = roleRefusal(actor, "owner", FORBIDDEN);
    if (role) return refused(role);
    const reference = referenceOf(sent);
    const record = reference && (await store.readOrder(reference));
    if (!reference || !record) return NOT_FOUND;
    const { order } = record;
    if (order.status !== "pending") {
      return saved({ outcome: "not-pending", order: adminOrderOf(record, new Date()) });
    }
    if (!client) return refused(formError(NO_PAYMENTS_CLIENT));

    const { status, moved } = await checkCheckoutStatus(orders, order, client);
    const latest = await store.readOrder(reference);
    if (!latest) return NOT_FOUND;
    const after = adminOrderOf(latest, new Date());
    let outcome: OrderCheckOutcome;
    if (status === "pending") outcome = "still-pending";
    else if (status === "unknown") outcome = "unknown";
    else if (moved) outcome = status;
    // The webhook settled it first: PayMongo's answer changed nothing here.
    else outcome = after.recordedStatus === "pending" ? "unknown" : "not-pending";
    return saved({ outcome, order: after });
  }

  async function markInvoiceSent(
    actor: StaffActor,
    sent: string,
  ): Promise<AdminResult<InvoiceRequest>> {
    const role = roleRefusal(actor, "owner", FORBIDDEN);
    if (role) return refused(role);
    const reference = referenceOf(sent);
    if (!reference) return NOT_FOUND;
    const now = new Date();

    const result = await store.withInvoiceRequest(
      reference,
      ({
        order,
        invoice,
      }): { write: InvoiceSentWrite | null; result: AdminResult<InvoiceRequest> } => {
        if (!invoice) return { write: null, result: refused(formError(NO_INVOICE_REQUEST)) };
        if (invoice.sentAt !== null) return { write: null, result: saved(invoice) };
        const request: InvoiceRequest = {
          ...invoice,
          sentAt: now.toISOString(),
          sentBy: { email: actor.email, name: actor.name },
        };
        return {
          write: {
            request,
            activity: activityRecord(
              actor,
              now,
              "order",
              order.id,
              "invoice-sent",
              { reference, invoiceSentAt: null },
              { reference, invoiceSentAt: request.sentAt },
            ),
          },
          result: saved(request),
        };
      },
    );
    return result ?? NOT_FOUND;
  }

  async function exportOrdersCsv(
    actor: StaffActor,
    sent: OrderListQuery,
  ): Promise<AdminResult<OrdersCsv>> {
    const checks = checkedQuery(actor, sent);
    if ("refusal" in checks) return checks.refusal;
    const { query } = checks;
    const now = new Date();
    const rows = await matching(query, now);
    const { status, method, range, tests, invoiceRequested, paidAfterExpiry } = query;
    await store.recordActivity(
      activityRecord(actor, now, "orders", "csv", "export-csv", null, {
        status,
        method,
        range,
        tests,
        invoiceRequested,
        paidAfterExpiry,
        searched: query.q !== null,
        rows: rows.length,
      }),
    );
    return saved({ filename: ordersCsvFilename(now), csv: ordersCsv(rows), rows: rows.length });
  }

  return {
    listOrdersForAdmin,
    getOrderForAdmin,
    saveOrderNote,
    checkOrderWithPayMongo,
    markInvoiceSent,
    exportOrdersCsv,
  };
}
