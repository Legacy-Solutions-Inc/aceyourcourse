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
// - The status check: asks the payments client for the checkout's status and
//   applies the outcome through the Order ledger (order-ledger.ts). Paid
//   writes the Order, the Member's Access Pass, its paid history row, the
//   Target Exam (added, or brought back, like a grant), an in-app notice and
//   Staff Activity under "PayMongo (system)", all or nothing. An outcome
//   already applied changes nothing. Ticket 05's webhook and expiry sweep
//   settle Orders the same way (settleOrder).
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

/** How an arm reads and writes Orders. */
export interface OrderStore {
  /** The Exams Members can study, and every Plan on sale, as they are now. */
  readOnSale(): Promise<{ exams: MemberExam[]; plans: Plan[] }>;
  /** A Member's record, or null for a User id no Member has. */
  readMember(userId: string): Promise<Member | null>;
  /** Adds a Pending Order, numbering its reference from the next one free; gives it numbered. */
  addOrder(order: Omit<Order, "reference">): Promise<Order>;
  /** Records the checkout's id the payments client gave an Order. */
  setCheckoutId(orderId: string, checkoutId: string): Promise<void>;
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
      cancelPath: paths.memberApp.plansFor(order.examCode),
    });
    if (checkout.checkoutId) await store.setCheckoutId(order.id, checkout.checkoutId);
    return { ok: true, reference: order.reference, redirectTo: checkout.redirectTo };
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

  async function checkOrderStatus(
    userId: string,
    reference: string,
    client: PaymentsClient | null,
  ): Promise<MemberOrder | null> {
    const own = await ownOrder(userId, reference);
    if (!own) return null;
    const { order } = own;
    if (!client || order.status !== "pending") return memberOrderOf(order, own.accessUntil);

    const status = await client.checkoutStatus({ orderId: order.id, checkoutId: order.checkoutId });
    if (status.status !== "pending") {
      const now = new Date();
      await store.withOrder(order.id, (holding) => ({
        write: settleOrder(holding, status.status, status.paymentId, now),
        result: null,
      }));
    }
    return getMemberOrder(userId, reference);
  }

  return { payForPlan, getMemberOrder, checkOrderStatus };
}
