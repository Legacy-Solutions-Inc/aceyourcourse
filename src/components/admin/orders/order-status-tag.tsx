import { orderStatusTag, partialRefundLabel } from "@/lib/admin/order-view";
import type { OrderStatus } from "@/lib/payments/order-ledger";
import { cn } from "@/lib/utils";
import type { AdminOrder } from "@/services/admin.types";

/** Each status's colour, as the mockup's tags have them (mockup 1494). */
const TONES: Record<OrderStatus, string> = {
  paid: "border-ayc-success text-ayc-success",
  pending: "border-ayc-warning text-ayc-warning",
  failed: "border-destructive text-destructive",
  expired: "border-ayc-slate text-ayc-slate",
  refunded: "border-ayc-slate text-ayc-slate",
};

// Its own paper background, so a row's hover colour never thins the text's contrast.
const TAG =
  "w-fit border-[1.5px] bg-ayc-paper px-1.5 py-1.25 font-mono text-[10px] leading-none font-bold";

/** An Order's status tag, "PAID", in its colour. */
export function OrderStatusTag({ status }: { status: OrderStatus }) {
  return <span className={cn(TAG, TONES[status])}>{orderStatusTag(status)}</span>;
}

/** A Paid Order's partial refund under its status, "PARTIALLY REFUNDED · ₱300" (ticket 09); nothing otherwise. */
export function PartialRefundNote({
  order,
}: {
  order: Pick<AdminOrder, "status" | "refundedCentavos">;
}) {
  const label = partialRefundLabel(order);
  return label ? (
    <span className="font-mono text-[10px] leading-tight font-bold text-ayc-slate">{label}</span>
  ) : null;
}

/** The TEST tag on a Test Order (story 151o). */
export function TestOrderTag() {
  return (
    <span
      title="A Test Order: PayMongo test payment, no real money"
      className={cn(TAG, "border-dashed border-ayc-blue text-ayc-blue")}
    >
      TEST
    </span>
  );
}
