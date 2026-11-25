import { z } from "zod";

import {
  applyOutcome,
  isOrderReference,
  type Order,
  type OrderOutcome,
  PAYMONGO_SYSTEM_ACTOR,
} from "@/lib/payments/order-ledger";
import { PAYMENT_METHODS } from "@/lib/payments/payment-methods";
import { periodLabel } from "@/lib/plans/plan-text";
import { paths } from "@/paths";
import { noticeOf, passEntityId, type PassWrite } from "@/services/access-passes.core";
import type { Plan } from "@/services/admin.types";
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
import type { Member, MemberOrder, PayInput, PayRefusal, PayResult } from "@/services/member.types";
import type { PaymentsClient } from "@/services/payments.types";

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
//   claimed in the store, so two servers never both ask.
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
   * Activity); null for Failed.
   */
  paid: PassWrite | null;
}

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
   * The Member's own Order with this reference, with the end of the pass its
   * paid days gave (null until Paid); null for no Order of theirs.
   */
  findOwnOrder(
    userId: string,
    reference: string,
  ): Promise<{ order: Order; accessUntil: string | null } | null>;
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
}

const payInputSchema = z.object({
  examCode: z.string().max(20),
  planId: z.string().uuid(),
  method: z.enum(PAYMENT_METHODS),
});

/** Pure: what the screens show of an Order. */
const memberOrderOf = (order: Order, accessUntil: string | null): MemberOrder => ({
  id: order.id,
  reference: order.reference,
  examCode: order.examCode,
  planName: order.planName,
  days: order.days,
  priceCentavos: order.priceCentavos,
  method: order.method,
  status: order.status,
  createdAt: order.createdAt,
  paidAt: order.paidAt,
  accessUntil,
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
  const { paidDays } = step;
  if (!paidDays || !member) return { order: moved, paid: null };

  const { userId, email } = member;
  const { examCode, reference } = order;
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
        { email, examCode, endsAt: paidDays.endsAt, days: paidDays.days, reference, targetExam },
      ),
    },
  };
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
    return own && memberOrderOf(own.order, own.accessUntil);
  }

  /** Asks the client for an Order's checkout status, and applies Paid or Failed through the ledger. */
  async function applyCheckoutStatus(order: Order, client: PaymentsClient): Promise<void> {
    const status = await client.checkoutStatus({
      orderId: order.id,
      reference: order.reference,
      checkoutId: order.checkoutId,
    });
    if (status.status !== "paid" && status.status !== "failed") return;
    const now = new Date();
    await store.withOrder(order.id, (holding) => ({
      write: settleOrder(holding, status.status, status.paymentId, now),
      result: null,
    }));
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
    if (!asking) return memberOrderOf(order, own.accessUntil);
    await applyCheckoutStatus(order, client);
    return getMemberOrder(userId, reference);
  }

  return {
    payForPlan,
    getMemberOrder,
    checkOrderStatus: (userId: string, reference: string, client: PaymentsClient | null) =>
      statusOf(userId, reference, client, false),
    pollOrderStatus: (userId: string, reference: string, client: PaymentsClient | null) =>
      statusOf(userId, reference, client, true),
  };
}
