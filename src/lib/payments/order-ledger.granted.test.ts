import { describe, expect, it } from "vitest";

import { passEndDate } from "@/lib/member-app/access";

import { endGrantedDays } from "./order-ledger";

// "End granted access" in the Order ledger (Phase 4, ticket 10; spec, Phase 4
// planning decisions → "End access now" once paid days exist; Testing
// Decisions → Phase 4 seams; story 151t), pure. Days stack as consecutive
// segments; ending takes off the granted days (grants and extensions) that
// fall after now, later paid segments move earlier by as much, and paid
// days, used or not, stay. With no paid days left the pass ends now; with no
// granted days left there's nothing to end.
//
// Every time here is 10:00 in Manila (02:00 UTC) unless it says otherwise.
const DAY = 24 * 60 * 60 * 1000;
const manila10 = (date: string) => `${date}T02:00:00.000Z`;
const plus = (iso: string, days: number) =>
  new Date(new Date(iso).getTime() + days * DAY).toISOString();

const ORDER = "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b";
const LATER_ORDER = "7c2e4a6b-8d1f-4e3a-9b5c-6d7e8f9a0b1c";

/** A history row's segment, keyed by its place, as an arm hands it over. */
const row = (key: number, orderId: string | null, startsAt: string, endsAt: string) => ({
  key,
  orderId,
  startsAt,
  endsAt,
});

// The spec's example: granted 30 days on 1 Jan (to 31 Jan), bought 90 days on
// 10 Jan (to 1 May), ended on 15 Jan.
const JAN_1 = manila10("2027-01-01");
const JAN_15 = new Date(manila10("2027-01-15"));
const GRANT = row(1, null, JAN_1, plus(JAN_1, 30));
const PAID = row(2, ORDER, plus(JAN_1, 30), plus(JAN_1, 120));

describe("endGrantedDays", () => {
  it("ends the spec's example on 15 Apr: 16 granted days go and the 90 paid days stay", () => {
    const ending = endGrantedDays([GRANT, PAID], PAID.endsAt, JAN_15);

    expect(ending).toEqual({
      kind: "keeps-paid",
      endsAt: manila10("2027-04-15"),
      moved: [
        { ...GRANT, endsAt: JAN_15.toISOString() },
        { ...PAID, startsAt: JAN_15.toISOString(), endsAt: manila10("2027-04-15") },
      ],
    });
    expect(ending.kind === "keeps-paid" && passEndDate(ending.endsAt)).toBe("15 Apr 2027");
  });

  it("ends a pass made only of grants now, as before", () => {
    const extension = row(2, null, GRANT.endsAt, plus(GRANT.endsAt, 7));

    expect(endGrantedDays([GRANT, extension], extension.endsAt, JAN_15)).toEqual({
      kind: "now",
      endsAt: JAN_15.toISOString(),
      moved: [
        { ...GRANT, endsAt: JAN_15.toISOString() },
        { ...extension, startsAt: JAN_15.toISOString(), endsAt: JAN_15.toISOString() },
      ],
    });
  });

  it("has nothing to end on a pass made only of paid days", () => {
    const paid = row(1, ORDER, JAN_1, plus(JAN_1, 90));

    expect(endGrantedDays([paid], paid.endsAt, JAN_15)).toEqual({ kind: "none" });
  });

  it("counts an extension as granted days", () => {
    // Bought 90 days on 1 Jan, then extended by 7 at their end.
    const paid = row(1, ORDER, JAN_1, plus(JAN_1, 90));
    const extension = row(2, null, paid.endsAt, plus(paid.endsAt, 7));

    expect(endGrantedDays([paid, extension], extension.endsAt, JAN_15)).toEqual({
      kind: "keeps-paid",
      endsAt: paid.endsAt,
      moved: [{ ...extension, endsAt: extension.startsAt }],
    });
  });

  it("takes the unused days of a grant before and a grant after a Paid Order, keeping the paid days", () => {
    // Granted 30 on 1 Jan, bought 90 at its end, granted 30 more after that.
    const after = row(3, null, PAID.endsAt, plus(PAID.endsAt, 30));

    expect(endGrantedDays([GRANT, PAID, after], after.endsAt, JAN_15)).toEqual({
      kind: "keeps-paid",
      endsAt: manila10("2027-04-15"),
      moved: [
        { ...GRANT, endsAt: JAN_15.toISOString() },
        { ...PAID, startsAt: JAN_15.toISOString(), endsAt: manila10("2027-04-15") },
        { ...after, startsAt: manila10("2027-04-15"), endsAt: manila10("2027-04-15") },
      ],
    });
  });

  it("keeps the paid days of two Orders either side of a grant", () => {
    const first = row(1, ORDER, JAN_1, plus(JAN_1, 30));
    const grant = row(2, null, first.endsAt, plus(first.endsAt, 30));
    const second = row(3, LATER_ORDER, grant.endsAt, plus(grant.endsAt, 30));

    expect(endGrantedDays([first, grant, second], second.endsAt, JAN_15)).toEqual({
      kind: "keeps-paid",
      endsAt: plus(first.endsAt, 30),
      moved: [
        { ...grant, endsAt: grant.startsAt },
        { ...second, startsAt: first.endsAt, endsAt: plus(first.endsAt, 30) },
      ],
    });
  });

  it("removes nothing of a grant already used up", () => {
    // Granted 7 on 1 Jan (used up by 8 Jan), then bought 90 on 8 Jan.
    const used = row(1, null, JAN_1, plus(JAN_1, 7));
    const paid = row(2, ORDER, used.endsAt, plus(used.endsAt, 90));

    expect(endGrantedDays([used, paid], paid.endsAt, JAN_15)).toEqual({ kind: "none" });
  });

  it("has nothing to end on a pass that has already expired, granted days or not", () => {
    expect(endGrantedDays([GRANT, PAID], PAID.endsAt, new Date(plus(PAID.endsAt, 1)))).toEqual({
      kind: "none",
    });
  });

  it('reads a pass an old "End access now" ended, whose rows still run past its end, as ended', () => {
    // Ticket 17 set the end to 10 Jan and left the grant's row running to 31 Jan.
    expect(endGrantedDays([GRANT], manila10("2027-01-10"), JAN_15)).toEqual({ kind: "none" });
  });

  it('ends a pass an old "End access now" ended and a later grant restarted, from the grant\'s row', () => {
    // Ended on 10 Jan; granted 30 again on 12 Jan, from then.
    const again = row(2, null, manila10("2027-01-12"), plus(manila10("2027-01-12"), 30));

    expect(endGrantedDays([GRANT, again], again.endsAt, JAN_15)).toEqual({
      kind: "now",
      endsAt: JAN_15.toISOString(),
      moved: [{ ...again, endsAt: JAN_15.toISOString() }],
    });
  });

  it("counts days no history row holds as granted: a pass from before the history was kept", () => {
    // A pass with no rows to 31 Jan, then bought 90 days at its end.
    const paid = row(1, ORDER, plus(JAN_1, 30), plus(JAN_1, 120));

    expect(endGrantedDays([], plus(JAN_1, 30), JAN_15)).toEqual({
      kind: "now",
      endsAt: JAN_15.toISOString(),
      moved: [],
    });
    expect(endGrantedDays([paid], paid.endsAt, JAN_15)).toEqual({
      kind: "keeps-paid",
      endsAt: manila10("2027-04-15"),
      moved: [{ ...paid, startsAt: JAN_15.toISOString(), endsAt: manila10("2027-04-15") }],
    });
  });

  it("dates the new end on its Manila day across midnight", () => {
    // Granted 30 days at 00:30 on 1 Jan in Manila (16:30 UTC on 31 Dec), bought
    // 90 at its end, ended at 00:30 on 15 Jan in Manila: the end is 00:30 on
    // 15 Apr in Manila, still 14 Apr in UTC.
    const start = "2026-12-31T16:30:00.000Z";
    const grant = row(1, null, start, plus(start, 30));
    const paid = row(2, ORDER, grant.endsAt, plus(start, 120));
    const now = new Date("2027-01-14T16:30:00.000Z");

    const ending = endGrantedDays([grant, paid], paid.endsAt, now);

    expect(ending).toMatchObject({ kind: "keeps-paid", endsAt: "2027-04-14T16:30:00.000Z" });
    expect(ending.kind === "keeps-paid" && passEndDate(ending.endsAt)).toBe("15 Apr 2027");
  });
});
