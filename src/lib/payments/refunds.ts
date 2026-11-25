import type { Order } from "@/lib/payments/order-ledger";

// ─────────────────────────────────────────────────────────────────────────────
// PayMongo's refunds, as an Order records them (Phase 4, ticket 09; spec,
// Phase 4 planning decisions → Refunds; CONTEXT.md → Refunded, partial
// refund), pure. An Owner refunds in the PayMongo dashboard, never in the
// app; PayMongo's refund events tell us (payment.refunded and
// payment.refund.updated, docs.paymongo.com/reference/webhook-resource).
//
// - Each refund is kept once, by PayMongo's id ("ref_…"), with its amount in
//   centavos and its status: pending, processing, succeeded or failed
//   (docs.paymongo.com/reference/refund-resource). Two events carrying the
//   same refund count it once.
// - Only a succeeded refund counts: the Order's refunded amount is the sum of
//   its succeeded refunds. A pending or processing one moves on when PayMongo
//   says so; succeeded and failed are final (a failed refund is retried as a
//   new one), so a late, older event never moves one back.
// - A full refund is the refunds reaching the Order's amount, several
//   partial ones adding up to it included (the Order ledger then makes the
//   Order Refunded). Anything less is a partial refund, which leaves the
//   Order Paid.
// ─────────────────────────────────────────────────────────────────────────────

/** A refund's statuses at PayMongo. Only succeeded counts. */
export const REFUND_STATUSES = ["pending", "processing", "succeeded", "failed"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/** A refund as PayMongo's event carries it. */
export interface PaymentRefund {
  /** PayMongo's refund id, "ref_…": each refund is kept once. */
  id: string;
  amountCentavos: number;
  status: RefundStatus;
  /** ISO time PayMongo refunded it; null until it has. */
  refundedAt: string | null;
}

/** A refund as an Order records it. */
export interface OrderRefund extends PaymentRefund {
  orderId: string;
}

/** The statuses a refund never moves on from. */
const FINAL: ReadonlySet<RefundStatus> = new Set(["succeeded", "failed"]);

/** Pure: an Order's refunded amount: its succeeded refunds, added up. */
export const refundedCentavos = (
  refunds: readonly Pick<PaymentRefund, "status" | "amountCentavos">[],
): number =>
  refunds.reduce(
    (sum, { status, amountCentavos }) => sum + (status === "succeeded" ? amountCentavos : 0),
    0,
  );

/** Pure: whether refunds of `refunded` centavos are the Order's whole amount. */
export const isFullyRefunded = (
  { priceCentavos }: Pick<Order, "priceCentavos">,
  refunded: number,
) => refunded >= priceCentavos;

/** Pure: whether an Order is partially refunded: still Paid, with part of it refunded. */
export const isPartiallyRefunded = ({
  status,
  refundedCentavos,
}: {
  status: Order["status"];
  refundedCentavos: number;
}): boolean => status === "paid" && refundedCentavos > 0;

/** Pure: the refunds of one Order, from refunds of many, by its id. */
export const refundsOfOrder =
  <T extends Pick<OrderRefund, "orderId">>(refunds: readonly T[]) =>
  (orderId: string): T[] =>
    refunds.filter((refund) => refund.orderId === orderId);

/** Pure: an Order's succeeded refunds, oldest first. */
export const succeededRefunds = <T extends PaymentRefund>(refunds: readonly T[]): T[] =>
  refunds
    .filter((refund) => refund.status === "succeeded")
    .sort((a, b) => (a.refundedAt ?? "").localeCompare(b.refundedAt ?? ""));

/**
 * Pure: an event's refund as the Order records it, received at `receivedAt`:
 * a succeeded one keeps PayMongo's refund time, or the event's arrival when
 * PayMongo gives none; any other has none yet.
 */
function recorded(orderId: string, refund: PaymentRefund, receivedAt: Date): OrderRefund {
  const { id, amountCentavos, status } = refund;
  const refundedAt =
    status === "succeeded" ? (refund.refundedAt ?? receivedAt.toISOString()) : null;
  return { id, orderId, amountCentavos, status, refundedAt };
}

/**
 * Pure: an Order's recorded refunds with an event's merged in, at
 * `receivedAt`: a refund it hasn't seen is added after the others; one it
 * has moves on only from pending or processing, to a different status.
 * Gives every refund, and the ones added or moved on (what to write).
 */
export function mergeRefunds(
  orderId: string,
  held: readonly OrderRefund[],
  incoming: readonly PaymentRefund[],
  receivedAt: Date,
): { refunds: OrderRefund[]; changed: OrderRefund[] } {
  const byId = new Map(held.map((refund) => [refund.id, refund]));
  const changed = new Map<string, OrderRefund>();
  for (const refund of incoming) {
    const before = byId.get(refund.id);
    if (before && (FINAL.has(before.status) || before.status === refund.status)) continue;
    const after = recorded(orderId, refund, receivedAt);
    byId.set(refund.id, after);
    changed.set(refund.id, after);
  }
  return { refunds: [...byId.values()], changed: [...changed.values()] };
}
