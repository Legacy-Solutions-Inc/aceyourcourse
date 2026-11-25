import { ORDER_EXPIRES_AFTER_MS, type OrderStatus } from "@/lib/payments/order-ledger";
import { failureCopy, methodLabel, methodTag } from "@/lib/payments/payment-methods";
import { periodLabel } from "@/lib/plans/plan-text";
import type { AdminOrder, OrderStatusCheck } from "@/services/admin.types";

// ─────────────────────────────────────────────────────────────────────────────
// What the Orders admin says about an Order (Phase 4, ticket 07; story 148;
// BUILD-MAP §3.9; mockup 752–785, 1481–1510), pure: its item and status, the
// timeline by status ("Paid after expiry" where it applies), the status note,
// what "Check status with PayMongo" found, and PayMongo's reference and
// dashboard link.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
  refunded: "Refunded",
};

/** Pure: a status as a sentence reads it: "Paid". */
export const orderStatusLabel = (status: OrderStatus): string => STATUS_LABELS[status];

/** Pure: a status as its tag reads it: "PAID". */
export const orderStatusTag = (status: OrderStatus): string => STATUS_LABELS[status].toUpperCase();

/** Pure: what the Order bought: "CE All-Access · 3 months". */
export const orderItem = ({ planName, days }: Pick<AdminOrder, "planName" | "days">): string =>
  `${planName} · ${periodLabel(days)}`;

/** One step of an Order's timeline: what happened, when (null while it's still awaited), and its dot's colour. */
export interface TimelineStep {
  label: string;
  at: string | null;
  tone: "info" | "done" | "waiting" | "failed";
}

/** Pure: when an Order made at `createdAt` showed as Expired. */
const expiredAt = (createdAt: string) =>
  new Date(new Date(createdAt).getTime() + ORDER_EXPIRES_AFTER_MS).toISOString();

const EXPIRED_STEP = "Expired · no payment confirmed within 24 hours";

/** Pure: an Order's timeline, by the status every screen shows. */
export function orderTimeline(order: AdminOrder): TimelineStep[] {
  const method = methodLabel(order.method);
  const started: TimelineStep = { label: "Checkout started", at: order.createdAt, tone: "info" };
  const sent: TimelineStep = { label: `Sent to ${method}`, at: order.createdAt, tone: "info" };
  const expired: TimelineStep = {
    label: EXPIRED_STEP,
    at: expiredAt(order.createdAt),
    tone: "failed",
  };

  switch (order.status) {
    case "pending":
      return [
        started,
        sent,
        { label: `Waiting for ${method} to confirm`, at: null, tone: "waiting" },
      ];
    case "expired":
      return [started, sent, expired];
    case "failed":
      return [
        started,
        {
          label:
            order.method === "card"
              ? "Card declined by the bank"
              : `${method} payment didn’t go through`,
          at: order.statusChangedAt,
          tone: "failed",
        },
      ];
    case "paid":
    case "refunded": {
      const paidAt = order.paidAt ?? order.statusChangedAt;
      const paid: TimelineStep[] = [
        ...(order.paidAfterExpiry
          ? [
              started,
              expired,
              { label: `Paid after expiry · with ${method}`, at: paidAt, tone: "info" as const },
            ]
          : [started, { label: `Paid with ${method}`, at: paidAt, tone: "info" as const }]),
        { label: "PayMongo confirmed · access granted", at: paidAt, tone: "done" },
      ];
      return order.status === "refunded"
        ? [...paid, { label: "Refunded in PayMongo", at: order.statusChangedAt, tone: "failed" }]
        : paid;
    }
  }
}

const PAID_NOTE =
  "Paid and confirmed by PayMongo. Access started right away. Refunds, if any, are issued from the PayMongo dashboard.";

/** Pure: the status note: what this status means, and what happens next. */
export function statusNote(order: AdminOrder): string {
  switch (order.status) {
    case "pending":
      return `${methodLabel(order.method)} hasn’t confirmed this payment yet. Access is granted automatically when PayMongo confirms. Pending payments expire after 24 hours.`;
    case "expired":
      return "No payment was confirmed within 24 hours, so this Order expired and granted nothing. If PayMongo confirms a late payment, it still counts and access is granted.";
    case "failed":
      return `The payment didn’t go through and the Member wasn’t charged. They saw “${failureCopy(order.method).title}” with other ways to pay.`;
    case "paid":
      return order.paidAfterExpiry
        ? `Paid after expiry: PayMongo confirmed it more than 24 hours after checkout started, and the payment still counts. ${PAID_NOTE}`
        : PAID_NOTE;
    case "refunded":
      return "Refunded in PayMongo. This Order’s days came off the Access Pass.";
  }
}

/** Pure: the line under "Check status with PayMongo": what PayMongo said, and what changed. */
export function checkMessage({ outcome, order }: OrderStatusCheck): string {
  switch (outcome) {
    case "still-pending":
      return `CHECKED JUST NOW · STILL PENDING AT ${methodTag(order.method)}`;
    case "paid":
      return "CHECKED JUST NOW · PAID · ACCESS GRANTED";
    case "failed":
      return "CHECKED JUST NOW · PAYMENT FAILED · NOTHING GRANTED";
    case "unknown":
      return "CHECKED JUST NOW · PAYMONGO COULDN’T SAY · NOTHING CHANGED";
    case "not-pending":
      return `NOTHING TO CHECK · THIS ORDER IS ${orderStatusTag(order.status)}`;
  }
}

/** Pure: PayMongo's reference for an Order: the payment's ID, or the checkout's while there's no payment. */
export const payMongoReference = ({
  paymentId,
  checkoutId,
}: Pick<AdminOrder, "paymentId" | "checkoutId">): string | null => paymentId ?? checkoutId;

/**
 * Pure: "Open in PayMongo dashboard ↗": the dashboard's Payments list searched
 * for the payment's ID; null while there's no payment. PayMongo documents the
 * Payments list and its search; a single payment's own address isn't.
 */
export function payMongoDashboardUrl({ paymentId }: Pick<AdminOrder, "paymentId">): string | null {
  if (!paymentId) return null;
  return `https://dashboard.paymongo.com/payments?search=${encodeURIComponent(paymentId)}`;
}
