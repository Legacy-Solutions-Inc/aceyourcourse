import { formatPeso } from "@/lib/money";
import { expiresAt, isCourseOrder, orderItem, type OrderStatus } from "@/lib/payments/order-ledger";
import { isFullyRefunded, isPartiallyRefunded } from "@/lib/payments/refunds";
import { failureCopy, methodLabel, methodTag } from "@/lib/payments/payment-methods";
import type { AdminOrder, OrderStatusCheck } from "@/services/admin.types";

// ─────────────────────────────────────────────────────────────────────────────
// What the Orders admin says about an Order (Phase 4, ticket 07; story 148;
// BUILD-MAP §3.9; mockup 752–785, 1481–1510), pure: its item and status, the
// timeline by status ("Paid after expiry" where it applies), the status note,
// what "Check status with PayMongo" found, and PayMongo's reference and
// dashboard link. Refunds (ticket 09): each succeeded refund is a timeline
// step, the one reaching the whole amount refunding it in full, and a Paid
// Order's partial refund reads "PARTIALLY REFUNDED · ₱300". An Order kept
// after its account was deleted reads "Account deleted" (ticket 14), and one
// paid after that gave no access: its timeline and note say so, and to
// refund it in PayMongo.
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

/**
 * Pure: whether an Order was kept after its buyer's account was deleted
 * (ticket 14): every Order is made by a signed-in Member, and only deleting
 * their account empties it.
 */
export const isAccountDeleted = ({ userId }: Pick<AdminOrder, "userId">): boolean =>
  userId === null;

/** Pure: what the Order bought: "CE All-Access · 3 months", or "PSAD Masterclass · Video course". */
export { orderItem };

/** One step of an Order's timeline: what happened, when (null while it's still awaited), and its dot's colour. */
export interface TimelineStep {
  label: string;
  at: string | null;
  tone: "info" | "done" | "waiting" | "failed";
}

const EXPIRED_STEP = "Expired · no payment confirmed within 24 hours";

/**
 * Pure: an Order's refunds as timeline steps, oldest first: partial ones
 * changed no access; the one reaching the whole amount refunded it in full,
 * its unused days removed (none for one paid with no account: it gave none).
 * A Refunded Order with no refund recorded ends on its status change.
 */
function refundSteps(order: AdminOrder): TimelineStep[] {
  if (order.refunds.length === 0) {
    return order.status === "refunded"
      ? [{ label: "Refunded in PayMongo", at: order.statusChangedAt, tone: "failed" }]
      : [];
  }
  let refunded = 0;
  return order.refunds.map(({ amountCentavos, refundedAt }) => {
    refunded += amountCentavos;
    const amount = formatPeso(amountCentavos);
    // An Order paid with no account gave no access, and a Course Order no days (ticket 06),
    // so their refunds take no days off.
    const gaveAccess = !order.paidWithoutAccount && order.days !== null;
    return isFullyRefunded(order, refunded)
      ? {
          label: `Refunded in full in PayMongo · ${amount}${gaveAccess ? " · unused days removed" : ""}`,
          at: refundedAt,
          tone: "failed",
        }
      : {
          label: `Partially refunded in PayMongo · ${amount}${gaveAccess ? " · access unchanged" : ""}`,
          at: refundedAt,
          tone: "info",
        };
  });
}

/** Pure: a Paid Order's partial refund, "PARTIALLY REFUNDED · ₱300"; null with none, or once Refunded. */
export const partialRefundLabel = (
  order: Pick<AdminOrder, "status" | "refundedCentavos">,
): string | null =>
  isPartiallyRefunded(order) ? `PARTIALLY REFUNDED · ${formatPeso(order.refundedCentavos)}` : null;

/** Pure: an Order's timeline, by the status every screen shows. */
export function orderTimeline(order: AdminOrder): TimelineStep[] {
  const method = methodLabel(order.method);
  const started: TimelineStep = { label: "Checkout started", at: order.createdAt, tone: "info" };
  const sent: TimelineStep = { label: `Sent to ${method}`, at: order.createdAt, tone: "info" };
  const expired: TimelineStep = {
    label: EXPIRED_STEP,
    at: expiresAt(order.createdAt),
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
        confirmedStep(order, paidAt),
      ];
      return [...paid, ...refundSteps(order)];
    }
  }
}

/** Pure: what PayMongo's confirmation gave: access, the Course for good (ticket 06), or nothing. */
function confirmedStep(order: AdminOrder, paidAt: string): TimelineStep {
  if (order.paidWithoutAccount) {
    return {
      label: "PayMongo confirmed · account deleted, no access given",
      at: paidAt,
      tone: "failed",
    };
  }
  if (order.paidAlreadyOwned) {
    return {
      label: "PayMongo confirmed · Course already owned, nothing given",
      at: paidAt,
      tone: "failed",
    };
  }
  return isCourseOrder(order)
    ? { label: "PayMongo confirmed · Course owned for good", at: paidAt, tone: "done" }
    : { label: "PayMongo confirmed · access granted", at: paidAt, tone: "done" };
}

const PAID_START = "Paid and confirmed by PayMongo. Access started right away.";
const COURSE_PAID_NOTE =
  "Paid and confirmed by PayMongo. The Member owns the Course for good. Refunds, if any, are issued from the PayMongo dashboard.";
const PAID_ALREADY_OWNED =
  "PayMongo confirmed this payment while the Member already owned the Course, so it gave nothing.";
const PAID_NOTE = `${PAID_START} Refunds, if any, are issued from the PayMongo dashboard.`;
const PAID_WITHOUT_ACCOUNT =
  "PayMongo confirmed this payment after the Member’s account was deleted, so it gave no access.";

/** Pure: the status note: what this status means, and what happens next. */
export function statusNote(order: AdminOrder): string {
  switch (order.status) {
    case "pending":
      return `${methodLabel(order.method)} hasn’t confirmed this payment yet. Access is granted automatically when PayMongo confirms. Pending payments expire after 24 hours.`;
    case "expired":
      return "No payment was confirmed within 24 hours, so this Order expired and granted nothing. If PayMongo confirms a late payment, it still counts and access is granted.";
    case "failed":
      return `The payment didn’t go through and the Member wasn’t charged. They saw “${failureCopy(order.method).title}” with other ways to pay.`;
    case "paid": {
      if (order.paidWithoutAccount) {
        const sofar =
          order.refundedCentavos > 0
            ? `: ${formatPeso(order.refundedCentavos)} of it is refunded so far`
            : "";
        return `${PAID_WITHOUT_ACCOUNT} Refund it in the PayMongo dashboard${sofar}.`;
      }
      if (order.paidAlreadyOwned)
        return `${PAID_ALREADY_OWNED} Refund it in the PayMongo dashboard.`;
      if (isCourseOrder(order)) return COURSE_PAID_NOTE;
      const note =
        order.refundedCentavos > 0
          ? `${PAID_START} PayMongo refunded ${formatPeso(order.refundedCentavos)} of it, which changed no access: adjust it on the Member’s page if needed.`
          : PAID_NOTE;
      return order.paidAfterExpiry
        ? `Paid after expiry: PayMongo confirmed it more than 24 hours after checkout started, and the payment still counts. ${note}`
        : note;
    }
    case "refunded":
      if (isCourseOrder(order)) return "Refunded in full in PayMongo.";
      return order.paidWithoutAccount
        ? "Refunded in full in PayMongo. It was paid after the Member’s account was deleted, so it never gave access."
        : "Refunded in full in PayMongo. This Order’s unused days came off the Access Pass, and the Member was told in the app.";
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
