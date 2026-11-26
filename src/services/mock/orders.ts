import type { InvoiceRequest } from "@/lib/payments/invoice-requests";
import {
  FIRST_REFERENCE_NUMBER,
  type Order,
  orderReference,
  wasPaid,
} from "@/lib/payments/order-ledger";
import type { PaymentMethod } from "@/lib/payments/payment-methods";
import type { OrderRefund } from "@/lib/payments/refunds";
import { defaultPlanName, type PlanDays } from "@/lib/plans/plan-rules";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { sampleUserId } from "@/services/mock/members";
import { samplePlanId } from "@/services/mock/plans";

import { stableUuid } from "./stable-uuid";

// ─────────────────────────────────────────────────────────────────────────────
// The sample Orders (Phase 4, ticket 07), so the Orders admin has something to
// show on the dev server and in the e2e specs: Paid, Pending and Failed ones,
// one older than 30 days, and one Test Order; one Paid Order has an Invoice
// Request waiting to be sent (ticket 08). Their buyers are made-up
// example.com addresses that never sign in; a buyer's Member detail page
// appears only once they do. The last two are refunds (ticket 09), bought by
// sample Members who sign in, so their Billing shows them: Bea's Order is
// partially refunded (₱300) and stays Paid, and Lou's is Refunded. Their
// Access Passes are the sample data's own (members.ts), so these Orders add
// no history rows. The Overview's sales (ticket 11) add three more Paid ones
// over the last two weeks, one paid after it expired; they come after the
// rest, so the references before them stay as the other tickets' specs name
// them, though they were made earlier. Ticket 14 adds two more, both older
// than 30 days: Lou's CE 3 months, whose days her lapsed pass used up, so
// deleting her account keeps two paid Orders; and one paid a day after its
// buyer's account was deleted, with no account, for the Overview's "Paid,
// account deleted · refund in PayMongo". Unit tests start without any of them
// (resetSampleStore), so a first Pay there is AYC-10001. Never add a real
// person's address here.
// ─────────────────────────────────────────────────────────────────────────────

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface SampleOrder {
  buyer: { name: string; email: string };
  examCode: string;
  days: PlanDays;
  priceCentavos: number;
  method: PaymentMethod;
  status: "paid" | "pending" | "failed" | "refunded";
  /** How long before boot it was made. */
  madeAgo: number;
  /** How long before boot it was paid, when not two minutes after it was made (paid after expiry). */
  paidAgo?: number;
  livemode: boolean;
  /** Its Invoice Request, not yet sent, asked for this long before boot (ticket 08). */
  invoice?: { name: string; address: string; tin: string | null; requestedAgo: number };
  /** Its succeeded PayMongo refunds, each refunded this long before boot (ticket 09). */
  refunds?: { amountCentavos: number; refundedAgo: number }[];
  /** Paid after its buyer's account was deleted: no account, and nothing granted (ticket 14). */
  paidWithoutAccount?: true;
}

const MARIA = { name: "Maria Santos", email: "maria.santos@example.com" };
const PAOLO = { name: "Paolo Reyes", email: "paolo.reyes@example.com" };
const KAREN = { name: "Karen Villanueva", email: "karen.villanueva@example.com" };
const JOSE = { name: "Jose Lopez", email: "jose.lopez@example.com" };
const TESS = { name: "Tess Buyer", email: "tess.buyer@example.com" };
const RINA = { name: "Rina Cruz", email: "rina.cruz@example.com" };
// Sample Members of the "Sign in as" list (members.ts).
const BEA = { name: "Bea Tester", email: "tester@example.com" };
const LOU = { name: "Lou Lapsed", email: "lapsed@example.com" };

/**
 * Oldest first, so the references count up with time, as Pays make them; the
 * Overview's three (ticket 11) and ticket 14's two are added after, though
 * made earlier.
 */
const SAMPLE_ORDERS: readonly SampleOrder[] = [
  // Outside the last 30 days: only "All time" shows it.
  {
    buyer: JOSE,
    examCode: "CE",
    days: 180,
    priceCentavos: 229_900,
    method: "gcash",
    status: "paid",
    madeAgo: 45 * DAY,
    livemode: true,
  },
  {
    buyer: MARIA,
    examCode: "CE",
    days: 90,
    priceCentavos: 129_900,
    method: "qrph",
    status: "paid",
    madeAgo: 20 * DAY,
    livemode: true,
    invoice: {
      name: "Sample Builders Inc.",
      address: "12 Sample St, Jaro, Iloilo City",
      tin: "123-456-789-000",
      requestedAgo: 19 * DAY,
    },
  },
  {
    buyer: PAOLO,
    examCode: "CE",
    days: 30,
    priceCentavos: 49_900,
    method: "gcash",
    status: "paid",
    madeAgo: 6 * DAY,
    livemode: true,
  },
  {
    buyer: KAREN,
    examCode: "ME",
    days: 30,
    priceCentavos: 44_900,
    method: "card",
    status: "failed",
    madeAgo: 4 * DAY,
    livemode: true,
  },
  // A Test Order: shown only with "Include test orders".
  {
    buyer: TESS,
    examCode: "CE",
    days: 30,
    priceCentavos: 49_900,
    method: "maya",
    status: "paid",
    madeAgo: 2 * DAY,
    livemode: false,
  },
  {
    buyer: PAOLO,
    examCode: "ME",
    days: 30,
    priceCentavos: 44_900,
    method: "maya",
    status: "pending",
    madeAgo: HOUR,
    livemode: true,
  },
  // A partial refund: still Paid, "PARTIALLY REFUNDED · ₱300".
  {
    buyer: BEA,
    examCode: "CE",
    days: 90,
    priceCentavos: 129_900,
    method: "qrph",
    status: "paid",
    madeAgo: 50 * MINUTE,
    livemode: true,
    refunds: [{ amountCentavos: 30_000, refundedAgo: 30 * MINUTE }],
  },
  // A full refund: Refunded.
  {
    buyer: LOU,
    examCode: "CE",
    days: 30,
    priceCentavos: 49_900,
    method: "gcash",
    status: "refunded",
    madeAgo: 40 * MINUTE,
    livemode: true,
    refunds: [{ amountCentavos: 49_900, refundedAgo: 20 * MINUTE }],
  },
  // The Overview's (ticket 11): Paid on more days of the chart, and one paid
  // after expiry, 26 hours after it was made, for Needs attention.
  {
    buyer: KAREN,
    examCode: "CE",
    days: 90,
    priceCentavos: 129_900,
    method: "gcash",
    status: "paid",
    madeAgo: 3 * DAY,
    livemode: true,
  },
  {
    buyer: JOSE,
    examCode: "ME",
    days: 30,
    priceCentavos: 44_900,
    method: "qrph",
    status: "paid",
    madeAgo: 9 * DAY,
    livemode: true,
  },
  {
    buyer: MARIA,
    examCode: "CE",
    days: 30,
    priceCentavos: 49_900,
    method: "card",
    status: "paid",
    madeAgo: 2 * DAY,
    paidAgo: 2 * DAY - 26 * HOUR,
    livemode: true,
  },
  // Ticket 14's, both outside the last 30 days. Lou's CE 3 months: its days
  // ran out 3 days before boot, as her pass did.
  {
    buyer: LOU,
    examCode: "CE",
    days: 90,
    priceCentavos: 129_900,
    method: "card",
    status: "paid",
    madeAgo: 93 * DAY,
    livemode: true,
  },
  // Paid 30 hours after it was made, by which time Rina's account was deleted.
  {
    buyer: RINA,
    examCode: "CE",
    days: 30,
    priceCentavos: 49_900,
    method: "maya",
    status: "paid",
    madeAgo: 40 * DAY,
    paidAgo: 40 * DAY - 30 * HOUR,
    livemode: true,
    paidWithoutAccount: true,
  },
];

/**
 * Pure: the sample Orders, timed from `bootedAt` and numbered from AYC-10001,
 * for the Exams the catalogue has; with the number the next Order takes,
 * their Invoice Requests and their refunds.
 */
export function sampleOrders(
  bootedAt: Date,
  catalogue: CatalogueSeed,
): {
  orders: Order[];
  nextOrderNumber: number;
  invoiceRequests: InvoiceRequest[];
  orderRefunds: OrderRefund[];
} {
  const exams = new Set(catalogue.exams.map(({ code }) => code));
  const samples = SAMPLE_ORDERS.filter(({ examCode }) => exams.has(examCode));
  const orders = samples.map((sample, index): Order => {
    const reference = orderReference(FIRST_REFERENCE_NUMBER + index);
    const createdAt = new Date(bootedAt.getTime() - sample.madeAgo).toISOString();
    const settledAt = new Date(
      bootedAt.getTime() - (sample.paidAgo ?? sample.madeAgo - 2 * MINUTE),
    ).toISOString();
    const settled = sample.status !== "pending";
    const paid = wasPaid(sample.status);
    const lastRefund = sample.refunds?.at(-1);
    return {
      id: stableUuid(`sample-order:${reference}`),
      reference,
      userId: sample.paidWithoutAccount ? null : sampleUserId(sample.buyer.email),
      examCode: sample.examCode,
      planId: samplePlanId(sample.examCode, sample.days),
      planName: defaultPlanName(sample.examCode),
      days: sample.days,
      priceCentavos: sample.priceCentavos,
      method: sample.method,
      status: sample.status,
      livemode: sample.livemode,
      checkoutId: `cs_sample${reference.slice(4)}`,
      paymentId: paid ? `pay_sample${reference.slice(4)}` : null,
      buyerName: sample.buyer.name,
      buyerEmail: sample.buyer.email,
      createdAt,
      paidAt: paid ? settledAt : null,
      statusChangedAt:
        sample.status === "refunded" && lastRefund
          ? new Date(bootedAt.getTime() - lastRefund.refundedAgo).toISOString()
          : settled
            ? settledAt
            : createdAt,
      paidWithoutAccount: sample.paidWithoutAccount ?? false,
    };
  });
  const invoiceRequests = samples.flatMap(({ invoice }, index): InvoiceRequest[] => {
    const order = orders[index];
    if (!invoice || !order) return [];
    const { requestedAgo, ...details } = invoice;
    return [
      {
        orderId: order.id,
        ...details,
        requestedAt: new Date(bootedAt.getTime() - requestedAgo).toISOString(),
        sentAt: null,
        sentBy: null,
      },
    ];
  });
  const orderRefunds = samples.flatMap(({ refunds = [] }, index): OrderRefund[] => {
    const order = orders[index];
    if (!order) return [];
    return refunds.map(({ amountCentavos, refundedAgo }, n) => ({
      id: `ref_sample${order.reference.slice(4)}${n === 0 ? "" : `_${n + 1}`}`,
      orderId: order.id,
      amountCentavos,
      status: "succeeded",
      refundedAt: new Date(bootedAt.getTime() - refundedAgo).toISOString(),
    }));
  });
  return {
    orders,
    nextOrderNumber: FIRST_REFERENCE_NUMBER + orders.length,
    invoiceRequests,
    orderRefunds,
  };
}
