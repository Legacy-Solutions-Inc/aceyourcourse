import { z } from "zod";

import { type InvoiceRequest, invoiceStatus } from "@/lib/payments/invoice-requests";
import {
  applyOutcome,
  effectiveStatus,
  isOrderReference,
  ORDER_EXPIRES_AFTER_MS,
  paidAfterExpiry,
  type Order,
  type OrderOutcome,
  PAYMONGO_SYSTEM_ACTOR,
  type PassSegment,
  passSegments,
  removeUnusedDays,
  wasPaid,
} from "@/lib/payments/order-ledger";
import {
  isFullyRefunded,
  mergeRefunds,
  type OrderRefund,
  type PaymentRefund,
  refundedCentavos,
  succeededRefunds,
} from "@/lib/payments/refunds";
import { PAYMENT_METHODS } from "@/lib/payments/payment-methods";
import { periodLabel } from "@/lib/plans/plan-text";
import { paths } from "@/paths";
import { noticeOf, passEntityId, type PassWrite } from "@/services/access-passes.core";
import type { Plan, StaffActivity } from "@/services/admin.types";
import type { AccessPass } from "@/services/content.types";
import { activityRecord } from "@/services/content-editor.core";
import {
  invoiceFieldErrors,
  type InvoiceRequestInput,
  invoiceRequestInputSchema,
  memberUserIdSchema,
} from "@/services/member.schema";
import {
  examCodeOf,
  examCodesOnSale,
  grantedTargetExam,
  type MemberExam,
  type TargetExamRecord,
} from "@/services/member.rules";
import type {
  ExpirySweep,
  InvoiceRequestResult,
  Member,
  MemberInvoice,
  MemberNotice,
  MemberOrder,
  PaymentAcknowledgement,
  PaymentEventResult,
  PayInput,
  PayRefusal,
  PayResult,
} from "@/services/member.types";
import type { CheckoutStatus, PaymentEvent, PaymentsClient } from "@/services/payments.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Member seam's buying (Phase 4, ticket 03; spec, Phase 4 → Order ledger,
// Return flow, References; Phase 4 planning decisions → Paying, Who buys;
// stories 135–140), shared by both arms.
//
// - Pay: the server checks everything again. Buying must be set up (a
//   payments client), the method one of the four, the Plan on sale for an
//   Exam on the Website, and the Plan the posted Exam's. Then a new Pending
//   Order is made for the signed-in Member, every click, with the Plan's
//   name, days and price read here, never from the form, and the checkout is
//   started for it.
// - Pay's checkout (ticket 04): the checkout's id and livemode are recorded
//   on the Order. When the checkout can't start (PayMongo answering an
//   error), Pay is refused and the Member stays on Plans; the Order stays
//   Pending, and expires (ticket 05).
// - The status check: asks the payments client for the checkout's status and
//   applies the outcome through the Order ledger (order-ledger.ts). "Still
//   pending", or an answer the client couldn't trust, changes nothing. Paid
//   writes the Order, the Member's Access Pass, its paid history row, the
//   Target Exam (added, or brought back, like a grant), an in-app notice and
//   Staff Activity under "PayMongo (system)", all or nothing. An outcome
//   already applied changes nothing. Ticket 05's webhook and expiry sweep
//   settle Orders the same way (settleOrder).
// - The status-check backup (ticket 04): Confirming payment asks for the
//   status itself, so an outcome lands with a slow webhook or none (local
//   development). It asks PayMongo at most once every 10 seconds per Order,
//   claimed in the store, so two servers never both ask. The Owner's "Check
//   status with PayMongo" (the Orders admin, ticket 07) runs the same check
//   (checkCheckoutStatus), unthrottled.
// - A Member only ever reads or checks their own Orders: another's reference
//   answers nothing.
// - Refunds (ticket 09): PayMongo's refund events, applied once per event as
//   the outcomes are, record each refund once (refunds.ts). A partial refund
//   leaves the Order Paid and access as it was; refunds reaching the whole
//   amount make it Refunded and take its unused days off the pass (the Order
//   ledger's segment model), with a notice for the Member. A refund of a
//   Pending, Failed or Expired Order, which granted nothing, is ignored. Each
//   is logged in Staff Activity as "PayMongo (system)" with the end before
//   and after.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row of the buyer's pass history for the Order's Exam (access_pass_grants),
 * as the segment model reads it, with the arm's key for writing it back.
 */
export interface PassHistoryRow extends PassSegment {
  key: number;
}

/** An Order as one outcome finds it, with what Paid and refunds change alongside it. */
export interface OrderHolding {
  order: Order;
  /** The buyer's Member record; null once their account is deleted (ticket 14). */
  member: Member | null;
  /** The buyer's pass for the Order's Exam, or null when they hold none. */
  pass: AccessPass | null;
  /** The buyer's Target Exam records, removed ones too, in the order first added. */
  targetExams: TargetExamRecord[];
  /** The pass's history rows, in order; none without a pass (ticket 09). */
  history: PassHistoryRow[];
  /** The Order's PayMongo refunds recorded so far, in the order first recorded (ticket 09). */
  refunds: OrderRefund[];
}

/**
 * A full refund's change to the buyer's Access Pass (ticket 09): its new end,
 * the history rows whose segment moved (rewritten in place: the segment
 * model), the notice and the Staff Activity.
 */
export interface PassReduction {
  endsAt: string;
  segments: PassHistoryRow[];
  notice: MemberNotice;
  activity: StaffActivity;
}

/** What an outcome writes, all or nothing. */
export interface OrderWrite {
  /** The Order, moved on or as it was. */
  order: Order;
  /**
   * For Paid: the change to the buyer's Access Pass, written as an Owner's
   * grant is (its paid history row, the Target Exam, the notice and the Staff
   * Activity); null for Failed, Expired, or a Paid Order whose account is gone.
   */
  paid: PassWrite | null;
  /** The Staff Activity for a change to no pass (Failed, Expired, Paid with no account, refunds); null with `paid` or `reduction`. */
  activity: StaffActivity | null;
  /** The PayMongo refunds to record: added, or moved on, by their id (ticket 09). */
  refunds: OrderRefund[];
  /** For a full refund: the Order's unused days off the buyer's pass; null otherwise. */
  reduction: PassReduction | null;
}

/**
 * One of a Member's Orders, with the days its payment added to their pass,
 * from and until (null until Paid), its Invoice Request (ticket 08; null for
 * none) and its PayMongo refunds (ticket 09).
 */
export interface OwnOrder {
  order: Order;
  paidDays: { startsAt: string; endsAt: string } | null;
  invoice: InvoiceRequest | null;
  refunds: OrderRefund[];
}

/** Where a payment event finds its Order: by its checkout's id, our id or reference, or its payment's id. */
export interface OrderLookup {
  checkoutId: string | null;
  orderId: string | null;
  reference: string | null;
  paymentId: string | null;
}

/** What recording a payment event did: nothing for one seen before, or the Order it found (or none). */
export type EventRecording<T> =
  | { recorded: false }
  | { recorded: true; found: false }
  | { recorded: true; found: true; result: T };

/** The backup's least time between two status checks of one Order, on any server. */
export const STATUS_CHECK_EVERY_MS = 10_000;

/** How an arm reads and writes Orders. */
export interface OrderStore {
  /** The Exams Members can study, and every Plan on sale, as they are now. */
  readOnSale(): Promise<{ exams: MemberExam[]; plans: Plan[] }>;
  /** A Member's record, or null for a User id no Member has. */
  readMember(userId: string): Promise<Member | null>;
  /** Adds a Pending Order, numbering its reference from the next one free; gives it numbered. */
  addOrder(order: Omit<Order, "reference">): Promise<Order>;
  /** Records the checkout the payments client started for an Order: its id (null with the fake) and livemode. */
  recordCheckout(
    orderId: string,
    checkout: { checkoutId: string | null; livemode: boolean },
  ): Promise<void>;
  /**
   * Claims the next status check of a Pending Order at `now`, in one step:
   * true, recording `now`, unless the Order isn't Pending or was checked less
   * than `everyMs` before `now`; false then, recording nothing.
   */
  claimStatusCheck(orderId: string, now: Date, everyMs: number): Promise<boolean>;
  /**
   * The Member's own Order with this reference, with the days its payment
   * added to their pass (null until Paid); null for no Order of theirs.
   */
  findOwnOrder(userId: string, reference: string): Promise<OwnOrder | null>;
  /** Every Order of the Member's, newest first, each with its paid days (ticket 06). */
  listOwnOrders(userId: string): Promise<OwnOrder[]>;
  /**
   * Runs `work` on an Order and its buyer's pass as they are now, then writes
   * what it gives, all as one step: two outcomes for the same Order or Member
   * never interleave, and a write that fails partway leaves everything as it
   * was. Gives work's result, or null for an id no Order has.
   */
  withOrder<T>(
    orderId: string,
    work: (holding: OrderHolding) => { write: OrderWrite | null; result: T },
  ): Promise<T | null>;
  /**
   * Records a PayMongo event once, by its id, and runs `work` on the Order it
   * finds (by checkout id, then our id, then reference, then payment id) as
   * withOrder does,
   * all as one step: a write that fails leaves the event unrecorded, so
   * PayMongo's retry applies it. An event recorded before runs nothing.
   */
  withPaymentEvent<T>(
    event: { id: string; type: string; receivedAt: Date },
    lookup: OrderLookup,
    work: (holding: OrderHolding) => { write: OrderWrite | null; result: T },
  ): Promise<EventRecording<T>>;
  /** Every Pending Order made before `madeBefore`, oldest first: what the daily sweep checks. */
  listOverdueOrders(madeBefore: Date): Promise<Order[]>;
  /**
   * Adds an Order's Invoice Request (ticket 08), unless it has one: true when
   * added, false (adding nothing) when one is there, two at once included.
   */
  addInvoiceRequest(request: InvoiceRequest): Promise<boolean>;
}

const payInputSchema = z.object({
  examCode: z.string().max(20),
  planId: z.string().uuid(),
  method: z.enum(PAYMENT_METHODS),
});

/** Pure: an Invoice Request as the Member sees it: requested, then sent. */
const memberInvoiceOf = (request: InvoiceRequest): MemberInvoice => ({
  status: invoiceStatus(request),
  requestedAt: request.requestedAt,
  sentAt: request.sentAt,
});

/**
 * Pure: what the screens show of an Order at `now`: Expired once Pending past
 * its 24 hours; with what PayMongo refunded of it, and when last.
 */
const memberOrderOf = (
  { order, paidDays, invoice, refunds }: OwnOrder,
  now: Date,
): MemberOrder => ({
  id: order.id,
  reference: order.reference,
  examCode: order.examCode,
  planName: order.planName,
  days: order.days,
  priceCentavos: order.priceCentavos,
  method: order.method,
  status: effectiveStatus(order, now),
  createdAt: order.createdAt,
  paidAt: order.paidAt,
  livemode: order.livemode,
  accessUntil: paidDays?.endsAt ?? null,
  paidAfterExpiry: paidAfterExpiry(order),
  invoice: invoice && memberInvoiceOf(invoice),
  refundedCentavos: refundedCentavos(refunds),
  refundedAt: succeededRefunds(refunds).at(-1)?.refundedAt ?? null,
});

/**
 * Pure: what an outcome writes on an Order at `now`: nothing when the ledger
 * makes no move; the Order alone for Failed, or for Paid on an account that's
 * gone; otherwise the Order, its days on the pass and everything Paid writes.
 */
export function settleOrder(
  { order, member, pass, targetExams }: OrderHolding,
  outcome: OrderOutcome,
  paymentId: string | null,
  now: Date,
): OrderWrite | null {
  const step = applyOutcome(order, outcome, pass?.endsAt ?? null, now);
  if (!step.changed) return null;
  const moved = { ...step.order, paymentId: paymentId ?? step.order.paymentId };
  const { reference } = order;
  const late = paidAfterExpiry(moved) ? { paidAfterExpiry: true } : {};
  const { paidDays } = step;
  if (!paidDays || !member) {
    return {
      order: moved,
      paid: null,
      refunds: [],
      reduction: null,
      activity: activityRecord(
        PAYMONGO_SYSTEM_ACTOR,
        now,
        "order",
        order.id,
        `order-${moved.status}`,
        { reference, status: order.status },
        { reference, status: moved.status, ...late },
      ),
    };
  }

  const { userId, email } = member;
  const { examCode } = order;
  const endsBefore = pass?.endsAt ?? null;
  const added = grantedTargetExam(targetExams, examCode, now);
  const targetExam = added?.change ?? null;
  return {
    order: moved,
    paid: {
      endsAt: paidDays.endsAt,
      grant: {
        userId,
        examCode,
        ...paidDays,
        reason: `Order ${reference}`,
        grantedBy: { ...PAYMONGO_SYSTEM_ACTOR },
        grantedAt: now.toISOString(),
        orderId: order.id,
      },
      targetExam: added?.record ?? null,
      notice: noticeOf(userId, examCode, "granted", paidDays.endsAt, now),
      activity: activityRecord(
        PAYMONGO_SYSTEM_ACTOR,
        now,
        "access-pass",
        passEntityId(userId, examCode),
        "order-paid",
        { email, examCode, endsAt: endsBefore },
        {
          email,
          examCode,
          endsAt: paidDays.endsAt,
          days: paidDays.days,
          reference,
          targetExam,
          ...late,
        },
      ),
    },
    activity: null,
    refunds: [],
    reduction: null,
  };
}

/** What recording a refund event did: applied, changed nothing, or was ignored (an Order that was never Paid). */
export type RefundSettlement = "applied" | "no-change" | "ignored";

/**
 * Pure: what a refund event's refunds write on an Order at `now` (ticket 09):
 * - an Order that was never Paid (Pending, Failed, Expired) granted nothing
 *   to take back: ignored, and logged, recording no refund;
 * - each refund is recorded once (mergeRefunds): nothing new changes nothing;
 * - a refund not yet succeeded, or one more on a Refunded Order, is recorded
 *   and logged, and moves nothing else;
 * - refunds short of the whole amount leave the Order Paid and access as it
 *   was, logged with the amount refunded before and after;
 * - refunds reaching the whole amount (partials adding up to it included)
 *   make the Order Refunded and take its unused days off the buyer's pass,
 *   only its own (removeUnusedDays), with a notice and Staff Activity giving
 *   the end before and after. An account that's gone has no pass to change.
 */
export function settleRefunds(
  holding: OrderHolding,
  incoming: readonly PaymentRefund[],
  now: Date,
): { write: OrderWrite | null; result: RefundSettlement } {
  const { order, member, pass, history } = holding;
  const { id, reference, examCode, status } = order;
  const writing = (fields: Partial<OrderWrite>): OrderWrite => ({
    order,
    paid: null,
    activity: null,
    refunds: [],
    reduction: null,
    ...fields,
  });
  const logged = (action: string, before: object, after: object) =>
    activityRecord(PAYMONGO_SYSTEM_ACTOR, now, "order", id, action, before, after);

  if (!wasPaid(status)) {
    const activity = logged(
      "order-refund-ignored",
      { reference, status },
      { reference, status, refundedCentavos: refundedCentavos(incoming) },
    );
    return { write: writing({ activity }), result: "ignored" };
  }

  const { refunds, changed } = mergeRefunds(id, holding.refunds, incoming, now);
  if (changed.length === 0) return { write: null, result: "no-change" };
  const before = refundedCentavos(holding.refunds);
  const after = refundedCentavos(refunds);
  if (status === "refunded" || after === before) {
    // A refund not yet succeeded, or one more on a Refunded Order: recorded and logged, nothing else.
    const activity = logged(
      "order-refund-recorded",
      { reference, refundedCentavos: before },
      {
        reference,
        refundedCentavos: after,
        refunds: changed.map(({ id: refundId, status: refundStatus, amountCentavos }) => ({
          refundId,
          status: refundStatus,
          amountCentavos,
        })),
      },
    );
    return { write: writing({ refunds: changed, activity }), result: "applied" };
  }

  const endsBefore = pass?.endsAt ?? null;
  const step = isFullyRefunded(order, after)
    ? applyOutcome(order, "refunded", endsBefore, now)
    : null;
  if (!step?.changed) {
    const activity = logged(
      "order-partially-refunded",
      { reference, refundedCentavos: before, endsAt: endsBefore },
      { reference, refundedCentavos: after, endsAt: endsBefore },
    );
    return { write: writing({ refunds: changed, activity }), result: "applied" };
  }

  const refunded = step.order;
  if (!member || !pass) {
    const activity = logged(
      "order-refunded",
      { reference, status, refundedCentavos: before, endsAt: endsBefore },
      { reference, status: refunded.status, refundedCentavos: after, endsAt: endsBefore },
    );
    return { write: writing({ order: refunded, refunds: changed, activity }), result: "applied" };
  }

  const { userId, email } = member;
  const standing = passSegments(history, pass.endsAt);
  const { segments, endsAt } = removeUnusedDays(
    history,
    pass.endsAt,
    (row) => row.orderId === id,
    now,
  );
  const reduction: PassReduction = {
    endsAt,
    // Only the rows the refund moved: the Order's, and the ones after it.
    segments: segments.filter(
      (row, index) =>
        row.startsAt !== standing[index]?.startsAt || row.endsAt !== standing[index]?.endsAt,
    ),
    notice: noticeOf(userId, examCode, "refunded", endsAt, now, reference),
    activity: activityRecord(
      PAYMONGO_SYSTEM_ACTOR,
      now,
      "access-pass",
      passEntityId(userId, examCode),
      "order-refunded",
      { email, examCode, endsAt: pass.endsAt },
      { email, examCode, endsAt, reference, refundedCentavos: after },
    ),
  };
  return { write: writing({ order: refunded, refunds: changed, reduction }), result: "applied" };
}

/**
 * The status check, shared by Confirming payment's backup (statusOf below)
 * and the Owner's "Check status with PayMongo" (the Orders admin, ticket 07):
 * asks the client for an Order's checkout status, and applies Paid or Failed
 * through the ledger (settleOrder), all or nothing. Gives what the client
 * said, and whether that moved the Order: "pending", "unknown", or an outcome
 * already applied, changes nothing.
 */
export async function checkCheckoutStatus(
  store: Pick<OrderStore, "withOrder">,
  order: Order,
  client: PaymentsClient,
): Promise<{ status: CheckoutStatus["status"]; moved: boolean }> {
  const status = await client.checkoutStatus({
    orderId: order.id,
    reference: order.reference,
    checkoutId: order.checkoutId,
  });
  if (status.status !== "paid" && status.status !== "failed") {
    return { status: status.status, moved: false };
  }
  const now = new Date();
  const moved = await store.withOrder(order.id, (holding) => {
    const write = settleOrder(holding, status.status, status.paymentId, now);
    return { write, result: write !== null };
  });
  return { status: status.status, moved: moved === true };
}

/** The Member seam's buying, over an arm's store. */
export function orderCalls(store: OrderStore) {
  const refuse = (reason: PayRefusal): PayResult => ({ ok: false, reason });

  async function payForPlan(
    userId: string,
    sent: PayInput,
    client: PaymentsClient | null,
  ): Promise<PayResult> {
    const wanted = memberUserIdSchema.parse(userId);
    if (!client) return refuse("unavailable");
    const parsed = payInputSchema.safeParse(sent);
    if (!parsed.success) {
      const badMethod = parsed.error.issues.some((issue) => issue.path[0] === "method");
      return refuse(badMethod ? "bad-method" : "not-on-sale");
    }
    const { examCode, planId, method } = parsed.data;

    const member = await store.readMember(wanted);
    if (!member) throw new Error("Pay needs a Member record.");
    const { exams, plans } = await store.readOnSale();
    const plan = plans.find((candidate) => candidate.id === planId);
    if (!plan || !examCodesOnSale(exams, plans).includes(plan.examCode)) {
      return refuse("not-on-sale");
    }
    if (plan.examCode !== examCodeOf(examCode)) return refuse("wrong-exam");

    const at = new Date().toISOString();
    const order = await store.addOrder({
      id: crypto.randomUUID(),
      userId: wanted,
      examCode: plan.examCode,
      planId: plan.id,
      planName: plan.name,
      days: plan.days,
      priceCentavos: plan.priceCentavos,
      method,
      status: "pending",
      livemode: client.livemode,
      checkoutId: null,
      paymentId: null,
      buyerName: member.name,
      buyerEmail: member.email,
      createdAt: at,
      paidAt: null,
      statusChangedAt: at,
    });
    const checkout = await client.startCheckout({
      orderId: order.id,
      reference: order.reference,
      description: `${order.planName} · ${periodLabel(order.days)}`,
      priceCentavos: order.priceCentavos,
      method,
      buyer: { name: order.buyerName, email: order.buyerEmail },
      successPath: paths.memberApp.order(order.reference),
      cancelPath: paths.memberApp.plansCancelled(order.examCode),
    });
    if (!checkout.ok) return refuse("checkout-failed");
    const { checkoutId, livemode, redirectTo } = checkout;
    if (checkoutId || livemode !== order.livemode) {
      try {
        await store.recordCheckout(order.id, { checkoutId, livemode });
      } catch {
        // A checkout the Order doesn't know of can't be checked: the Member
        // isn't sent there, and the unpaid session is left to lapse.
        console.error(
          `The checkout for ${order.reference} wasn't recorded, so the Member wasn't sent to it.`,
        );
        return refuse("checkout-failed");
      }
    }
    return { ok: true, reference: order.reference, redirectTo };
  }

  /** The Member's own Order, or null; an address that isn't a reference reads nothing. */
  async function ownOrder(userId: string, reference: string) {
    const wanted = memberUserIdSchema.parse(userId);
    if (!isOrderReference(reference)) return null;
    return store.findOwnOrder(wanted, reference);
  }

  async function getMemberOrder(userId: string, reference: string): Promise<MemberOrder | null> {
    const own = await ownOrder(userId, reference);
    return own && memberOrderOf(own, new Date());
  }

  /** Every Order of the Member's, newest first, as at now (ticket 06). */
  async function listMemberOrders(userId: string): Promise<MemberOrder[]> {
    const now = new Date();
    const own = await store.listOwnOrders(memberUserIdSchema.parse(userId));
    return own.map((held) => memberOrderOf(held, now));
  }

  /**
   * The Payment Acknowledgement of one of the Member's own Paid Orders
   * (ticket 06), or Refunded ones (ticket 09: it then says so): the Order,
   * the buyer as at Pay, the access period its days gave, and PayMongo's
   * reference (the payment's id, or the checkout's while there's none). Null
   * for anyone else's Order, or one that was never Paid.
   */
  async function getPaymentAcknowledgement(
    userId: string,
    reference: string,
  ): Promise<PaymentAcknowledgement | null> {
    const own = await ownOrder(userId, reference);
    if (!own || !wasPaid(own.order.status)) return null;
    const { order, paidDays } = own;
    return {
      order: memberOrderOf(own, new Date()),
      buyer: { name: order.buyerName, email: order.buyerEmail },
      access: paidDays,
      payMongoReference: order.paymentId ?? order.checkoutId,
    };
  }

  /**
   * "Request official invoice" (ticket 08): for the Member's own Order only
   * (anyone else's answers not found), once it's Paid, and once. The form is
   * checked after the Order, so a refused Order says why before any field.
   * The store's add refuses a second request, two at once included.
   */
  async function requestInvoice(
    userId: string,
    reference: string,
    sent: InvoiceRequestInput,
  ): Promise<InvoiceRequestResult> {
    const own = await ownOrder(userId, reference);
    if (!own) return { ok: false, reason: "not-found" };
    if (own.order.status !== "paid") return { ok: false, reason: "not-paid" };
    if (own.invoice) return { ok: false, reason: "already-requested" };
    const parsed = invoiceRequestInputSchema.safeParse(sent);
    if (!parsed.success) {
      return { ok: false, reason: "invalid", fields: invoiceFieldErrors(parsed.error) };
    }
    const added = await store.addInvoiceRequest({
      orderId: own.order.id,
      ...parsed.data,
      requestedAt: new Date().toISOString(),
      sentAt: null,
      sentBy: null,
    });
    return added ? { ok: true } : { ok: false, reason: "already-requested" };
  }

  /**
   * The Member's own Order, after asking the client for its status while it's
   * Pending; `throttled`, only when no status check of it was claimed in the
   * last 10 seconds.
   */
  async function statusOf(
    userId: string,
    reference: string,
    client: PaymentsClient | null,
    throttled: boolean,
  ): Promise<MemberOrder | null> {
    const own = await ownOrder(userId, reference);
    if (!own) return null;
    const { order } = own;
    const asking =
      client !== null &&
      order.status === "pending" &&
      (!throttled || (await store.claimStatusCheck(order.id, new Date(), STATUS_CHECK_EVERY_MS)));
    if (!asking) return memberOrderOf(own, new Date());
    await checkCheckoutStatus(store, order, client);
    return getMemberOrder(userId, reference);
  }

  /**
   * A verified PayMongo event: applied once, by its id, to the Order it's
   * about, through the same ledger as the status check; a refund event's
   * refunds through settleRefunds (ticket 09).
   */
  async function recordPaymentEvent(event: PaymentEvent): Promise<PaymentEventResult> {
    const now = new Date();
    const { checkoutId, orderId, reference, paymentId } = event;
    const recorded = await store.withPaymentEvent(
      { id: event.id, type: event.type, receivedAt: now },
      { checkoutId, orderId, reference, paymentId },
      (holding): { write: OrderWrite | null; result: PaymentEventResult } => {
        if (event.outcome === "refund") return settleRefunds(holding, event.refunds, now);
        const write = settleOrder(holding, event.outcome, paymentId, now);
        return { write, result: write ? "applied" : "no-change" };
      },
    );
    if (!recorded.recorded) return "duplicate";
    return recorded.found ? recorded.result : "unknown-order";
  }

  /**
   * The daily sweep: asks the payments client once more about each Pending
   * Order older than 24 hours, then records it Paid if it says so, otherwise
   * Expired. When PayMongo can't answer about a checkout it started (an
   * outage), or settling one fails, the Order is left Pending for the next
   * day's sweep: every screen shows it Expired meanwhile. With no client,
   * each is Expired (a late payment still counts).
   */
  async function expireOverdueOrders(client: PaymentsClient | null): Promise<ExpirySweep> {
    const now = new Date();
    const overdue = await store.listOverdueOrders(new Date(now.getTime() - ORDER_EXPIRES_AFTER_MS));
    const counts: ExpirySweep = { checked: overdue.length, paid: 0, expired: 0, unanswered: 0 };
    for (const order of overdue) {
      try {
        const moved = await sweepOrder(order, client);
        if (moved === "paid") counts.paid += 1;
        else if (moved === "expired") counts.expired += 1;
        else if (moved === "unanswered") counts.unanswered += 1;
      } catch {
        console.error(
          `The expiry sweep couldn't settle ${order.reference}; it's left for the next sweep.`,
        );
        counts.unanswered += 1;
      }
    }
    return counts;
  }

  /** One overdue Order: Paid, Expired, left for PayMongo's answer, or already moved on (null). */
  async function sweepOrder(order: Order, client: PaymentsClient | null) {
    const status = client
      ? await client.checkoutStatus({
          orderId: order.id,
          reference: order.reference,
          checkoutId: order.checkoutId,
        })
      : ({ status: "unknown" } as const);
    if (status.status === "unknown" && client && order.checkoutId) return "unanswered" as const;
    const outcome = status.status === "paid" ? "paid" : "expired";
    const paymentId = status.status === "paid" ? status.paymentId : null;
    return store.withOrder(order.id, (holding) => {
      const write = settleOrder(holding, outcome, paymentId, new Date());
      return { write, result: write?.order.status ?? null };
    });
  }

  return {
    payForPlan,
    getMemberOrder,
    listMemberOrders,
    getPaymentAcknowledgement,
    requestInvoice,
    recordPaymentEvent,
    expireOverdueOrders,
    checkOrderStatus: (userId: string, reference: string, client: PaymentsClient | null) =>
      statusOf(userId, reference, client, false),
    pollOrderStatus: (userId: string, reference: string, client: PaymentsClient | null) =>
      statusOf(userId, reference, client, true),
  };
}
