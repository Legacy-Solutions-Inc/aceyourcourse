import type { InvoiceRequest } from "@/lib/payments/invoice-requests";
import { FIRST_REFERENCE_NUMBER, type Order, orderReference } from "@/lib/payments/order-ledger";
import type { PaymentMethod } from "@/lib/payments/payment-methods";
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
// example.com addresses that never sign in, so no sample Member's Billing
// changes; a buyer's Member detail page appears only once they do. Unit tests
// start without them (resetSampleStore), so a first Pay there is AYC-10001.
// Never add a real person's address here.
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
  status: "paid" | "pending" | "failed";
  /** How long before boot it was made. */
  madeAgo: number;
  livemode: boolean;
  /** Its Invoice Request, not yet sent, asked for this long before boot (ticket 08). */
  invoice?: { name: string; address: string; tin: string | null; requestedAgo: number };
}

const MARIA = { name: "Maria Santos", email: "maria.santos@example.com" };
const PAOLO = { name: "Paolo Reyes", email: "paolo.reyes@example.com" };
const KAREN = { name: "Karen Villanueva", email: "karen.villanueva@example.com" };
const JOSE = { name: "Jose Lopez", email: "jose.lopez@example.com" };
const TESS = { name: "Tess Buyer", email: "tess.buyer@example.com" };

/** Oldest first, so the references count up with time, as Pays make them. */
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
];

/**
 * Pure: the sample Orders, timed from `bootedAt` and numbered from AYC-10001,
 * for the Exams the catalogue has; with the number the next Order takes, and
 * their Invoice Requests.
 */
export function sampleOrders(
  bootedAt: Date,
  catalogue: CatalogueSeed,
): { orders: Order[]; nextOrderNumber: number; invoiceRequests: InvoiceRequest[] } {
  const exams = new Set(catalogue.exams.map(({ code }) => code));
  const samples = SAMPLE_ORDERS.filter(({ examCode }) => exams.has(examCode));
  const orders = samples.map((sample, index): Order => {
    const reference = orderReference(FIRST_REFERENCE_NUMBER + index);
    const createdAt = new Date(bootedAt.getTime() - sample.madeAgo).toISOString();
    const settledAt = new Date(bootedAt.getTime() - sample.madeAgo + 2 * MINUTE).toISOString();
    const settled = sample.status !== "pending";
    return {
      id: stableUuid(`sample-order:${reference}`),
      reference,
      userId: sampleUserId(sample.buyer.email),
      examCode: sample.examCode,
      planId: samplePlanId(sample.examCode, sample.days),
      planName: defaultPlanName(sample.examCode),
      days: sample.days,
      priceCentavos: sample.priceCentavos,
      method: sample.method,
      status: sample.status,
      livemode: sample.livemode,
      checkoutId: `cs_sample${reference.slice(4)}`,
      paymentId: sample.status === "paid" ? `pay_sample${reference.slice(4)}` : null,
      buyerName: sample.buyer.name,
      buyerEmail: sample.buyer.email,
      createdAt,
      paidAt: sample.status === "paid" ? settledAt : null,
      statusChangedAt: settled ? settledAt : createdAt,
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
  return { orders, nextOrderNumber: FIRST_REFERENCE_NUMBER + orders.length, invoiceRequests };
}
