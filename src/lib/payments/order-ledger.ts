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
// - Each outcome is applied once: an outcome the table has no row for (the
//   same one again, or anything after Paid) changes nothing.
//
// The transitions are a table, so a later ticket adds a move by adding a row
// (ticket 05: Failed → Paid and Expired → Paid; ticket 09: Paid → Refunded).
// ─────────────────────────────────────────────────────────────────────────────

/** An Order's states (CONTEXT.md → Order). This ticket moves Pending to Paid or Failed. */
export const ORDER_STATUSES = ["pending", "paid", "failed", "expired", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** What a payment's outcome can be. */
export type OrderOutcome = "paid" | "failed";

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
  pending: { paid: "paid", failed: "failed" },
  paid: {},
  failed: {},
  expired: {},
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
