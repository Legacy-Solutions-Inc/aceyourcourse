"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { useUrlSearch } from "@/components/admin/use-url-search";
import { isOrderRange, ordersHref, RANGE_OPTIONS } from "@/lib/admin/orders-list";
import { isPaymentMethod, methodLabel, PAYMENT_METHODS } from "@/lib/payments/payment-methods";
import type { OrderListQuery } from "@/services/admin.types";

const SELECT =
  "min-h-10 w-full min-w-0 border-[1.5px] bg-white px-2.5 py-2 text-sm font-medium wide:w-40 wide:flex-none";

/**
 * The Orders list's search, Payment Method, range and "Include test orders"
 * (mockup 663–668; BUILD-MAP §3.9): each lives in the URL, so the server
 * filters the list and a reload or a shared link keeps it. The status chips
 * are links beside them. A change shows at once, while the server filters.
 */
export function OrderFilters({ query }: { query: OrderListQuery }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // The filters as last chosen, until the URL the server filtered by catches up.
  const [shown, setShown] = useOptimistic(query);
  const search = useUrlSearch(query.q, (q) => ordersHref({ ...query, q }));
  const go = (next: OrderListQuery) =>
    startTransition(() => {
      setShown(next);
      router.replace(ordersHref(next), { scroll: false });
    });

  return (
    <>
      <input
        type="search"
        aria-label="Search by order number or email"
        placeholder="Search by order number or email"
        {...search}
        className="min-h-10 w-full min-w-0 flex-[1_1_280px] border-[1.5px] bg-white px-3 py-2 text-sm font-medium placeholder:text-muted-foreground"
      />
      <select
        aria-label="Payment method"
        value={shown.method}
        onChange={(event) => {
          const method = event.target.value;
          go({ ...shown, method: isPaymentMethod(method) ? method : "all" });
        }}
        className={SELECT}
      >
        <option value="all">All methods</option>
        {PAYMENT_METHODS.map((method) => (
          <option key={method} value={method}>
            {methodLabel(method)}
          </option>
        ))}
      </select>
      <select
        aria-label="Date range"
        value={shown.range}
        onChange={(event) => {
          const range = event.target.value;
          go({ ...shown, range: isOrderRange(range) ? range : "30d" });
        }}
        className={SELECT}
      >
        {RANGE_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[13px] font-semibold">
        <input
          type="checkbox"
          checked={shown.tests}
          onChange={(event) => go({ ...shown, tests: event.target.checked })}
          className="size-4 accent-ayc-navy"
        />
        Include test orders
      </label>
    </>
  );
}
