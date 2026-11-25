import { MAX_QUERY_LENGTH } from "@/lib/catalogue/product-filters";
import { addCalendarDays, manilaDate, manilaDayStart } from "@/lib/manila-time";
import { invoiceStatus } from "@/lib/payments/invoice-requests";
import { isPaymentMethod } from "@/lib/payments/payment-methods";
import { paths } from "@/paths";
import {
  type AdminOrder,
  ORDER_RANGES,
  ORDER_STATUS_FILTERS,
  type OrderListQuery,
  type OrderRange,
  type OrderStats,
  type OrderStatusFilter,
} from "@/services/admin.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Orders list's URL, filters and tiles (Phase 4, ticket 07; story 147;
// BUILD-MAP §3.9), pure, so both arms of the Admin seam filter the same way.
//
// - The URL holds the search and filters, so a reload or a shared link keeps
//   them: ?q=10482&status=paid&method=gcash&range=7d&tests=1&invoice=requested.
//   Anything it doesn't know falls back to its default, and the defaults are
//   left out.
// - "Search by order number or email": part of the reference or of the
//   buyer's email, ignoring case.
// - The status is the one every screen shows: a Pending Order past its 24
//   hours is Expired (the Order ledger's effectiveStatus).
// - The range is on Manila days: "Last 7 days" starts at midnight in Manila
//   six days before today, so it holds today and the 6 days before it.
// - Test Orders (PayMongo's livemode false) are left out unless "Include test
//   orders" is ticked.
// - "Invoice requested" (ticket 08) keeps only the Orders whose official
//   invoice was requested and isn't marked sent yet: the ones to send.
// - The tiles count the Orders the filters match.
// ─────────────────────────────────────────────────────────────────────────────

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The Orders list as it opens: no search, any status, every method, the last
 * 30 days, no Test Orders, and every Order whatever its Invoice Request.
 */
export const DEFAULT_ORDER_QUERY: OrderListQuery = {
  q: null,
  status: "any",
  method: "all",
  range: "30d",
  tests: false,
  invoiceRequested: false,
};

/** How many Manila days each range holds, today included. */
const RANGE_DAYS: Record<Exclude<OrderRange, "all">, number> = { "7d": 7, "30d": 30 };

const RANGE_LABELS: Record<OrderRange, string> = {
  "7d": "LAST 7 DAYS",
  "30d": "LAST 30 DAYS",
  all: "ALL TIME",
};

/** The "Invoice requested" filter's value in the URL: ?invoice=requested. */
const INVOICE_REQUESTED = "requested";

const isStatusFilter = (value: string): value is OrderStatusFilter =>
  (ORDER_STATUS_FILTERS as readonly string[]).includes(value);

/** Pure: whether a value from the URL or a form is one of the ranges. */
export const isOrderRange = (value: string): value is OrderRange =>
  (ORDER_RANGES as readonly string[]).includes(value);

/** Pure: the Orders list's search and filters, from its URL's search params. */
export function parseOrdersParams(params: SearchParams): OrderListQuery {
  const value = (key: string) => {
    const raw = params[key];
    return (Array.isArray(raw) ? raw[0] : raw) ?? "";
  };
  const status = value("status").toLowerCase();
  const method = value("method").toLowerCase();
  const range = value("range").toLowerCase();
  return {
    q: value("q").trim().slice(0, MAX_QUERY_LENGTH) || null,
    status: isStatusFilter(status) ? status : DEFAULT_ORDER_QUERY.status,
    method: isPaymentMethod(method) ? method : DEFAULT_ORDER_QUERY.method,
    range: isOrderRange(range) ? range : DEFAULT_ORDER_QUERY.range,
    tests: value("tests") === "1",
    invoiceRequested: value("invoice").toLowerCase() === INVOICE_REQUESTED,
  };
}

/** Pure: the search params for a query, leaving the defaults out. */
function searchOf({ q, status, method, range, tests, invoiceRequested }: OrderListQuery): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== DEFAULT_ORDER_QUERY.status) params.set("status", status);
  if (method !== DEFAULT_ORDER_QUERY.method) params.set("method", method);
  if (range !== DEFAULT_ORDER_QUERY.range) params.set("range", range);
  if (tests) params.set("tests", "1");
  if (invoiceRequested) params.set("invoice", INVOICE_REQUESTED);
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** Pure: the Orders list's address for a search and filters. */
export const ordersHref = (query: OrderListQuery): string =>
  `${paths.admin.orders}${searchOf(query)}`;

/** Pure: the CSV export's address for the list's search and filters: it holds exactly those Orders. */
export const ordersExportHref = (query: OrderListQuery): string =>
  `${paths.admin.ordersExport}${searchOf(query)}`;

/**
 * Pure: the instant a range starts at `now`: midnight in Manila on its first
 * day, today counting as one of its days; null for all time.
 */
export function rangeStart(range: OrderRange, now: Date): Date | null {
  if (range === "all") return null;
  return manilaDayStart(addCalendarDays(manilaDate(now), 1 - RANGE_DAYS[range]));
}

/** Pure: whether an Order holds the search, in its reference or its buyer's email, ignoring case. */
function matchesSearch({ reference, buyerEmail }: AdminOrder, q: string | null): boolean {
  if (q === null) return true;
  const wanted = q.toLowerCase();
  return reference.toLowerCase().includes(wanted) || buyerEmail.toLowerCase().includes(wanted);
}

/** Pure: whether an Order's official invoice was requested and isn't marked sent yet. */
export const invoiceToSend = ({ invoice }: Pick<AdminOrder, "invoice">): boolean =>
  invoice !== null && invoiceStatus(invoice) === "requested";

/** Pure: newest Order first; Orders made together by reference, the later first. */
export const newestOrderFirst = (
  a: Pick<AdminOrder, "createdAt" | "reference">,
  b: Pick<AdminOrder, "createdAt" | "reference">,
) => b.createdAt.localeCompare(a.createdAt) || b.reference.localeCompare(a.reference);

/** Pure: the Orders a query matches at `now`, newest first. */
export function filterOrders(
  orders: readonly AdminOrder[],
  query: OrderListQuery,
  now: Date,
): AdminOrder[] {
  const since = rangeStart(query.range, now);
  return orders
    .filter(
      (order) =>
        (query.tests || order.livemode) &&
        (query.status === "any" || order.status === query.status) &&
        (query.method === "all" || order.method === query.method) &&
        (since === null || new Date(order.createdAt) >= since) &&
        (!query.invoiceRequested || invoiceToSend(order)) &&
        matchesSearch(order, query.q),
    )
    .sort(newestOrderFirst);
}

/** Pure: the tiles for the Orders shown: the Paid ones' amounts, and the Orders, Pending and Failed. */
export function orderStats(rows: readonly AdminOrder[]): OrderStats {
  const withStatus = (status: AdminOrder["status"]) => rows.filter((row) => row.status === status);
  return {
    paidCentavos: withStatus("paid").reduce((sum, row) => sum + row.priceCentavos, 0),
    orders: rows.length,
    pending: withStatus("pending").length,
    failed: withStatus("failed").length,
  };
}

/** Pure: the Paid tile's label, naming the range: "PAID · LAST 30 DAYS". */
export const paidTileLabel = (range: OrderRange): string => `PAID · ${RANGE_LABELS[range]}`;

/** Pure: a range as the range select names it. */
export const RANGE_OPTIONS: readonly { value: OrderRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];
