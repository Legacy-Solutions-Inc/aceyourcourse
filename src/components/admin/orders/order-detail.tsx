import Link from "next/link";
import type { ReactNode } from "react";

import type { AdminAction } from "@/lib/admin/action";
import {
  isAccountDeleted,
  orderItem,
  orderTimeline,
  payMongoDashboardUrl,
  payMongoReference,
  statusNote,
  type TimelineStep,
} from "@/lib/admin/order-view";
import { formatDateTime } from "@/lib/manila-time";
import { formatPeso } from "@/lib/money";
import { methodLabel } from "@/lib/payments/payment-methods";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { InvoiceRequest } from "@/lib/payments/invoice-requests";
import type { AdminOrderDetail, AdminOrderNote, OrderStatusCheck } from "@/services/admin.types";

import { CheckStatusButton } from "./check-status-button";
import { InvoiceRequestPanel } from "./invoice-request-panel";
import { OrderNoteForm } from "./order-note-form";
import { OrderStatusTag, PartialRefundNote, TestOrderTag } from "./order-status-tag";

interface OrderDetailProps {
  detail: AdminOrderDetail;
  saveNote: AdminAction<AdminOrderNote>;
  checkStatus: AdminAction<OrderStatusCheck>;
  markInvoiceSent: AdminAction<InvoiceRequest>;
}

const card = "flex min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4";
const label = "font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue";
const term = "font-mono text-xs font-medium text-muted-foreground";

const DOTS: Record<TimelineStep["tone"], string> = {
  info: "bg-ayc-blue",
  done: "bg-ayc-success",
  waiting: "bg-ayc-warning",
  failed: "bg-destructive",
};

/**
 * One Order's detail page (mockup 752–785; BUILD-MAP §3.9; story 148): the
 * Order with its Member, PayMongo reference and timeline; the status note and
 * the internal note only Staff see; "Check status with PayMongo" while it's
 * recorded Pending, and the PayMongo dashboard link; and its Invoice Request,
 * with "Mark invoice sent" (ticket 08). Refunds are issued from the PayMongo
 * dashboard, never here; PayMongo's events record them (ticket 09), and they
 * show in the facts, the timeline and the status note.
 */
export function OrderDetail({ detail, saveNote, checkStatus, markInvoiceSent }: OrderDetailProps) {
  const { order, note } = detail;
  const reference = payMongoReference(order);
  const dashboard = payMongoDashboardUrl(order);
  return (
    <div className="grid items-start gap-4.5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section aria-labelledby="order-reference" className={cn(card, "gap-3.5 p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h2 id="order-reference" className="font-mono text-xl font-bold">
            {order.reference}
          </h2>
          <span className="flex flex-col items-end gap-1">
            <span className="flex items-center gap-1.5">
              {order.livemode ? null : <TestOrderTag />}
              <OrderStatusTag status={order.status} />
            </span>
            <PartialRefundNote order={order} />
          </span>
        </div>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 text-sm wide:grid-cols-[160px_minmax(0,1fr)]">
          <Fact term="MEMBER">
            <Member detail={detail} />
          </Fact>
          <Fact term="ITEM">
            <span className="font-semibold">{orderItem(order)}</span>
          </Fact>
          <Fact term="AMOUNT">
            <span className="font-extrabold">{formatPeso(order.priceCentavos)}</span>
          </Fact>
          {order.refundedCentavos > 0 ? (
            <Fact term="AMOUNT REFUNDED">
              <span className="font-extrabold">{formatPeso(order.refundedCentavos)}</span>
              {order.status === "refunded" ? " · in full" : " · in part"}
            </Fact>
          ) : null}
          <Fact term="METHOD">{methodLabel(order.method)}</Fact>
          <Fact term="PAYMONGO REF">
            <span className="font-mono text-[13px] wrap-anywhere">{reference ?? "None yet"}</span>
          </Fact>
          <Fact term="CREATED">{formatDateTime(order.createdAt)}</Fact>
        </dl>
        <h3 className={cn(label, "mt-1.5 text-foreground")}>TIMELINE</h3>
        <ol className="ml-1.5 flex flex-col border-l-2 border-ayc-rule">
          {orderTimeline(order).map((step) => (
            <li key={step.label} className="relative pb-3.5 pl-4.5 last:pb-0">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-0.75 -left-1.75 size-3 rounded-full border-2 border-ayc-paper",
                  DOTS[step.tone],
                )}
              />
              <span className="block text-sm font-bold">{step.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {step.at ? formatDateTime(step.at) : "WAITING"}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex min-w-0 flex-col gap-3">
        <section aria-labelledby="order-status-note" className={card}>
          <h2 id="order-status-note" className={label}>
            STATUS NOTE
          </h2>
          <p className="text-sm leading-normal text-foreground">{statusNote(order)}</p>
          <OrderNoteForm note={note} action={saveNote} />
        </section>

        {order.invoice ? (
          <section aria-labelledby="order-invoice" className={card}>
            <h2 id="order-invoice" className={label}>
              INVOICE REQUEST
            </h2>
            <InvoiceRequestPanel
              reference={order.reference}
              request={order.invoice}
              markSent={markInvoiceSent}
            />
          </section>
        ) : null}

        <section aria-labelledby="order-actions" className={cn(card, "gap-2")}>
          <h2 id="order-actions" className={label}>
            ACTIONS
          </h2>
          <CheckStatusButton
            reference={order.reference}
            checkable={order.recordedStatus === "pending"}
            action={checkStatus}
          />
          {dashboard ? (
            <a
              href={dashboard}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-10.5 items-center justify-center border-[1.5px] px-4 text-sm font-bold hover:bg-ayc-sand"
            >
              {/* A flex item would drop the space before the arrow. */}
              <span>
                Open in PayMongo dashboard <span aria-hidden="true">↗</span>
              </span>
            </a>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Refunds are issued from the PayMongo dashboard.
          </p>
        </section>
      </div>
    </div>
  );
}

function Fact({ term: name, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className={term}>{name}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

/** The buyer: a link to their Member detail page while their Member record is there. */
function Member({ detail }: { detail: AdminOrderDetail }) {
  const { memberUserId, order } = detail;
  const { buyerEmail, buyerName } = order;
  return (
    <span className="flex flex-col gap-0.5">
      {memberUserId ? (
        <Link
          href={paths.admin.user(memberUserId)}
          className="w-fit font-semibold wrap-anywhere text-ayc-blue underline-offset-2 hover:underline"
        >
          {buyerEmail}
        </Link>
      ) : (
        <span className="font-semibold wrap-anywhere">{buyerEmail}</span>
      )}
      {buyerName ? <span className="text-[13px] text-muted-foreground">{buyerName}</span> : null}
      {isAccountDeleted(order) ? (
        <span className="font-mono text-[10px] font-bold text-ayc-slate">ACCOUNT DELETED</span>
      ) : null}
    </span>
  );
}
