import { type PassDays, passWithDays } from "@/lib/member-app/access-pass";
import type { PaymentMethod } from "@/lib/payments/payment-methods";
import type { PlanDays } from "@/lib/plans/plan-rules";

// ─────────────────────────────────────────────────────────────────────────────
// The Order ledger (spec, Phase 4 → Order ledger, References; Phase 4
// planning decisions → Paying, Recording an outcome; Testing Decisions →
// Seam 4), pure: the rules every Phase 4 ticket that records a payment's
// outcome reuses (the payments fake here, PayMongo's status check in 04, the
// webhook and the expiry sweep in 05, refunds in 09).
//
// - An Order is one Member's attempt to buy one Plan, with the Plan's name,
//   days and price copied at Pay: a later change to the Plan never touches it.
// - Pending → Paid adds the Order's days to the Member's Access Pass for its
//   Exam: from the pass's end while it's active, otherwise from now
//   (access-pass.ts). Paid is the only state that grants access.
// - Pending → Failed grants nothing.
// - Failed → Paid (a retry on the same PayMongo page succeeds) and Expired →
//   Paid (a late payment) grant the days as Pending → Paid does (ticket 05).
//   A payment confirmed more than 24 hours after the Order was made is "Paid
//   after expiry" (paidAfterExpiry).
// - Pending → Expired: the daily sweep records an Order PayMongo didn't
//   confirm within 24 hours (ticket 05). Before that, every read shows it
//   Expired already (effectiveStatus).
// - Paid and Refunded never move back. Each outcome is applied once: an
//   outcome the table has no row for (the same one again, a failed event
//   after a paid one) changes nothing.
//
// The transitions are a table, so a later ticket adds a move by adding a row
// (ticket 05: Failed → Paid and Expired → Paid; ticket 09: Paid → Refunded).
// ─────────────────────────────────────────────────────────────────────────────

/** An Order's states (CONTEXT.md → Order). This ticket moves Pending to Paid or Failed. */
export const ORDER_STATUSES = ["pending", "paid", "failed", "expired", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** What a payment's outcome can be: Paid or Failed from PayMongo, Expired from the daily sweep. */
export type OrderOutcome = "paid" | "failed" | "expired";

export interface Order {
  id: string;
  /** "AYC-10001" upward (orderReference). */
  reference: string;
  /** The buyer's User id; null once their account is deleted (ticket 14). */
  userId: string | null;
  examCode: string;
  planId: string;
  /** The Plan's name, days and price in centavos, as they were at Pay. */
  planName: string;
  days: PlanDays;
  priceCentavos: number;
  method: PaymentMethod;
  status: OrderStatus;
  /** PayMongo's `livemode`: false for a Test Order, and with the payments fake. */
  livemode: boolean;
  /** PayMongo's checkout and payment ids; null with the payments fake. */
  checkoutId: string | null;
  paymentId: string | null;
  /** The buyer's name and email as they were at Pay, kept after their account goes (ticket 14). */
  buyerName: string | null;
  buyerEmail: string;
  /** ISO times: made at Pay, paid, and last moved to its status. */
  createdAt: string;
  paidAt: string | null;
  statusChangedAt: string;
}

/** The moves each outcome makes from each state; one not here changes nothing. */
const TRANSITIONS: Readonly<
  Record<OrderStatus, Readonly<Partial<Record<OrderOutcome, OrderStatus>>>>
> = {
  pending: { paid: "paid", failed: "failed", expired: "expired" },
  paid: {},
  failed: { paid: "paid" },
  expired: { paid: "paid" },
  refunded: {},
};

/** The days a Paid Order adds to the pass, from `startsAt` to `endsAt`, the pass's new end. */
export type PaidDays = PassDays & { days: PlanDays };

/** What applying an outcome does: nothing, or the Order as it is now with the days it grants. */
export type LedgerStep =
  { changed: false } | { changed: true; order: Order; paidDays: PaidDays | null };

/**
 * Pure: an outcome applied to an Order at `now`, with the Member's pass for
 * its Exam ending at `passEndsAt` (null for none). Gives the Order moved on,
 * and for Paid the days it adds to the pass; or no change, when the Order's
 * state has no move for that outcome (it was applied before, or the Order is
 * past it).
 */
export function applyOutcome(
  order: Order,
  outcome: OrderOutcome,
  passEndsAt: string | null,
  now: Date,
): LedgerStep {
  const next = TRANSITIONS[order.status][outcome];
  if (!next) return { changed: false };
  const at = now.toISOString();
  const paid = next === "paid";
  return {
    changed: true,
    order: { ...order, status: next, statusChangedAt: at, ...(paid ? { paidAt: at } : {}) },
    paidDays: paid ? { days: order.days, ...passWithDays(passEndsAt, order.days, now) } : null,
  };
}

/** How long a Pending Order waits for PayMongo before it's Expired. */
export const ORDER_EXPIRES_AFTER_MS = 24 * 60 * 60 * 1000;

/** Pure: whether a Pending Order made at `createdAt` is past its 24 hours at `now`. */
export const isOverdue = (createdAt: string, now: Date): boolean =>
  now.getTime() - new Date(createdAt).getTime() > ORDER_EXPIRES_AFTER_MS;

/**
 * Pure: an Order's state as every screen shows it at `now`: a Pending Order
 * older than 24 hours is Expired, whether or not the daily sweep has
 * recorded it yet. Every other state is as stored.
 */
export function effectiveStatus(
  order: Pick<Order, "status" | "createdAt">,
  now: Date,
): OrderStatus {
  return order.status === "pending" && isOverdue(order.createdAt, now) ? "expired" : order.status;
}

/** Pure: whether a Paid Order's payment was confirmed more than 24 hours after it was made. */
export function paidAfterExpiry(order: Pick<Order, "status" | "createdAt" | "paidAt">): boolean {
  return (
    order.paidAt !== null &&
    order.status !== "pending" &&
    isOverdue(order.createdAt, new Date(order.paidAt))
  );
}

/**
 * Who Staff Activity and the pass history name for what a payment's outcome
 * changes: PayMongo, never a person. The email is a marker, not an address,
 * so the Staff Activity list (ticket 15) can tell it apart.
 */
export const PAYMONGO_SYSTEM_ACTOR = {
  email: "system:paymongo",
  name: "PayMongo (system)",
} as const;

/** The number the first Order's reference carries. Test and live Orders share the numbering. */
export const FIRST_REFERENCE_NUMBER = 10_001;

/** Pure: an Order's reference from its number: "AYC-10001". */
export const orderReference = (n: number): string => `AYC-${n}`;

/** What an Order reference looks like: "AYC-" and five or more digits (orders_reference_format). */
export const ORDER_REFERENCE_PATTERN = /^AYC-\d{5,}$/;

/** Pure: whether a value an address carries is an Order reference. */
export const isOrderReference = (value: string): boolean => ORDER_REFERENCE_PATTERN.test(value);
