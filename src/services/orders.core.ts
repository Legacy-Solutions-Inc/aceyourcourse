import { z } from "zod";

import {
  applyOutcome,
  effectiveStatus,
  isOrderReference,
  ORDER_EXPIRES_AFTER_MS,
  paidAfterExpiry,
  type Order,
  type OrderOutcome,
  PAYMONGO_SYSTEM_ACTOR,
} from "@/lib/payments/order-ledger";
import { PAYMENT_METHODS } from "@/lib/payments/payment-methods";
import { periodLabel } from "@/lib/plans/plan-text";
import { paths } from "@/paths";
import { noticeOf, passEntityId, type PassWrite } from "@/services/access-passes.core";
import type { Plan, StaffActivity } from "@/services/admin.types";
import type { AccessPass } from "@/services/content.types";
import { activityRecord } from "@/services/content-editor.core";
import { memberUserIdSchema } from "@/services/member.schema";
import {
  examCodeOf,
  examCodesOnSale,
  grantedTargetExam,
  type MemberExam,
  type TargetExamRecord,
} from "@/services/member.rules";
import type {
  ExpirySweep,
  Member,
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
// ─────────────────────────────────────────────────────────────────────────────

/** An Order as one outcome finds it, with what Paid changes alongside it. */
export interface OrderHolding {
  order: Order;
  /** The buyer's Member record; null once their account is deleted (ticket 14). */
  member: Member | null;
  /** The buyer's pass for the Order's Exam, or null when they hold none. */
  pass: AccessPass | null;
  /** The buyer's Target Exam records, removed ones too, in the order first added. */
  targetExams: TargetExamRecord[];
}

/** What an outcome writes, all or nothing. */
export interface OrderWrite {
  /** The Order moved on. */
  order: Order;
  /**
   * For Paid: the change to the buyer's Access Pass, written as an Owner's
   * grant is (its paid history row, the Target Exam, the notice and the Staff
   * Activity); null for Failed, Expired, or a Paid Order whose account is gone.
   */
  paid: PassWrite | null;
  /** The Staff Activity for a move that changes no pass (Failed, Expired, Paid with no account); null with `paid`. */
  activity: StaffActivity | null;
}

/** One of a Member's Orders, with the days its payment added to their pass, from and until (null until Paid). */
export interface OwnOrder {
  order: Order;
  paidDays: { startsAt: string; endsAt: string } | null;
}

/** Where a payment event finds its Order: by its checkout's id, or our id or reference. */
export interface OrderLookup {
  checkoutId: string | null;
  orderId: string | null;
  reference: string | null;
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
   * finds (by checkout id, then our id, then reference) as withOrder does,
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
}

const payInputSchema = z.object({
  examCode: z.string().max(20),
  planId: z.string().uuid(),
  method: z.enum(PAYMENT_METHODS),
});

/** Pure: what the screens show of an Order at `now`: Expired once Pending past its 24 hours. */
const memberOrderOf = ({ order, paidDays }: OwnOrder, now: Date): MemberOrder => ({
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
  };
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
   * (ticket 06): the Order, the buyer as at Pay, the access period its days
   * gave, and PayMongo's reference (the payment's id, or the checkout's while
   * there's none). Null for anyone else's Order, or one that isn't Paid.
   */
  async function getPaymentAcknowledgement(
    userId: string,
    reference: string,
  ): Promise<PaymentAcknowledgement | null> {
    const own = await ownOrder(userId, reference);
    if (!own || own.order.status !== "paid") return null;
    const { order, paidDays } = own;
    return {
      order: memberOrderOf(own, new Date()),
      buyer: { name: order.buyerName, email: order.buyerEmail },
      access: paidDays,
      payMongoReference: order.paymentId ?? order.checkoutId,
    };
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
   * about, through the same ledger as the status check.
   */
  async function recordPaymentEvent(event: PaymentEvent): Promise<PaymentEventResult> {
    const now = new Date();
    const recorded = await store.withPaymentEvent(
      { id: event.id, type: event.type, receivedAt: now },
      { checkoutId: event.checkoutId, orderId: event.orderId, reference: event.reference },
      (holding) => {
        const write = settleOrder(holding, event.outcome, event.paymentId, now);
        return { write, result: write ? ("applied" as const) : ("no-change" as const) };
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
    recordPaymentEvent,
    expireOverdueOrders,
    checkOrderStatus: (userId: string, reference: string, client: PaymentsClient | null) =>
      statusOf(userId, reference, client, false),
    pollOrderStatus: (userId: string, reference: string, client: PaymentsClient | null) =>
      statusOf(userId, reference, client, true),
  };
}
