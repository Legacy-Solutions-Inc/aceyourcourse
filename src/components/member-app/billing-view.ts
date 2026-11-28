import { isPassActive, passEndDate } from "@/lib/member-app/access";
import { manilaDate, manilaDayStart } from "@/lib/manila-time";
import { formatPeso, formatPesoWithCentavos } from "@/lib/money";
import { orderItem, type OrderStatus, wasPaid } from "@/lib/payments/order-ledger";
import { isPartiallyRefunded } from "@/lib/payments/refunds";
import { methodLabel } from "@/lib/payments/payment-methods";
import { paths } from "@/paths";
import type { BusinessDetails } from "@/services/catalogue.types";
import type { AccessPass } from "@/services/content.types";
import type { MemberOrder, PaymentAcknowledgement } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// Billing and the Payment Acknowledgement, worded (Phase 4, ticket 06;
// BUILD-MAP §3 Billing L452–477 and "Receipt" L662–674, which we call the
// Payment Acknowledgement; stories 143, 144, 151u), pure. Every date is the
// Manila calendar date. An Order's status is as the Member seam read it (a
// Pending Order older than 24 hours already reads Expired). A Paid Order
// offers "Request official invoice" until its Invoice Request is made, then
// says "Invoice requested", later "Invoice sent · check your email" (ticket
// 08; story 151j). A refund in PayMongo (ticket 09; spec, Phase 4 planning
// decisions → Refunds) shows on the row and the Acknowledgement: a Refunded
// Order reads REFUNDED, on the day refunded, and a Paid one with part
// refunded "PARTIALLY REFUNDED · ₱300"; both keep their Acknowledgement.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure: an instant's Manila date as people read it, "14 Oct 2026". */
const dayOf = passEndDate;

/** Pure: whole Manila calendar days from `now`'s date to the date of `iso`. */
const daysUntil = (iso: string, now: Date) =>
  Math.round(
    (manilaDayStart(manilaDate(new Date(iso))).getTime() -
      manilaDayStart(manilaDate(now)).getTime()) /
      DAY_MS,
  );

/** One Access Pass on Billing: "CE All-Access", ACTIVE or ENDED, and Renew now. */
export interface PassCard {
  examCode: string;
  title: string;
  active: boolean;
  tag: "ACTIVE" | "ENDED";
  line: string;
  renewHref: string;
}

/** Pure: an Access Pass as Billing shows it at `now`. */
export function passCard(
  { examCode, endsAt }: Pick<AccessPass, "examCode" | "endsAt">,
  now: Date,
): PassCard {
  const active = isPassActive(endsAt, now);
  const left = daysUntil(endsAt, now);
  const remaining = left <= 0 ? "ends today" : `${left} ${left === 1 ? "day" : "days"} left`;
  return {
    examCode,
    title: `${examCode} All-Access`,
    active,
    tag: active ? "ACTIVE" : "ENDED",
    line: active
      ? `Until ${dayOf(endsAt)} · ${remaining} · renews only if you renew`
      : `Ended ${dayOf(endsAt)} · renew to study again`,
    renewHref: paths.memberApp.plansFor(examCode),
  };
}

/** How a status badge looks: green, amber, red or grey. */
export type StatusTone = "paid" | "waiting" | "failed" | "ended";

const STATUS: Record<OrderStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "PENDING", tone: "waiting" },
  paid: { label: "PAID", tone: "paid" },
  failed: { label: "FAILED", tone: "failed" },
  expired: { label: "EXPIRED", tone: "ended" },
  refunded: { label: "REFUNDED", tone: "ended" },
};

/** Where a Paid Order's official invoice is: whether it can be asked for, and what to say. */
export interface InvoiceState {
  /** "Request official invoice": a Paid Order with no request yet. */
  canRequest: boolean;
  /** "Invoice requested", or "Invoice sent · check your email"; null with no request. */
  line: string | null;
}

/** Pure: where an Order's official invoice is. */
export function invoiceState({
  status,
  invoice,
}: Pick<MemberOrder, "status" | "invoice">): InvoiceState {
  if (invoice) {
    return {
      canRequest: false,
      line: invoice.status === "sent" ? "Invoice sent · check your email" : "Invoice requested",
    };
  }
  return { canRequest: status === "paid", line: null };
}

/** One row of Billing's Orders. */
export interface OrderRow {
  reference: string;
  item: string;
  /** "14 OCT 2026 · QR Ph · AYC-10482". */
  meta: string;
  status: string;
  tone: StatusTone;
  amount: string;
  /** A Test Order: marked TEST. */
  test: boolean;
  /** Only a Paid Order (or a Refunded one) has a Payment Acknowledgement. */
  acknowledgementHref: string | null;
  invoice: InvoiceState;
  /** "PARTIALLY REFUNDED · ₱300", or when a Refunded Order was refunded; null with no refund. */
  refund: string | null;
}

/** Pure: an Order's refund as its row says it; null with none. */
function refundLine(
  order: Pick<MemberOrder, "status" | "refundedCentavos" | "refundedAt">,
): string | null {
  const { status, refundedCentavos, refundedAt } = order;
  if (status === "refunded") {
    const day = refundedAt ? ` ON ${dayOf(refundedAt).toUpperCase()}` : "";
    return `REFUNDED${day} · UNUSED DAYS REMOVED`;
  }
  return isPartiallyRefunded(order) ? `PARTIALLY REFUNDED · ${formatPeso(refundedCentavos)}` : null;
}

/** Pure: an Order as Billing lists it. */
export function orderRow(order: MemberOrder): OrderRow {
  const { label, tone } = STATUS[order.status];
  return {
    reference: order.reference,
    item: orderItem(order),
    meta: `${dayOf(order.createdAt).toUpperCase()} · ${methodLabel(order.method)} · ${order.reference}`,
    status: label,
    tone,
    amount: formatPeso(order.priceCentavos),
    test: !order.livemode,
    acknowledgementHref: wasPaid(order.status)
      ? paths.memberApp.acknowledgement(order.reference)
      : null,
    invoice: invoiceState(order),
    refund: refundLine(order),
  };
}

/** A Payment Acknowledgement, worded for the page. */
export interface AcknowledgementView {
  number: string;
  date: string;
  billedTo: string[];
  seller: string[];
  item: string;
  period: string;
  amount: string;
  method: string;
  payMongoReference: string;
  status: string;
  /** "Prices include VAT" when the business is VAT-registered. */
  vatLine: string | null;
  test: boolean;
  invoice: InvoiceState;
  /** What PayMongo refunded and when, "₱300.00 on 16 Nov 2026"; null with no refund. */
  refunded: string | null;
}

/** Pure: an Acknowledgement's status: PAID, PARTIALLY REFUNDED or REFUNDED. */
function acknowledgedStatus(order: MemberOrder): string {
  return isPartiallyRefunded(order) ? "PARTIALLY REFUNDED" : STATUS[order.status].label;
}

/** Pure: a Paid or Refunded Order's Payment Acknowledgement, with the seller's business details. */
export function acknowledgementView(
  { order, buyer, access, payMongoReference }: PaymentAcknowledgement,
  business: BusinessDetails,
): AcknowledgementView {
  const paidAt = order.paidAt ?? order.createdAt;
  const refundDay = order.refundedAt ? dayOf(order.refundedAt) : null;
  let period = access
    ? `Access ${dayOf(access.startsAt)} – ${dayOf(access.endsAt)} · no auto-renewal`
    : "No auto-renewal";
  // A refund took the Order's unused days off, so the period it first gave is gone.
  if (order.status === "refunded") {
    period = `Refunded${refundDay ? ` ${refundDay}` : ""} · its unused days were removed`;
  }
  return {
    number: order.reference,
    date: dayOf(paidAt).toUpperCase(),
    billedTo: [buyer.name, buyer.email].filter((line): line is string => Boolean(line)),
    seller: [business.name, business.address, business.tin ? `TIN ${business.tin}` : null].filter(
      (line): line is string => Boolean(line),
    ),
    item: orderItem(order),
    period,
    amount: formatPesoWithCentavos(order.priceCentavos),
    method: `${methodLabel(order.method)} via PayMongo`,
    payMongoReference: payMongoReference ?? "—",
    status: acknowledgedStatus(order),
    vatLine: business.vatRegistered ? "Prices include VAT" : null,
    test: !order.livemode,
    invoice: invoiceState(order),
    refunded:
      order.refundedCentavos > 0
        ? `${formatPesoWithCentavos(order.refundedCentavos)}${refundDay ? ` on ${refundDay}` : ""}`
        : null,
  };
}
