import { addCalendarDays, manilaDate, manilaDayStart } from "@/lib/manila-time";
import { isPassActive } from "@/lib/member-app/access";
import type { Order } from "@/lib/payments/order-ledger";
import type { PaymentRefund } from "@/lib/payments/refunds";

// ─────────────────────────────────────────────────────────────────────────────
// The Overview's sales figures (Phase 4, ticket 11; stories 151 and 151w;
// spec, Phase 4 planning decisions → Orders and sales figures), pure, so
// both arms of the Admin seam count the same way. Owners only: the seam
// gives an Editor none of it.
//
// - Days and months are Manila days and months, whatever the server's time
//   zone: a payment at 23:59 and one at 00:01 land on different days.
// - A paid amount counts on its paid day, the Order's full price.
// - A refund is subtracted on the day PayMongo made it, not the day the Order
//   was paid: a day can show less than ₱0. Only succeeded refunds count, as
//   everywhere (refunds.ts).
// - Test Orders (PayMongo's livemode false) never count, nor their refunds.
// - This month so far is set against the same days of last month (1–25 Oct
//   on 25 Nov), ending at last month's end when it is shorter (1–28 Feb on
//   31 Mar): a fair comparison on any day of the month (the user's choice).
// - The chart's days are the last 30 Manila days, today last; a day with no
//   sales is ₱0. The Overview shows the last 14 or all 30.
// - Active Members: Members with at least one active Access Pass, paid or
//   granted, Staff excluded (Staff open everything without one). Access
//   Passes ending soon: the active ones ending within the next 7 days,
//   Staff's left out too, as they never see a renew prompt.
// ─────────────────────────────────────────────────────────────────────────────

/** An Order as the figures count it, with its PayMongo refunds. */
export interface SalesOrder {
  order: Pick<Order, "livemode" | "priceCentavos" | "paidAt">;
  refunds: readonly Pick<PaymentRefund, "amountCentavos" | "status" | "refundedAt">[];
}

/** Money over a day or a month, in centavos. */
export interface MoneyFigure {
  paidCentavos: number;
  refundedCentavos: number;
  /** What the business kept: paid less refunded. */
  netCentavos: number;
}

/** One Manila day's money. */
export interface SalesDay extends MoneyFigure {
  /** The Manila date, YYYY-MM-DD. */
  date: string;
}

/** How many Manila days the chart can show, today included. */
export const SALES_CHART_DAYS = 30;

export interface SalesFigures {
  /** Today so far, with the number of Orders paid today. */
  today: SalesDay & { orders: number };
  yesterday: SalesDay;
  /** This month so far; `month` is YYYY-MM. */
  month: MoneyFigure & { month: string };
  /** The same days of last month, from its 1st to `to` (YYYY-MM-DD). */
  monthBefore: MoneyFigure & { from: string; to: string };
  /** The last SALES_CHART_DAYS Manila days, oldest first, today last. */
  days: SalesDay[];
}

/** What happened on one Manila day: amounts paid, amounts refunded, and Orders paid. */
interface DayTotals {
  paid: number;
  refunded: number;
  orders: number;
}

/** Pure: each Manila day's totals. */
function dayTotals(orders: readonly SalesOrder[]): Map<string, DayTotals> {
  const days = new Map<string, DayTotals>();
  const on = (instant: string) => {
    const date = manilaDate(new Date(instant));
    const totals = days.get(date) ?? { paid: 0, refunded: 0, orders: 0 };
    days.set(date, totals);
    return totals;
  };
  for (const { order, refunds } of orders) {
    if (!order.livemode) continue;
    if (order.paidAt !== null) {
      const totals = on(order.paidAt);
      totals.paid += order.priceCentavos;
      totals.orders += 1;
    }
    for (const { status, amountCentavos, refundedAt } of refunds) {
      if (status === "succeeded" && refundedAt !== null) on(refundedAt).refunded += amountCentavos;
    }
  }
  return days;
}

/** Pure: money from totals. */
const moneyOf = ({ paid, refunded }: Pick<DayTotals, "paid" | "refunded">): MoneyFigure => ({
  paidCentavos: paid,
  refundedCentavos: refunded,
  netCentavos: paid - refunded,
});

const NONE: DayTotals = { paid: 0, refunded: 0, orders: 0 };

/**
 * Pure: the same days of last month as a YYYY-MM-DD date's month so far:
 * its 1st to the same day of the month, or to its last day when it's shorter.
 */
function sameDaysLastMonth(date: string): { from: string; to: string } {
  const lastDay = addCalendarDays(`${date.slice(0, 7)}-01`, -1);
  const sameDay = `${lastDay.slice(0, 8)}${date.slice(8)}`;
  return { from: `${lastDay.slice(0, 7)}-01`, to: sameDay < lastDay ? sameDay : lastDay };
}

/** Pure: the YYYY-MM-DD dates the figures count at `now`, from the earliest: the chart's first day and last month's 1st. */
function countedDates(now: Date) {
  const today = manilaDate(now);
  const chartStart = addCalendarDays(today, 1 - SALES_CHART_DAYS);
  const { from } = sameDaysLastMonth(today);
  return { today, chartStart, earliest: chartStart < from ? chartStart : from };
}

/**
 * Pure: the earliest instant the figures at `now` count a payment or refund
 * from: midnight in Manila on the chart's first day or last month's 1st,
 * whichever comes first. An arm reads only what happened since.
 */
export const salesSince = (now: Date): Date => manilaDayStart(countedDates(now).earliest);

/** Pure: the sales figures at `now`. */
export function salesFigures(orders: readonly SalesOrder[], now: Date): SalesFigures {
  const days = dayTotals(orders);
  const { today, chartStart } = countedDates(now);
  const yesterday = addCalendarDays(today, -1);
  const totalsOn = (date: string) => days.get(date) ?? NONE;
  const between = (from: string, to: string) => {
    const sum = { paid: 0, refunded: 0 };
    for (const [date, totals] of days) {
      if (date < from || date > to) continue;
      sum.paid += totals.paid;
      sum.refunded += totals.refunded;
    }
    return moneyOf(sum);
  };
  const before = sameDaysLastMonth(today);
  return {
    today: { date: today, orders: totalsOn(today).orders, ...moneyOf(totalsOn(today)) },
    yesterday: { date: yesterday, ...moneyOf(totalsOn(yesterday)) },
    month: { month: today.slice(0, 7), ...between(`${today.slice(0, 7)}-01`, today) },
    monthBefore: { ...before, ...between(before.from, before.to) },
    days: Array.from({ length: SALES_CHART_DAYS }, (_, index) => {
      const date = addCalendarDays(chartStart, index);
      return { date, ...moneyOf(totalsOn(date)) };
    }),
  };
}

/** An Access Pass as the Member figures count it. */
export interface PassHolding {
  userId: string;
  endsAt: string;
  /** Whether its holder is active Staff. */
  staff: boolean;
}

/** A pass ending within this many days of now is ending soon. */
export const ENDING_SOON_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure: the Members with an active Access Pass, and the passes ending soon, at `now`; Staff left out. */
export function memberFigures(
  passes: readonly PassHolding[],
  now: Date,
): { activeMembers: number; passesEndingSoon: number } {
  const active = passes.filter(({ endsAt, staff }) => !staff && isPassActive(endsAt, now));
  const soon = now.getTime() + ENDING_SOON_DAYS * DAY_MS;
  return {
    activeMembers: new Set(active.map(({ userId }) => userId)).size,
    passesEndingSoon: active.filter(({ endsAt }) => new Date(endsAt).getTime() <= soon).length,
  };
}
