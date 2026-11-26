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
// - Paid on an Order whose account was deleted grants nothing: the Order is
//   marked paidWithoutAccount, for an Owner to refund in PayMongo (ticket
//   14; settleOrder in src/services/orders.core.ts).
// - Pending → Expired: the daily sweep records an Order PayMongo didn't
//   confirm within 24 hours (ticket 05). Before that, every read shows it
//   Expired already (effectiveStatus).
// - Paid → Refunded: a full refund in PayMongo (ticket 09; refunds.ts says
//   when refunds are full). The Order's unused days come off the pass
//   (removeUnusedDays below). A partial refund leaves the Order Paid, and
//   Pending, Failed and Expired Orders granted nothing to refund.
// - Paid and Refunded never move back. Each outcome is applied once: an
//   outcome the table has no row for (the same one again, a failed event
//   after a paid one, a paid event after a refund) changes nothing.
//
// The transitions are a table, so a later ticket adds a move by adding a row
// (ticket 05: Failed → Paid and Expired → Paid; ticket 09: Paid → Refunded).
//
// The segment model (ticket 09; reused by ticket 10's "End granted access"):
// an Access Pass's days stack as consecutive segments, one per history row
// (access_pass_grants: each grant, extension and Paid Order adds its days at
// the pass's end then, or at now when it had ended). passSegments reads the
// segments as they stand; removeUnusedDays takes the part after now off the
// segments chosen (one Order's for a refund, the granted ones for ticket 10)
// and shifts every later segment earlier by as much, so their days are kept.
// ─────────────────────────────────────────────────────────────────────────────

/** An Order's states (CONTEXT.md → Order). This ticket moves Pending to Paid or Failed. */
export const ORDER_STATUSES = ["pending", "paid", "failed", "expired", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * What a payment's outcome can be: Paid or Failed from PayMongo, Expired from
 * the daily sweep, Refunded from PayMongo's refunds reaching the whole amount.
 */
export type OrderOutcome = "paid" | "failed" | "expired" | "refunded";

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
  /**
   * Whether its payment landed after the buyer's account was deleted
   * (ticket 14): recorded Paid with no grant, so an Owner refunds it in
   * PayMongo. Set once, by the ledger, and never cleared.
   */
  paidWithoutAccount: boolean;
}

/** The moves each outcome makes from each state; one not here changes nothing. */
const TRANSITIONS: Readonly<
  Record<OrderStatus, Readonly<Partial<Record<OrderOutcome, OrderStatus>>>>
> = {
  pending: { paid: "paid", failed: "failed", expired: "expired" },
  paid: { refunded: "refunded" },
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

// ── The segment model ───────────────────────────────────────────────────────
//
// The history rows hold each segment as it stands now: removing days rewrites
// the rows' starts_at and ends_at in place (the arms write the segments
// removeUnusedDays gives back), rather than adding removal entries that every
// later read would have to replay in time order. So a row is always the
// segment its days fill, and the next removal, or ticket 10, reads the rows
// as they are. What each row first added stays readable: its `days`, who
// granted it and when, and Staff Activity's end before and after every
// change. A segment whose days all went keeps its row, with no length.
//
// Rows from before that, which "End access now" (ticket 17) left running
// past the end it set, are read as ending there: passSegments ends each
// segment at the pass's end, and where a later row starts (one added after
// the pass had ended starts at the moment it was added).

/** One row of a pass's history as the segment model reads it: whose days, from and until. */
export interface PassSegment {
  /** The Paid Order whose days these are; null for a grant or an extension. */
  orderId: string | null;
  startsAt: string;
  endsAt: string;
}

/**
 * One history row as an arm hands it to the segment model, with the arm's key
 * for writing it back (the row's seq in Postgres, its place in the sample data).
 */
export interface PassHistoryRow extends PassSegment {
  key: number;
}

const ms = (iso: string) => new Date(iso).getTime();
const iso = (time: number) => new Date(time).toISOString();

/**
 * Pure: a pass's segments as they stand, from its history rows in order and
 * the pass's end: each row ends no later than the pass, nor than any later
 * row's start. Each row keeps its other fields.
 */
export function passSegments<T extends PassSegment>(
  history: readonly T[],
  passEndsAt: string,
): T[] {
  // From the last row back: each ends no later than the pass, nor any row after it starts.
  let limit = ms(passEndsAt);
  return [...history]
    .reverse()
    .map((row) => {
      const clipped = {
        ...row,
        startsAt: iso(Math.min(ms(row.startsAt), limit)),
        endsAt: iso(Math.min(ms(row.endsAt), limit)),
      };
      limit = Math.min(limit, ms(row.startsAt));
      return clipped;
    })
    .reverse();
}

/**
 * Pure: a pass with the unused days of the segments `removes` chooses taken
 * off at `now`, from its history rows in order and its end:
 * - a chosen segment loses its part after now: all of it when it hasn't
 *   started, the rest when it's part used, nothing when it's used up;
 * - every later segment moves earlier by what went before it, keeping its
 *   days, and the end moves earlier by everything that went;
 * - the end never moves before now, and an end already past doesn't move.
 * Gives every segment as it now stands (each row's other fields kept) and
 * the pass's new end.
 */
export function removeUnusedDays<T extends PassSegment>(
  history: readonly T[],
  passEndsAt: string,
  removes: (segment: T) => boolean,
  now: Date,
): { segments: T[]; endsAt: string } {
  const at = now.getTime();
  let removed = 0;
  // After passSegments, a segment never starts before the one ahead of it
  // ends, and any gap (a pass that lapsed) lies before now: only segments
  // after now move.
  const segments = passSegments(history, passEndsAt).map((segment) => {
    const startsAt = ms(segment.startsAt) - removed;
    let endsAt = ms(segment.endsAt) - removed;
    const cut = Math.max(startsAt, at);
    if (removes(segment) && endsAt > cut) {
      removed += endsAt - cut;
      endsAt = cut;
    }
    return { ...segment, startsAt: iso(startsAt), endsAt: iso(endsAt) };
  });
  return {
    segments,
    endsAt: removed > 0 ? iso(Math.max(at, ms(passEndsAt) - removed)) : passEndsAt,
  };
}

/**
 * What "End granted access" would do to a pass now (ticket 10): nothing,
 * when no granted day falls after now (the pass has ended, or only paid days
 * are left); end it now, when no paid day is left after the granted ones go;
 * or end it on `endsAt`, keeping the paid days. `moved` is the history rows
 * whose segment that changes, as they then stand, for the arm to rewrite.
 */
export type GrantedEnding<T extends PassSegment> =
  { kind: "none" } | { kind: "now" | "keeps-paid"; endsAt: string; moved: T[] };

/**
 * Pure: "End granted access" on a pass at `now`, from its history rows in
 * order and its end: the granted segments (grants and extensions: no
 * Order's) lose their part after now and every later paid segment moves
 * earlier by as much (removeUnusedDays). Paid days, used or not, stay.
 *
 * Days of the pass that no history row holds came before the history was
 * kept (ticket 17 started it; sample passes have none): a Paid Order always
 * writes its row (ticket 03), so they're granted days, and go too. They can
 * only lie before the first row, which started at the pass's end then.
 */
export function endGrantedDays<T extends PassSegment>(
  history: readonly T[],
  passEndsAt: string,
  now: Date,
): GrantedEnding<T> {
  const standing = passSegments(history, passEndsAt);
  const heldFrom = ms(standing[0]?.startsAt ?? passEndsAt);
  const untracked =
    heldFrom > now.getTime()
      ? [{ row: null, orderId: null, startsAt: now.toISOString(), endsAt: iso(heldFrom) }]
      : [];
  const { segments, endsAt } = removeUnusedDays(
    [...untracked, ...standing.map((row) => ({ ...row, row }))],
    passEndsAt,
    (segment) => segment.orderId === null,
    now,
  );
  if (endsAt === passEndsAt) return { kind: "none" };
  const moved = segments.flatMap(({ row, startsAt, endsAt: until }) =>
    row && (row.startsAt !== startsAt || row.endsAt !== until)
      ? [{ ...row, startsAt, endsAt: until }]
      : [],
  );
  return { kind: ms(endsAt) > now.getTime() ? "keeps-paid" : "now", endsAt, moved };
}

/** Pure: whether an Order was ever Paid: Paid, or Refunded since (it has a Payment Acknowledgement). */
export const wasPaid = (status: OrderStatus): boolean => status === "paid" || status === "refunded";

/** How long a Pending Order waits for PayMongo before it's Expired. */
export const ORDER_EXPIRES_AFTER_MS = 24 * 60 * 60 * 1000;

/** Pure: when a Pending Order made at `createdAt` expires, as an ISO time: 24 hours later. */
export const expiresAt = (createdAt: string): string =>
  new Date(new Date(createdAt).getTime() + ORDER_EXPIRES_AFTER_MS).toISOString();

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

/**
 * Pure: whether an Order paid after its account was deleted is still Paid,
 * so an Owner has yet to refund it in PayMongo (ticket 14).
 */
export const awaitsRefund = (order: Pick<Order, "status" | "paidWithoutAccount">): boolean =>
  order.paidWithoutAccount && order.status === "paid";

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
