import { describe, expect, it } from "vitest";

import type { SalesDay, SalesFigures } from "@/lib/payments/sales-figures";
import type { PaidToday, SalesOverview } from "@/services/admin.types";

import { paidTodayCard, salesChart, salesTiles } from "./sales-view";

// The Overview's sales as an Owner reads them (Phase 4, ticket 11; story 151;
// BUILD-MAP §3.1 and §2): the four tiles, the paid-sales chart and the
// sidebar's PAID TODAY card, pure.

/** A day's or month's money, in pesos: paid, refunded, and what was kept. */
const money = (paidPesos: number, refundedPesos = 0, netPesos = paidPesos) => ({
  paidCentavos: paidPesos * 100,
  refundedCentavos: refundedPesos * 100,
  netCentavos: netPesos * 100,
});

/** The 30 days to 25 Nov 2026, all ₱0 but the ones given. */
function days(given: Record<string, number> = {}): SalesDay[] {
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 9, 27 + index)).toISOString().slice(0, 10);
    return { date, ...money(given[date] ?? 0) };
  });
}

function figures(fields: Partial<SalesFigures> = {}): SalesFigures {
  return {
    today: { date: "2026-11-25", orders: 3, ...money(6_240) },
    yesterday: { date: "2026-11-24", ...money(5_120) },
    month: { month: "2026-11", ...money(184_620) },
    monthBefore: { from: "2026-10-01", to: "2026-10-25", ...money(156_458) },
    days: days(),
    ...fields,
  };
}

const sales = (fields: Partial<SalesFigures> = {}): SalesOverview => ({
  figures: figures(fields),
  activeMembers: 496,
  passesEndingSoon: 23,
  payments: {
    pending: 4,
    oldestPendingAt: null,
    invoicesToSend: 0,
    paidAfterExpiry: 0,
    paidAccountDeleted: 0,
    paidAlreadyOwned: 0,
  },
});

describe("salesTiles", () => {
  it("gives the four tiles, each linking to the Orders or the Users it counts", () => {
    expect(salesTiles(sales())).toEqual([
      {
        label: "PAID TODAY",
        value: "₱6,240",
        change: "+₱1,120 vs yesterday",
        trend: "up",
        refunded: "₱0 refunded",
        href: "/admin/orders?status=paid&range=7d",
      },
      {
        label: "PAID · NOVEMBER",
        value: "₱184,620",
        change: "+18% vs 1–25 Oct",
        trend: "up",
        refunded: "₱0 refunded",
        href: "/admin/orders?status=paid",
      },
      {
        label: "ACTIVE MEMBERS",
        value: "496",
        change: "Paid or granted access",
        trend: "none",
        refunded: null,
        href: "/admin/users?filter=active",
      },
      {
        label: "ACCESS ENDING · 7 DAYS",
        value: "23",
        change: "Nothing renews automatically",
        trend: "none",
        refunded: null,
        href: "/admin/users?filter=active",
      },
    ]);
  });

  it("shows what was refunded under a money tile, and the figure after it", () => {
    const [today, month] = salesTiles(
      sales({
        today: { date: "2026-11-25", orders: 1, ...money(1_299, 300, 999) },
        month: { month: "2026-11", ...money(10_000, 300, 9_700) },
      }),
    );

    expect(today).toMatchObject({ value: "₱999", refunded: "₱300 refunded" });
    expect(month).toMatchObject({ value: "₱9,700", refunded: "₱300 refunded" });
  });

  it("says a drop with a minus, and no change as the same", () => {
    const [down, monthDown] = salesTiles(
      sales({
        today: { date: "2026-11-25", orders: 1, ...money(499) },
        month: { month: "2026-11", ...money(50_000) },
        monthBefore: { from: "2026-10-01", to: "2026-10-25", ...money(81_000) },
      }),
    );
    expect(down).toMatchObject({ change: "−₱4,621 vs yesterday", trend: "down" });
    expect(monthDown).toMatchObject({ change: "−38% vs 1–25 Oct", trend: "down" });

    const [same, monthSame] = salesTiles(
      sales({
        today: { date: "2026-11-25", orders: 1, ...money(5_120) },
        month: { month: "2026-11", ...money(1_000) },
        monthBefore: { from: "2026-10-01", to: "2026-10-25", ...money(1_000) },
      }),
    );
    expect(same).toMatchObject({ change: "Same as yesterday", trend: "none" });
    expect(monthSame).toMatchObject({ change: "Same as 1–25 Oct", trend: "none" });
  });

  it("gives the month's change in pesos when last month's same days had nothing", () => {
    const [, month] = salesTiles(
      sales({
        month: { month: "2026-11", ...money(1_299) },
        monthBefore: { from: "2026-10-01", to: "2026-10-25", ...money(0) },
      }),
    );
    expect(month).toMatchObject({ change: "+₱1,299 vs 1–25 Oct", trend: "up" });
  });

  it("names a one-day comparison on the 1st, and last month's last day on the 31st", () => {
    const [, first] = salesTiles(
      sales({ monthBefore: { from: "2026-10-01", to: "2026-10-01", ...money(1_000) } }),
    );
    expect(first?.change).toMatch(/ vs 1 Oct$/);
    const [, last] = salesTiles(
      sales({
        month: { month: "2027-03", ...money(1_000) },
        monthBefore: { from: "2027-02-01", to: "2027-02-28", ...money(1_000) },
      }),
    );
    expect(last).toMatchObject({ label: "PAID · MARCH", change: "Same as 1–28 Feb" });
  });

  it("shows ₱0 with no Orders at all", () => {
    const [today, month] = salesTiles(
      sales({
        today: { date: "2026-11-25", orders: 0, ...money(0) },
        yesterday: { date: "2026-11-24", ...money(0) },
        month: { month: "2026-11", ...money(0) },
        monthBefore: { from: "2026-10-01", to: "2026-10-25", ...money(0) },
      }),
    );
    expect(today).toMatchObject({
      value: "₱0",
      change: "Same as yesterday",
      refunded: "₱0 refunded",
    });
    expect(month).toMatchObject({
      value: "₱0",
      change: "Same as 1–25 Oct",
      refunded: "₱0 refunded",
    });
  });
});

describe("salesChart", () => {
  it("gives the last 14 days' bars, today's last and highlighted, a day with no sales at ₱0", () => {
    const chart = salesChart(days({ "2026-11-12": 1_299, "2026-11-25": 6_240 }), 14);

    expect(chart.bars).toHaveLength(14);
    expect(chart.bars[0]).toEqual({
      date: "2026-11-12",
      label: "12 Nov",
      netCentavos: 129_900,
      amount: "₱1,299",
      today: false,
    });
    expect(chart.bars[1]).toMatchObject({ label: "13 Nov", netCentavos: 0, amount: "₱0" });
    expect(chart.bars.at(-1)).toEqual({
      date: "2026-11-25",
      label: "25 Nov",
      netCentavos: 624_000,
      amount: "₱6,240",
      today: true,
    });
    expect(chart.bars.filter((bar) => bar.today)).toHaveLength(1);
    expect(chart.summary).toBe("NET PAID · LAST 14 DAYS · ₱7,539");
    expect(chart.labelEvery).toBe(2);
  });

  it("gives all 30 days, leaving out none", () => {
    const chart = salesChart(days({ "2026-10-27": 499 }), 30);

    expect(chart.bars).toHaveLength(30);
    expect(chart.bars[0]).toMatchObject({ label: "27 Oct", amount: "₱499" });
    expect(chart.summary).toBe("NET PAID · LAST 30 DAYS · ₱499");
    expect(chart.labelEvery).toBe(5);
  });

  it("shows a day with more refunded than paid below ₱0", () => {
    const given = days();
    given[29] = { date: "2026-11-25", ...money(0, 499, -499) };

    expect(salesChart(given, 14).bars.at(-1)).toMatchObject({
      netCentavos: -49_900,
      amount: "−₱499",
    });
  });
});

describe("paidTodayCard", () => {
  const paid: PaidToday = { date: "2026-10-22", netCentavos: 624_000, orders: 9, pending: 4 };

  it("gives the date, today's money, the Orders paid and the Pending", () => {
    expect(paidTodayCard(paid)).toEqual({
      date: "22 OCT",
      amount: "₱6,240",
      orders: "9 orders",
      pending: "4 pending",
    });
  });

  it("says one Order, and ₱0 with nothing paid", () => {
    expect(paidTodayCard({ ...paid, orders: 1, pending: 0 })).toMatchObject({
      orders: "1 order",
      pending: "0 pending",
    });
    expect(paidTodayCard({ ...paid, netCentavos: 0, orders: 0, pending: 0 })).toMatchObject({
      amount: "₱0",
      orders: "0 orders",
    });
  });
});
