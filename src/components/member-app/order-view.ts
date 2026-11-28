import { formatPeso } from "@/lib/money";
import type { OrderStatus } from "@/lib/payments/order-ledger";
import { methodTag } from "@/lib/payments/payment-methods";
import { periodLabel } from "@/lib/plans/plan-text";
import type { MemberOrder } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Order screens, worded (Phase 4, ticket 03; BUILD-MAP §3 Pay pending,
// Pay failed, Pay success; spec, Phase 4 → Return flow), pure. A Pending
// Order shows Confirming payment, which refreshes every few seconds and,
// after about 2 minutes, says it's still waiting and points to Support. Paid
// and Failed show their outcome. Expired and Refunded aren't made yet
// (tickets 05 and 09); Billing (ticket 06) shows them.
// ─────────────────────────────────────────────────────────────────────────────

/** How often Confirming payment reads the Order again. */
export const POLL_MS = 3_000;
/** How long Confirming payment waits with no outcome before it also has the server ask PayMongo (ticket 04). */
export const STATUS_CHECK_AFTER_MS = 15_000;
/** How long Confirming payment waits before it says it's still waiting. */
export const STILL_WAITING_MS = 2 * 60 * 1000;

/** Which screen an Order shows. */
export type OrderScreen = "confirming" | "paid" | "failed" | "billing";

/** Pure: the screen an Order in this state shows. */
export function orderScreen(status: OrderStatus): OrderScreen {
  switch (status) {
    case "pending":
      return "confirming";
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "expired":
    case "refunded":
      return "billing";
  }
}

/** Pure: the Order's summary line: "CE ALL-ACCESS · 3 MONTHS · ₱1,299". */
export const orderLine = ({ planName, days, priceCentavos }: MemberOrder): string =>
  `${planName} · ${periodLabel(days)} · ${formatPeso(priceCentavos)}`.toUpperCase();

/** Pure: the Paid screen's payment line: "₱1,299 · QR PH · REF AYC-10483 · ACKNOWLEDGEMENT IN BILLING". */
export const paymentLine = ({ priceCentavos, method, reference }: MemberOrder): string =>
  `${formatPeso(priceCentavos)} · ${methodTag(method)} · REF ${reference} · ACKNOWLEDGEMENT IN BILLING`;

/** Pure: whether an Order made at `createdAt` has been waiting long enough to say so, at `now`. */
export const stillWaiting = (createdAt: string, now: Date): boolean =>
  now.getTime() - new Date(createdAt).getTime() >= STILL_WAITING_MS;
