import { describe, expect, it } from "vitest";

import { passEndDate } from "@/lib/member-app/access";

import { applyOutcome, type Order, passSegments, removeUnusedDays } from "./order-ledger";

// Refunds in the Order ledger (Phase 4, ticket 09; spec, Phase 4 → Order
// ledger, "Revised 2026-11-24"; Phase 4 planning decisions → Refunds, "End
// access now" once paid days exist; Testing Decisions → Phase 4 seams), pure.
// A full refund moves a Paid Order to Refunded, never back; and the segment
// model takes the unused part of chosen segments off an Access Pass: days
// stack as consecutive segments, the part after now goes, later segments
// shift earlier by as much, and the end never moves before now.
// "Now" is 17 Nov 2026, 11:42 in Manila (03:42 UTC).
const NOW = new Date("2026-11-17T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number, from = NOW) => new Date(from.getTime() + days * DAY).toISOString();

const ORDER = "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b";
const OTHER_ORDER = "7c2e4a6b-8d1f-4e3a-9b5c-6d7e8f9a0b1c";

const PAID: Order = {
  id: ORDER,
  reference: "AYC-10001",
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  examCode: "CE",
  planId: "5d7c9e1a-3b2f-4a6d-9c8e-7f6a5b4c3d2e",
  planName: "CE All-Access",
  days: 30,
  priceCentavos: 49_900,
  method: "gcash",
  status: "paid",
  livemode: false,
  checkoutId: null,
  paymentId: "pay_FakePaid0001TestOnly",
  buyerName: "Bea Tester",
  buyerEmail: "tester@example.com",
  createdAt: inDays(-10),
  paidAt: inDays(-10),
  statusChangedAt: inDays(-10),
};

/** A history row's segment: whose days, from and until (days from now). */
const segment = (orderId: string | null, from: number, until: number, key = 0) => ({
  key,
  orderId,
  startsAt: inDays(from),
  endsAt: inDays(until),
});
const theOrder = (s: { orderId: string | null }) => s.orderId === ORDER;

describe("applyOutcome: Paid → Refunded (ticket 09)", () => {
  it("makes a Paid Order Refunded, keeping when it was paid; the pass is the segment model's", () => {
    expect(applyOutcome(PAID, "refunded", inDays(20), NOW)).toEqual({
      changed: true,
      order: { ...PAID, status: "refunded", statusChangedAt: NOW.toISOString() },
      paidDays: null,
    });
  });

  it("never makes a Refunded Order Paid again, even when a late paid event arrives", () => {
    const refunded: Order = { ...PAID, status: "refunded" };

    expect(applyOutcome(refunded, "paid", inDays(20), NOW)).toEqual({ changed: false });
    expect(applyOutcome(refunded, "refunded", inDays(20), NOW)).toEqual({ changed: false });
  });

  it.each(["pending", "failed", "expired"] as const)(
    "refunds nothing on a %s Order: it never granted days",
    (status) => {
      expect(applyOutcome({ ...PAID, status, paidAt: null }, "refunded", null, NOW)).toEqual({
        changed: false,
      });
    },
  );
});

describe("passSegments: a pass's history as it stands", () => {
  it("keeps stacked segments as they are", () => {
    const history = [segment(null, -5, 25, 1), segment(ORDER, 25, 55, 2)];

    expect(passSegments(history, inDays(55))).toEqual(history);
  });

  it("ends every segment at the pass's end after “End access now” (ticket 17 leaves the rows as they were)", () => {
    const history = [segment(null, -5, 25, 1), segment(ORDER, 25, 55, 2)];

    expect(passSegments(history, inDays(-1))).toEqual([
      segment(null, -5, -1, 1),
      segment(ORDER, -1, -1, 2),
    ]);
  });

  it("ends earlier segments where a later one starts: the pass had ended before it was added", () => {
    // Granted to +25, ended at -3 ("End access now"), then bought again at -2.
    const history = [segment(null, -5, 25, 1), segment(ORDER, -2, 28, 2)];

    expect(passSegments(history, inDays(28))).toEqual([
      segment(null, -5, -2, 1),
      segment(ORDER, -2, 28, 2),
    ]);
  });
});

describe("removeUnusedDays: a full refund takes off only that Order's unused days", () => {
  it("ends access now when the Member's only Order is refunded part-way through", () => {
    const history = [segment(ORDER, -10, 20)];

    expect(removeUnusedDays(history, inDays(20), theOrder, NOW)).toEqual({
      segments: [{ ...segment(ORDER, -10, 20), endsAt: NOW.toISOString() }],
      endsAt: NOW.toISOString(),
    });
  });

  it("takes off only the second of two stacked Orders, which hasn't started", () => {
    const first = segment(OTHER_ORDER, -10, 20, 1);
    const second = segment(ORDER, 20, 50, 2);

    expect(removeUnusedDays([first, second], inDays(50), theOrder, NOW)).toEqual({
      segments: [first, segment(ORDER, 20, 20, 2)],
      endsAt: inDays(20),
    });
  });

  it("takes off the rest of the first of two stacked Orders, and the second starts now", () => {
    const first = segment(ORDER, -10, 20, 1);
    const second = segment(OTHER_ORDER, 20, 110, 2);

    expect(removeUnusedDays([first, second], inDays(110), theOrder, NOW)).toEqual({
      segments: [segment(ORDER, -10, 0, 1), segment(OTHER_ORDER, 0, 90, 2)],
      endsAt: inDays(90),
    });
  });

  it("shifts a grant after the refunded Order earlier, keeping all its days", () => {
    const history = [segment(ORDER, -5, 25, 1), segment(null, 25, 55, 2)];

    expect(removeUnusedDays(history, inDays(55), theOrder, NOW)).toEqual({
      segments: [segment(ORDER, -5, 0, 1), segment(null, 0, 30, 2)],
      endsAt: inDays(30),
    });
  });

  it("never touches days from grants or other Orders around it", () => {
    const grant = segment(null, -40, -10, 1);
    const other = segment(OTHER_ORDER, -10, 20, 2);
    const refunded = segment(ORDER, 20, 50, 3);
    const extension = segment(null, 50, 57, 4);

    const { segments, endsAt } = removeUnusedDays(
      [grant, other, refunded, extension],
      inDays(57),
      theOrder,
      NOW,
    );

    expect(segments).toEqual([grant, other, segment(ORDER, 20, 20, 3), segment(null, 20, 27, 4)]);
    expect(endsAt).toBe(inDays(27));
  });

  it("takes nothing off an Order whose days are used up", () => {
    const history = [segment(ORDER, -40, -10, 1), segment(null, -5, 25, 2)];

    expect(removeUnusedDays(history, inDays(25), theOrder, NOW)).toEqual({
      segments: history,
      endsAt: inDays(25),
    });
  });

  it("never moves the end before now, nor moves an end that has already passed", () => {
    // "End access now" two days ago, with the Order's row still running to +20.
    const history = [segment(ORDER, -10, 20)];

    expect(removeUnusedDays(history, inDays(-2), theOrder, NOW)).toEqual({
      segments: [segment(ORDER, -10, -2)],
      endsAt: inDays(-2),
    });
  });

  it("leaves days the history doesn't hold, after it, and moves them earlier with the rest", () => {
    // A pass whose end is 5 days past its recorded history (none recorded for them).
    const history = [segment(ORDER, -10, 20)];

    expect(removeUnusedDays(history, inDays(25), theOrder, NOW).endsAt).toBe(inDays(5));
  });

  it("changes nothing with no history for the Order", () => {
    const history = [segment(null, -5, 25)];

    expect(removeUnusedDays(history, inDays(25), theOrder, NOW)).toEqual({
      segments: history,
      endsAt: inDays(25),
    });
  });

  it("keeps the end right across Manila midnight", () => {
    // Paid at 23:30 on 30 Nov in Manila for 30 days, then 7 granted days on
    // top; refunded at 00:30 on 1 Dec, an hour later. The 7 days now end at
    // 00:30 on 8 Dec in Manila, still 7 Dec in UTC.
    const paidAt = new Date("2026-11-30T15:30:00.000Z");
    const refundedAt = new Date("2026-11-30T16:30:00.000Z");
    const paidUntil = inDays(30, paidAt);
    const history = [
      { key: 1, orderId: ORDER, startsAt: paidAt.toISOString(), endsAt: paidUntil },
      { key: 2, orderId: null, startsAt: paidUntil, endsAt: inDays(37, paidAt) },
    ];

    const { segments, endsAt } = removeUnusedDays(
      history,
      inDays(37, paidAt),
      theOrder,
      refundedAt,
    );

    expect(segments[0]?.endsAt).toBe(refundedAt.toISOString());
    expect(endsAt).toBe("2026-12-07T16:30:00.000Z");
    expect(passEndDate(endsAt)).toBe("8 Dec 2026");
  });
});

describe("removeUnusedDays: the unused granted days (ticket 10's “End granted access” reuses it)", () => {
  it("granted 30 days on 1 Jan, bought 90 on 10 Jan, ended 15 Jan: access ends 15 Apr", () => {
    const at = (date: string) => new Date(`${date}T04:00:00.000Z`).toISOString();
    const history = [
      { key: 1, orderId: null, startsAt: at("2027-01-01"), endsAt: at("2027-01-31") },
      { key: 2, orderId: ORDER, startsAt: at("2027-01-31"), endsAt: at("2027-05-01") },
    ];

    const { segments, endsAt } = removeUnusedDays(
      history,
      at("2027-05-01"),
      (s) => s.orderId === null,
      new Date(at("2027-01-15")),
    );

    expect(segments).toEqual([
      { key: 1, orderId: null, startsAt: at("2027-01-01"), endsAt: at("2027-01-15") },
      { key: 2, orderId: ORDER, startsAt: at("2027-01-15"), endsAt: at("2027-04-15") },
    ]);
    expect(passEndDate(endsAt)).toBe("15 Apr 2027");
  });
});
