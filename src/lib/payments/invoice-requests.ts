import type { Order } from "@/lib/payments/order-ledger";

// ─────────────────────────────────────────────────────────────────────────────
// Invoice Requests (Phase 4, ticket 08; spec, Phase 4 planning decisions →
// Payment Acknowledgement and Invoice Requests; stories 144, 151j, 151v): a
// Member's request for the official invoice of one Paid Order, with the name,
// address and TIN to put on it. Owners issue the invoice outside the app,
// email it from the support inbox, then mark the request sent. One per Order.
// It belongs to the Order, not the Member, so it stays with the Order when
// the account is deleted (ticket 14). The app sends no email.
// ─────────────────────────────────────────────────────────────────────────────

/** Who marked an Invoice Request sent, as they were then. */
export interface InvoiceSender {
  email: string;
  name: string;
}

/** One Order's Invoice Request. */
export interface InvoiceRequest {
  orderId: string;
  /** The name to put on the invoice. */
  name: string;
  /** The address to put on the invoice. */
  address: string;
  /** A business's TIN, with dashes; null for none. */
  tin: string | null;
  requestedAt: string;
  /** When an Owner marked it sent; null until then. */
  sentAt: string | null;
  /** Who marked it sent; null until then. */
  sentBy: InvoiceSender | null;
}

/** An Order with its Invoice Request, or null for none. */
export interface OrderWithInvoice {
  order: Order;
  invoice: InvoiceRequest | null;
}

/** Where an Invoice Request is: waiting for the Owner, or sent. */
export type InvoiceStatus = "requested" | "sent";

/** Pure: where an Invoice Request is. */
export const invoiceStatus = (request: Pick<InvoiceRequest, "sentAt">): InvoiceStatus =>
  request.sentAt === null ? "requested" : "sent";
