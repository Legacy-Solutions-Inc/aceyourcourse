import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orderItem, orderStatusTag } from "@/lib/admin/order-view";
import { DEFAULT_ORDER_QUERY, ordersHref, paidTileLabel } from "@/lib/admin/orders-list";
import { formatDate } from "@/lib/manila-time";
import { formatPeso } from "@/lib/money";
import { methodLabel } from "@/lib/payments/payment-methods";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import { type AdminOrder, type AdminOrderList, ORDER_STATUS_FILTERS } from "@/services/admin.types";

import { OrderFilters } from "./order-filters";
import { OrderStatusTag, TestOrderTag } from "./order-status-tag";

const chip =
  "flex min-h-9 items-center border-[1.5px] px-2.5 font-mono text-xs font-bold hover:bg-ayc-sand";
const head = "h-auto px-0 py-2.5 font-mono text-[10px] font-bold tracking-[0.06em] text-ayc-slate";

/**
 * Orders & payments (mockup 659–676; BUILD-MAP §3.9; story 147): the tiles for
 * the Orders the filters match, the search, status chips, Payment Method,
 * range and "Include test orders", all in the URL, then the Orders, newest
 * first. An Order's reference opens its detail page.
 */
export function OrderList({ list }: { list: AdminOrderList }) {
  const { query, rows, stats } = list;
  const tiles = [
    { label: paidTileLabel(query.range), value: formatPeso(stats.paidCentavos), tone: "" },
    { label: "ORDERS", value: String(stats.orders), tone: "" },
    { label: "PENDING", value: String(stats.pending), tone: "text-ayc-warning" },
    { label: "FAILED", value: String(stats.failed), tone: "text-destructive" },
  ];

  return (
    <section aria-label="Orders list" className="flex min-w-0 flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3 wide:grid-cols-4">
        {tiles.map(({ label, value, tone }) => (
          <div
            key={label}
            className="flex flex-col gap-1.5 border-[1.5px] bg-ayc-paper px-4 py-3.5"
          >
            <dt className="font-mono text-[11px] font-medium tracking-[0.06em] text-ayc-slate">
              {label}
            </dt>
            <dd className={cn("text-[28px] leading-none font-black tracking-[-0.02em]", tone)}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-1.5">
        <OrderFilters query={query} />
        <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
          {ORDER_STATUS_FILTERS.map((status) => (
            <Link
              key={status}
              href={ordersHref({ ...query, status })}
              scroll={false}
              aria-current={query.status === status ? "true" : undefined}
              className={cn(
                chip,
                query.status === status
                  ? "bg-ayc-navy text-ayc-cream hover:bg-ayc-navy"
                  : "bg-transparent",
              )}
            >
              {status === "any" ? "ANY STATUS" : orderStatusTag(status)}
            </Link>
          ))}
        </div>
      </div>

      <div className="border-[1.5px] bg-ayc-paper">
        <Table className="table-fixed wide:min-w-180">
          <TableHeader>
            <TableRow className="border-b-[1.5px] hover:bg-transparent">
              <TableHead className={cn(head, "w-26 pl-3.5 wide:w-32")}>ORDER</TableHead>
              <TableHead className={cn(head, "hidden w-28 wide:table-cell")}>DATE</TableHead>
              <TableHead className={head}>MEMBER</TableHead>
              <TableHead className={cn(head, "hidden wide:table-cell")}>ITEM</TableHead>
              <TableHead className={cn(head, "hidden w-20 wide:table-cell")}>METHOD</TableHead>
              <TableHead className={cn(head, "hidden w-22 wide:table-cell")}>AMOUNT</TableHead>
              <TableHead className={cn(head, "w-24 pr-3.5")}>STATUS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3.5 py-7 text-center text-sm text-muted-foreground">
            <p>No Orders match. Clear the search or filters.</p>
            <Link
              href={ordersHref(DEFAULT_ORDER_QUERY)}
              className="font-semibold text-ayc-blue underline underline-offset-4"
            >
              Show the last 30 days
            </Link>
          </div>
        ) : null}
      </div>

      <p className="text-[13px] text-muted-foreground">
        Payment status comes from PayMongo. Card details are never stored on the platform.
      </p>
    </section>
  );
}

/** One Order (mockup 671). On a phone, the item, method, amount and date fold under the email. */
function OrderRow({ order }: { order: AdminOrder }) {
  const date = (
    <span className="font-mono text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
  );
  const item = <span className="text-sm">{orderItem(order)}</span>;
  const method = <span className="text-[13px]">{methodLabel(order.method)}</span>;
  const amount = <span className="text-sm font-extrabold">{formatPeso(order.priceCentavos)}</span>;
  return (
    <TableRow className="border-ayc-ruled align-top hover:bg-ayc-sand/40">
      <TableCell className="py-2.75 pr-2.5 pl-3.5 whitespace-normal">
        <span className="flex flex-col gap-1">
          <Link
            href={paths.admin.order(order.reference)}
            className="w-fit font-mono text-xs font-bold text-ayc-navy underline-offset-2 hover:underline"
          >
            {order.reference}
          </Link>
          {order.livemode ? null : <TestOrderTag />}
        </span>
      </TableCell>
      <TableCell className="hidden px-0 py-2.75 whitespace-normal wide:table-cell">
        {date}
      </TableCell>
      <TableCell className="px-0 py-2.75 pr-2.5 whitespace-normal">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm wrap-anywhere">{order.buyerEmail}</span>
          <span className="flex flex-col gap-0.5 wide:hidden">
            {item}
            <span className="flex flex-wrap gap-x-2">
              {method}
              {amount}
            </span>
            {date}
          </span>
        </span>
      </TableCell>
      <TableCell className="hidden px-0 py-2.75 pr-2.5 whitespace-normal wide:table-cell">
        {item}
      </TableCell>
      <TableCell className="hidden px-0 py-2.75 whitespace-normal wide:table-cell">
        {method}
      </TableCell>
      <TableCell className="hidden px-0 py-2.75 whitespace-normal wide:table-cell">
        {amount}
      </TableCell>
      <TableCell className="py-2.75 pr-3.5 pl-0 whitespace-normal">
        <OrderStatusTag status={order.status} />
      </TableCell>
    </TableRow>
  );
}
