import { paymentWork } from "@/lib/admin/orders-list";
import { manilaDate, manilaDayStart } from "@/lib/manila-time";
import {
  memberFigures,
  type PassHolding,
  salesFigures,
  salesSince,
} from "@/lib/payments/sales-figures";
import type { PaidToday, SalesOverview, StaffActor } from "@/services/admin.types";
import { type AdminOrderRecord, adminOrderOf } from "@/services/orders-admin.core";

// ─────────────────────────────────────────────────────────────────────────────
// The Overview's sales for Owners (Phase 4, ticket 11; stories 151, 151w and
// 151x; spec, Phase 4 planning decisions → Orders and sales figures), shared
// by both arms of the Admin seam.
//
// - Owners only: an Editor gets null, so the figures never reach their page,
//   whatever it would show.
// - The arm reads what happened since an instant (Orders paid, refunds made)
//   and what's waiting (Pending payments, invoice requests to send, payments
//   that landed after an account was deleted: ticket 14), and the Access
//   Passes active now; the pure rules count it all
//   (src/lib/payments/sales-figures.ts for the money and the Members,
//   paymentWork in src/lib/admin/orders-list.ts for Needs attention's
//   payment items, with the Orders list's own filters).
// - The sidebar's "PAID TODAY" card reads only since midnight in Manila.
// ─────────────────────────────────────────────────────────────────────────────

/** How an arm reads what the sales count. */
export interface SalesStore {
  /**
   * The live Orders (never Test Orders) that were paid at or after `since`,
   * have a refund made at or after it, are recorded Pending, have an
   * official invoice requested and not yet sent, or are Paid after their
   * account was deleted (ticket 14) or for a Course already owned (Phase 5,
   * ticket 06), of any age; each with its Invoice
   * Request and refunds, in any order.
   */
  listSalesOrders(since: Date): Promise<AdminOrderRecord[]>;
  /**
   * The Access Passes active at `now` whose holder has a Member record (as
   * the Users list counts Members), each with whether they're active Staff.
   */
  listActivePasses(now: Date): Promise<PassHolding[]>;
}

/** Pure: the Orders as every Admin screen shows them at `now`. */
const shownAt = (orders: readonly AdminOrderRecord[], now: Date) =>
  orders.map((record) => adminOrderOf(record, now));

/** The Overview's sales calls, over an arm's store. */
export function salesCalls(store: SalesStore) {
  /** The Overview's sales for an Owner; null for an Editor. */
  async function salesOverview(actor: StaffActor): Promise<SalesOverview | null> {
    if (actor.role !== "owner") return null;
    const now = new Date();
    const [orders, passes] = await Promise.all([
      store.listSalesOrders(salesSince(now)),
      store.listActivePasses(now),
    ]);
    return {
      figures: salesFigures(orders, now),
      ...memberFigures(passes, now),
      payments: paymentWork(shownAt(orders, now), now),
    };
  }

  /** The sidebar's "PAID TODAY" card for an Owner; null for an Editor. */
  async function getPaidToday(actor: StaffActor): Promise<PaidToday | null> {
    if (actor.role !== "owner") return null;
    const now = new Date();
    const orders = await store.listSalesOrders(manilaDayStart(manilaDate(now)));
    const { today } = salesFigures(orders, now);
    return {
      date: today.date,
      netCentavos: today.netCentavos,
      orders: today.orders,
      pending: paymentWork(shownAt(orders, now), now).pending,
    };
  }

  return { salesOverview, getPaidToday };
}
