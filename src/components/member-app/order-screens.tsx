import Link from "next/link";

import { passEndDate } from "@/lib/member-app/access";
import { failureCopy, methodLabel, methodTag } from "@/lib/payments/payment-methods";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { MemberOrder } from "@/services/member.types";

import { PlansLink } from "./content-state";
import { OrderPoller, type OrderPollerProps } from "./order-poller";
import { orderLine, paymentLine } from "./order-view";

// The Order screens (Phase 4, ticket 03; mockup L546–574; BUILD-MAP §3 Pay
// pending, Pay failed, Pay success; stories 136–140): one card each, opened
// from the Order's address, which only its own Member can open.

const LABEL = "font-mono text-xs font-bold tracking-[0.06em]";
const TITLE = "text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em]";
const BODY = "text-[15px] leading-normal text-ayc-slate";
const PAYMENT_LINE =
  "border-t border-dashed border-ayc-rule pt-3 font-mono text-xs leading-[1.7] text-muted-foreground";
const PLAIN_BUTTON =
  "flex min-h-12 items-center border-[1.5px] border-ayc-navy px-4 text-[15px] font-bold";

/** The card every Order screen sits in, its shadow coloured by the outcome. */
function OrderCard({ shadow, children }: { shadow: string; children: React.ReactNode }) {
  return (
    <main id="main" className="flex w-full flex-1 px-4 py-6 wide:py-16">
      <div
        className={cn(
          "mx-auto flex h-fit w-full max-w-[520px] flex-col gap-3.5 border-[1.5px] border-ayc-navy bg-ayc-paper p-5 shadow-hard-lg wide:p-8",
          shadow,
        )}
      >
        {children}
      </div>
    </main>
  );
}

interface ConfirmingPaymentProps {
  order: MemberOrder;
  /** Whether the Order has waited about 2 minutes: then it says so and points to Support. */
  stillWaiting: boolean;
  /** The status-check backup for this Order (ticket 04), or null where there's no payments client. */
  check: OrderPollerProps["check"];
  /** Sample mode's "Simulate paid" / "Simulate failed" action; null anywhere else. */
  simulate: ((formData: FormData) => Promise<void>) | null;
}

/**
 * Confirming payment (Pay pending): waits for PayMongo to confirm the
 * Member's method, reading the Order again every few seconds. In sample mode
 * it offers "Simulate paid" and "Simulate failed".
 */
export function ConfirmingPayment({
  order,
  stillWaiting,
  check,
  simulate,
}: ConfirmingPaymentProps) {
  return (
    <OrderCard shadow="shadow-ayc-navy">
      <OrderPoller check={check} />
      <div aria-hidden="true" className="flex h-1.5 gap-1">
        <span className="flex-1 bg-ayc-blue" />
        <span className="flex-1 bg-ayc-blue" />
        <span className="flex-1 bg-ayc-orange" />
        <span className="flex-1 bg-ayc-sand" />
      </div>
      <p className={cn(LABEL, "text-ayc-blue")}>CONFIRMING PAYMENT</p>
      <h1 className={TITLE}>
        Waiting for PayMongo to confirm your {methodLabel(order.method)} payment
      </h1>
      <p className={BODY}>
        This usually takes under a minute. Keep this page open. Your access starts as soon as the
        payment is confirmed.
      </p>
      <p className={PAYMENT_LINE}>
        {orderLine(order)}
        <br />
        REF {order.reference}
      </p>
      {stillWaiting ? (
        <p role="status" className="border-[1.5px] border-ayc-warning p-3 text-sm leading-normal">
          Still waiting for PayMongo. If you paid and this page doesn’t change in a few minutes,
          contact{" "}
          <Link
            href={paths.memberApp.support}
            className="font-bold text-ayc-blue underline underline-offset-2"
          >
            Support
          </Link>{" "}
          with your reference, {order.reference}.
        </p>
      ) : null}
      {simulate ? (
        <section
          aria-labelledby="simulate-heading"
          className="flex flex-col gap-2 border-[1.5px] border-dashed border-ayc-navy p-3"
        >
          <h2 id="simulate-heading" className={LABEL}>
            SAMPLE DATA · NO PAYMONGO
          </h2>
          <form action={simulate} className="flex flex-wrap gap-2">
            <input type="hidden" name="reference" value={order.reference} />
            <button type="submit" name="outcome" value="paid" className={PLAIN_BUTTON}>
              Simulate paid
            </button>
            <button type="submit" name="outcome" value="failed" className={PLAIN_BUTTON}>
              Simulate failed
            </button>
          </form>
        </section>
      ) : null}
    </OrderCard>
  );
}

/** Paid (Pay success): the Member is in, until when; nothing renews by itself. */
export function PaymentConfirmed({ order }: { order: MemberOrder }) {
  const until = order.accessUntil ? passEndDate(order.accessUntil) : null;
  return (
    <OrderCard shadow="shadow-ayc-success">
      <p className={cn(LABEL, "text-ayc-success")}>✓ PAYMENT CONFIRMED</p>
      <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.02em]">
        You’re in. Kaya mo ’to.
      </h1>
      {until ? (
        <p className={BODY}>
          It’s active until {until}. It won’t renew on its own. We’ll remind you a week before it
          ends.
        </p>
      ) : null}
      <p className={PAYMENT_LINE}>{paymentLine(order)}</p>
      <PlansLink href={paths.memberApp.library}>Start reviewing</PlansLink>
    </OrderCard>
  );
}

/** Failed (Pay failed): what went wrong for the Member's method, and the way back to Plans. */
export function PaymentFailed({
  order,
  contactEmail,
}: {
  order: MemberOrder;
  contactEmail: string;
}) {
  const { title, body } = failureCopy(order.method);
  const subject = encodeURIComponent(`Payment ${order.reference}`);
  return (
    <OrderCard shadow="shadow-destructive">
      <p className={cn(LABEL, "text-destructive")}>PAYMENT DIDN’T GO THROUGH</p>
      <h1 className={TITLE}>{title}</h1>
      <p className={BODY}>{body}</p>
      <p className={PAYMENT_LINE}>
        {orderLine(order)} · {methodTag(order.method)}
        <br />
        REF {order.reference}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={paths.memberApp.plansFor(order.examCode)}
          className="flex min-h-12 items-center border-[1.5px] border-ayc-navy bg-ayc-navy px-4.5 text-[15px] font-bold text-ayc-cream"
        >
          Try another method
        </Link>
        <a href={`mailto:${contactEmail}?subject=${subject}`} className={PLAIN_BUTTON}>
          Email support
        </a>
      </div>
    </OrderCard>
  );
}
