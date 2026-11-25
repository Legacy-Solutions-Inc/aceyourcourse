import Link from "next/link";

import { cn } from "@/lib/utils";
import { paths } from "@/paths";

import type { OrderRow, PassCard, StatusTone } from "./billing-view";

const TONE: Record<StatusTone, string> = {
  paid: "border-ayc-success text-ayc-success",
  waiting: "border-ayc-warning text-ayc-warning",
  failed: "border-destructive text-destructive",
  ended: "border-muted-foreground text-muted-foreground",
};

const TAG = "font-mono text-[10px] leading-none font-bold px-1.5 py-1.5";

interface BillingScreenProps {
  passes: readonly PassCard[];
  orders: readonly OrderRow[];
}

/**
 * Billing's body (Phase 4, ticket 06; BUILD-MAP §3 Billing, L452–477; stories
 * 143, 144): the Member's Access Passes, each with Renew now, then every
 * Order, newest first, with a Payment Acknowledgement for each Paid one, or
 * "No payments yet" and See plans before their first Order.
 */
export function BillingScreen({ passes, orders }: BillingScreenProps) {
  return (
    <>
      <p className="text-[15px]">
        Your payment history. Card details stay with PayMongo; we never see them.
      </p>
      {passes.length > 0 ? (
        <section aria-labelledby="billing-access" className="flex flex-col gap-2.5">
          <h2 id="billing-access" className="text-[22px] font-extrabold tracking-[-0.02em]">
            Access
          </h2>
          <ul className="grid gap-3.5 sm:grid-cols-2">
            {passes.map((pass) => (
              <li
                key={pass.examCode}
                className="flex flex-col gap-2.5 border-[1.5px] bg-ayc-paper px-4.5 py-4"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <h3 className="text-lg font-extrabold">{pass.title}</h3>
                  <span
                    className={cn(
                      TAG,
                      pass.active ? "bg-ayc-success text-white" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {pass.tag}
                  </span>
                </div>
                <span className="text-sm">{pass.line}</span>
                <Link
                  href={pass.renewHref}
                  className="flex min-h-11 items-center self-start border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground"
                >
                  Renew now<span className="sr-only"> {pass.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="billing-orders" className="flex flex-col gap-2.5">
        <h2 id="billing-orders" className="text-[22px] font-extrabold tracking-[-0.02em]">
          Orders
        </h2>
        {orders.length === 0 ? (
          <div className="flex max-w-xl flex-col items-start gap-3 border-[1.5px] bg-ayc-paper p-4.5">
            <p className="text-lg font-extrabold">No payments yet</p>
            <Link
              href={paths.memberApp.plans}
              className="flex min-h-11 items-center border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground"
            >
              See plans
            </Link>
          </div>
        ) : (
          <ul aria-label="Orders" className="border-[1.5px] bg-ayc-paper">
            {orders.map((order) => (
              <li
                key={order.reference}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3 last:border-b-0"
              >
                <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{order.item}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{order.meta}</span>
                </span>
                {order.test ? (
                  <span className={cn(TAG, "bg-ayc-navy text-ayc-paper")}>TEST</span>
                ) : null}
                <span className={cn(TAG, "border-[1.5px]", TONE[order.tone])}>{order.status}</span>
                <span className="min-w-18 text-right text-base font-extrabold">{order.amount}</span>
                {order.acknowledgementHref ? (
                  <Link
                    href={order.acknowledgementHref}
                    className="flex min-h-9 items-center border-[1.5px] px-2.5 text-[13px] font-semibold"
                  >
                    <span className="sr-only">Payment </span>Acknowledgement
                    <span className="sr-only"> for {order.reference}</span>
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
