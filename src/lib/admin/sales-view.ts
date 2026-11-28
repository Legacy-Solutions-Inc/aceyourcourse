import { DEFAULT_ORDER_QUERY, ordersHref } from "@/lib/admin/orders-list";
import { dayMonth, daySpan } from "@/lib/admin/promo-status";
import { userListHref } from "@/lib/admin/users-list";
import { formatPeso } from "@/lib/money";
import { ENDING_SOON_DAYS, type MoneyFigure, type SalesDay } from "@/lib/payments/sales-figures";
import type { PaidToday, SalesOverview } from "@/services/admin.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Overview's sales as an Owner reads them (Phase 4, ticket 11; story 151;
// BUILD-MAP §3.1 and §2), pure: the four tiles, the paid-sales chart and the
// sidebar's PAID TODAY card. The figures themselves are the seam's
// (src/lib/payments/sales-figures.ts); this only words them.
//
// - A money tile shows what was kept (paid less refunded), with "₱X
//   refunded" under it, ₱0 too, as the spec has each money tile say.
// - Today is set against all of yesterday; this month so far against the
//   same days of last month, as a percentage ("+18% vs 1–25 Oct"), or in
//   pesos when those days had nothing to compare with.
// - Each tile opens the screen behind its figure: the Paid Orders (the last 7
//   days for today, the Orders list's last 30 for the month), or the Users
//   list's Members with an active Access Pass.
// - The chart shows the last 14 days (the default, as the mockup) or 30, one
//   bar a day, today's last and highlighted; a day with no sales is ₱0.
// ─────────────────────────────────────────────────────────────────────────────

/** Which way a tile's change went: its line is green up, amber down, plain otherwise. */
export type SalesTrend = "up" | "down" | "none";

/** One KPI tile. */
export interface SalesTile {
  label: string;
  value: string;
  /** The line under the figure: its change, or what it counts. */
  change: string;
  trend: SalesTrend;
  /** "₱300 refunded" under a money tile, "₱0 refunded" too; null under the Member tiles. */
  refunded: string | null;
  href: string;
}

/** The chart's ranges, in days: the last 14 (the default, as the mockup) or the last 30. */
export const SALES_CHART_RANGES = [14, 30] as const;
export type SalesChartRange = (typeof SALES_CHART_RANGES)[number];
export const DEFAULT_SALES_CHART_RANGE: SalesChartRange = 14;

/** How many bars each day label under the chart covers: every 2nd day of 14, every 5th of 30. */
const LABEL_EVERY: Record<SalesChartRange, number> = { 14: 2, 30: 5 };

/** One day's bar. */
export interface SalesBar {
  date: string;
  /** "25 Nov". */
  label: string;
  netCentavos: number;
  /** The day's money as the tooltip and the table say it: "₱6,240", "−₱499". */
  amount: string;
  today: boolean;
}

/** Pure: pesos with a true minus sign below ₱0: "₱6,240", "−₱499". */
const pesos = (centavos: number) =>
  centavos < 0 ? `−${formatPeso(-centavos)}` : formatPeso(centavos);

/** Pure: a change in pesos, signed: "+₱1,120", "−₱300". */
const signedPesos = (centavos: number) => (centavos > 0 ? `+${pesos(centavos)}` : pesos(centavos));

/** Pure: "₱300 refunded", "₱0 refunded". */
const refundedOf = ({ refundedCentavos }: MoneyFigure) =>
  `${formatPeso(refundedCentavos)} refunded`;

/** Pure: a change's line and which way it went. */
const changed = (difference: number, line: string): Pick<SalesTile, "change" | "trend"> => ({
  change: line,
  trend: difference > 0 ? "up" : difference < 0 ? "down" : "none",
});

/** Pure: "+₱1,120 vs yesterday", "−₱300 vs yesterday", or "Same as yesterday". */
function changeVs(now: MoneyFigure, before: MoneyFigure, against: string) {
  const difference = now.netCentavos - before.netCentavos;
  return changed(
    difference,
    difference === 0 ? `Same as ${against}` : `${signedPesos(difference)} vs ${against}`,
  );
}

/** Pure: "+18% vs 1–25 Oct"; in pesos when those days had nothing to compare with. */
function percentVs(now: MoneyFigure, before: MoneyFigure, against: string) {
  if (before.netCentavos <= 0) return changeVs(now, before, against);
  const percent = Math.round(((now.netCentavos - before.netCentavos) / before.netCentavos) * 100);
  if (percent === 0) return changed(0, `Same as ${against}`);
  return changed(percent, `${percent > 0 ? "+" : "−"}${Math.abs(percent)}% vs ${against}`);
}

const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

/** Pure: "PAID · NOVEMBER", for a YYYY-MM month. */
const monthLabel = (month: string) =>
  `PAID · ${monthName.format(new Date(`${month}-01T00:00:00Z`)).toUpperCase()}`;

/** The Users list's Members with an active Access Pass. */
const ACTIVE_MEMBERS_HREF = userListHref({ q: null, filter: "active", page: 1 });

/** Pure: the Overview's four KPI tiles. */
export function salesTiles({
  figures,
  activeMembers,
  passesEndingSoon,
}: SalesOverview): SalesTile[] {
  const { today, yesterday, month, monthBefore } = figures;
  return [
    {
      label: "PAID TODAY",
      value: pesos(today.netCentavos),
      ...changeVs(today, yesterday, "yesterday"),
      refunded: refundedOf(today),
      href: ordersHref({ ...DEFAULT_ORDER_QUERY, status: "paid", range: "7d" }),
    },
    {
      label: monthLabel(month.month),
      value: pesos(month.netCentavos),
      ...percentVs(month, monthBefore, daySpan(monthBefore.from, monthBefore.to)),
      refunded: refundedOf(month),
      href: ordersHref({ ...DEFAULT_ORDER_QUERY, status: "paid" }),
    },
    {
      label: "ACTIVE MEMBERS",
      value: activeMembers.toLocaleString("en-PH"),
      change: "Paid or granted access",
      trend: "none",
      refunded: null,
      href: ACTIVE_MEMBERS_HREF,
    },
    {
      label: `ACCESS ENDING · ${ENDING_SOON_DAYS} DAYS`,
      value: passesEndingSoon.toLocaleString("en-PH"),
      change: "Nothing renews automatically",
      trend: "none",
      refunded: null,
      href: ACTIVE_MEMBERS_HREF,
    },
  ];
}

/**
 * Pure: the chart's bars over the last `range` days, today's last, its
 * summary line, and how many bars each day label covers.
 */
export function salesChart(
  days: readonly SalesDay[],
  range: SalesChartRange,
): { bars: SalesBar[]; summary: string; labelEvery: number } {
  const shown = days.slice(-range);
  const last = shown.length - 1;
  const bars = shown.map(({ date, netCentavos }, index) => ({
    date,
    label: dayMonth(date),
    netCentavos,
    amount: pesos(netCentavos),
    today: index === last,
  }));
  const total = shown.reduce((sum, { netCentavos }) => sum + netCentavos, 0);
  return {
    bars,
    summary: `NET PAID · LAST ${range} DAYS · ${pesos(total)}`,
    labelEvery: LABEL_EVERY[range],
  };
}

/** Pure: the sidebar's PAID TODAY card's words: "22 OCT", "₱6,240", "9 orders", "4 pending". */
export function paidTodayCard({ date, netCentavos, orders, pending }: PaidToday) {
  return {
    date: dayMonth(date).toUpperCase(),
    amount: pesos(netCentavos),
    orders: `${orders} ${orders === 1 ? "order" : "orders"}`,
    pending: `${pending} pending`,
  };
}
