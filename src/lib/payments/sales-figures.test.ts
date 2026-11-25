import { describe, expect, it } from "vitest";

import {
  memberFigures,
  SALES_CHART_DAYS,
  salesFigures,
  salesSince,
  type SalesOrder,
} from "./sales-figures";

// The Overview's sales figures (Phase 4, ticket 11; stories 151 and 151w;
// spec, Phase 4 planning decisions → Orders and sales figures; Testing
// Decisions → Phase 4 seams, the Order ledger's sales figures), pure.
// "Now" is 10:00 on Wednesday 25 Nov 2026 in Manila (02:00 UTC).
const NOW = new Date("2026-11-25T02:00:00.000Z");

/** A live Order of `pesos`, paid at a Manila wall time ("2026-11-24 23:59"), with its refunds. */
function paid(
  pesos: number,
  manilaTime: string,
  fields: { livemode?: boolean; refunds?: SalesOrder["refunds"] } = {},
): SalesOrder {
  return {
    order: {
      livemode: fields.livemode ?? true,
      priceCentavos: pesos * 100,
      paidAt: manila(manilaTime),
    },
    refunds: fields.refunds ?? [],
  };
}

/** An ISO instant for a Manila wall time, "2026-11-24 23:59" → "2026-11-24T15:59:00.000Z". */
const manila = (time: string) => new Date(`${time.replace(" ", "T")}:00+08:00`).toISOString();

/** A succeeded refund of `pesos`, at a Manila wall time. */
const refund = (pesos: number, manilaTime: string) => ({
  amountCentavos: pesos * 100,
  status: "succeeded" as const,
  refundedAt: manila(manilaTime),
});

/** A day's or month's money, in pesos: paid, refunded, and what was kept. */
const money = (paidPesos: number, refundedPesos = 0, netPesos = paidPesos) => ({
  paidCentavos: paidPesos * 100,
  refundedCentavos: refundedPesos * 100,
  netCentavos: netPesos * 100,
});

describe("salesFigures: days are Manila days", () => {
  it("puts a payment at 23:59 and one at 00:01 in Manila on different days", () => {
    const figures = salesFigures(
      [paid(499, "2026-11-24 23:59"), paid(1_299, "2026-11-25 00:01")],
      NOW,
    );

    expect(figures.yesterday).toEqual({ date: "2026-11-24", ...money(499) });
    expect(figures.today).toEqual({ date: "2026-11-25", orders: 1, ...money(1_299) });
  });
});

describe("salesFigures: Test Orders never count", () => {
  it("leaves a Test Order out, and its refunds too", () => {
    const figures = salesFigures(
      [
        paid(499, "2026-11-25 09:00"),
        paid(1_299, "2026-11-25 09:30", {
          livemode: false,
          refunds: [refund(300, "2026-11-25 09:45")],
        }),
      ],
      NOW,
    );

    expect(figures.today).toEqual({ date: "2026-11-25", orders: 1, ...money(499) });
  });
});

describe("salesFigures: refunds come off on the day they happen", () => {
  it("takes a refund made today off today's figure, not the day it was paid", () => {
    const figures = salesFigures(
      [
        paid(1_299, "2026-11-24 14:00", { refunds: [refund(300, "2026-11-25 08:00")] }),
        paid(499, "2026-11-25 09:00"),
      ],
      NOW,
    );

    expect(figures.yesterday).toEqual({ date: "2026-11-24", ...money(1_299) });
    expect(figures.today).toEqual({ date: "2026-11-25", orders: 1, ...money(499, 300, 199) });
  });

  it("counts only succeeded refunds", () => {
    const figures = salesFigures(
      [
        paid(1_299, "2026-11-25 08:00", {
          refunds: [
            { amountCentavos: 30_000, status: "pending", refundedAt: null },
            { amountCentavos: 40_000, status: "failed", refundedAt: null },
          ],
        }),
      ],
      NOW,
    );

    expect(figures.today).toEqual({ date: "2026-11-25", orders: 1, ...money(1_299) });
  });

  it("goes below ₱0 on a day with more refunded than paid", () => {
    const figures = salesFigures(
      [paid(499, "2026-11-20 10:00", { refunds: [refund(499, "2026-11-25 07:00")] })],
      NOW,
    );

    expect(figures.today).toEqual({ date: "2026-11-25", orders: 0, ...money(0, 499, -499) });
  });
});

describe("salesFigures: this month so far, against the same days last month", () => {
  it("counts this month from its 1st in Manila, and last month's 1st to today's date", () => {
    const figures = salesFigures(
      [
        paid(229, "2026-10-01 00:00"),
        paid(499, "2026-10-25 23:59"),
        paid(1_299, "2026-10-26 00:00"), // after the 25th: not in the same days
        paid(749, "2026-10-31 23:59"),
        paid(449, "2026-11-01 00:01"),
        paid(1_299, "2026-11-25 09:00", { refunds: [refund(300, "2026-11-25 09:30")] }),
      ],
      NOW,
    );

    expect(figures.month).toEqual({ month: "2026-11", ...money(449 + 1_299, 300, 1_448) });
    expect(figures.monthBefore).toEqual({
      from: "2026-10-01",
      to: "2026-10-25",
      ...money(229 + 499),
    });
  });

  it("counts a refund this month of an Order paid last month against this month", () => {
    const figures = salesFigures(
      [paid(1_299, "2026-10-20 10:00", { refunds: [refund(1_299, "2026-11-02 10:00")] })],
      NOW,
    );

    expect(figures.month).toEqual({ month: "2026-11", ...money(0, 1_299, -1_299) });
    expect(figures.monthBefore).toEqual({ from: "2026-10-01", to: "2026-10-25", ...money(1_299) });
  });

  it("ends the same days at last month's end when it is shorter", () => {
    // 31 Mar 2027, against 1–28 Feb 2027.
    const figures = salesFigures(
      [paid(499, "2027-02-28 23:59"), paid(1_299, "2027-03-01 00:01")],
      new Date("2027-03-31T02:00:00.000Z"),
    );

    expect(figures.month).toEqual({ month: "2027-03", ...money(1_299) });
    expect(figures.monthBefore).toEqual({ from: "2027-02-01", to: "2027-02-28", ...money(499) });
  });

  it("goes back across the new year", () => {
    const figures = salesFigures(
      [paid(499, "2026-12-05 12:00")],
      new Date("2027-01-10T02:00:00.000Z"),
    );

    expect(figures.month).toEqual({ month: "2027-01", ...money(0) });
    expect(figures.monthBefore).toEqual({ from: "2026-12-01", to: "2026-12-10", ...money(499) });
  });
});

describe("salesFigures: the chart's days", () => {
  it("gives the last 30 Manila days, oldest first and today last, a day with no sales at ₱0", () => {
    const { days } = salesFigures(
      [
        paid(499, "2026-10-26 23:59"), // the day before the 30
        paid(1_299, "2026-10-27 00:00"),
        paid(449, "2026-11-23 18:00", { refunds: [refund(449, "2026-11-25 08:00")] }),
        paid(749, "2026-11-25 09:00"),
      ],
      NOW,
    );

    expect(days).toHaveLength(SALES_CHART_DAYS);
    expect(days[0]).toEqual({ date: "2026-10-27", ...money(1_299) });
    expect(days[1]).toEqual({ date: "2026-10-28", ...money(0) });
    expect(days.slice(-3)).toEqual([
      { date: "2026-11-23", ...money(449) },
      { date: "2026-11-24", ...money(0) },
      { date: "2026-11-25", ...money(749, 449, 300) },
    ]);
  });
});

describe("salesFigures: with no Orders at all", () => {
  it("gives ₱0 everywhere", () => {
    const figures = salesFigures([], NOW);

    expect(figures.today).toEqual({ date: "2026-11-25", orders: 0, ...money(0) });
    expect(figures.yesterday).toEqual({ date: "2026-11-24", ...money(0) });
    expect(figures.month).toEqual({ month: "2026-11", ...money(0) });
    expect(figures.monthBefore).toEqual({ from: "2026-10-01", to: "2026-10-25", ...money(0) });
    expect(figures.days).toHaveLength(30);
    expect(figures.days.every((day) => day.netCentavos === 0)).toBe(true);
  });
});

describe("salesSince: the earliest instant the figures count", () => {
  it("is midnight in Manila on last month's 1st, when the 30 days start later", () => {
    expect(salesSince(NOW).toISOString()).toBe("2026-09-30T16:00:00.000Z");
  });

  it("is the 30 days' first midnight, when it comes before last month's 1st", () => {
    // 1 Mar 2027: the 30 days start on 31 Jan, before 1 Feb.
    expect(salesSince(new Date("2027-03-01T02:00:00.000Z")).toISOString()).toBe(
      "2027-01-30T16:00:00.000Z",
    );
  });
});

describe("memberFigures: active Members and Access Passes ending soon", () => {
  const HOUR = 60 * 60 * 1000;
  const inHours = (hours: number) => new Date(NOW.getTime() + hours * HOUR).toISOString();
  const BEA = "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21";
  const PAOLO = "2a4c6e80-1b3d-4f5a-9c7e-0d2f4a6b8c1e";
  const LOU = "5e1d3c7b-9a2f-4e6d-8c1b-3a5f7e9d2c4b";
  const OWNER = "0c9e8d7f-6a5b-4c3d-9e2f-1a0b9c8d7e6f";

  it("counts each Member with an active pass once, paid or granted, and leaves Staff out", () => {
    const figures = memberFigures(
      [
        { userId: BEA, endsAt: inHours(24 * 60), staff: false },
        { userId: BEA, endsAt: inHours(24 * 3), staff: false }, // a second Exam's pass
        { userId: PAOLO, endsAt: inHours(1), staff: false },
        { userId: LOU, endsAt: inHours(-1), staff: false }, // ended an hour ago
        { userId: OWNER, endsAt: inHours(24 * 90), staff: true },
      ],
      NOW,
    );

    expect(figures.activeMembers).toBe(2);
  });

  it("counts the passes ending in the next 7 days, not ended ones nor Staff's", () => {
    const figures = memberFigures(
      [
        { userId: BEA, endsAt: inHours(24 * 60), staff: false },
        { userId: BEA, endsAt: inHours(24 * 3), staff: false },
        { userId: PAOLO, endsAt: inHours(24 * 7), staff: false }, // 7 days to the minute
        { userId: LOU, endsAt: inHours(24 * 7 + 1), staff: false },
        { userId: LOU, endsAt: inHours(-1), staff: false },
        { userId: OWNER, endsAt: inHours(24), staff: true },
      ],
      NOW,
    );

    expect(figures.passesEndingSoon).toBe(2);
  });

  it("gives none without passes", () => {
    expect(memberFigures([], NOW)).toEqual({ activeMembers: 0, passesEndingSoon: 0 });
  });
});
