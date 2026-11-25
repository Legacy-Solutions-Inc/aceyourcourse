import { describe, expect, it } from "vitest";

import { passEndDate } from "@/lib/member-app/access";
import {
  EXTEND_DAYS,
  GRANT_DAYS,
  GRANT_MAX_DAYS,
  passWithDays,
} from "@/lib/member-app/access-pass";

// The Access Pass rule (CONTEXT.md → Access Pass; spec, Phase 3 → Grants and
// ending access): each grant extends the pass from its current end, or from
// now when it has ended or there is none; "End access now" sets the end to now.

const NOW = new Date("2026-11-19T04:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe("passWithDays", () => {
  it("adds the days to the current end of an active pass", () => {
    expect(passWithDays(at(10 * DAY), 30, NOW)).toEqual({
      startsAt: at(10 * DAY),
      endsAt: at(40 * DAY),
    });
  });

  it("starts from now for a pass that has ended, not from its old end", () => {
    expect(passWithDays(at(-3 * DAY), 30, NOW)).toEqual({
      startsAt: NOW.toISOString(),
      endsAt: at(30 * DAY),
    });
  });

  it("starts from now for a pass that ends this instant, which has ended", () => {
    expect(passWithDays(NOW.toISOString(), 7, NOW)).toEqual({
      startsAt: NOW.toISOString(),
      endsAt: at(7 * DAY),
    });
  });

  it("starts from now when there is no pass", () => {
    expect(passWithDays(null, 90, NOW)).toEqual({
      startsAt: NOW.toISOString(),
      endsAt: at(90 * DAY),
    });
  });

  it("adds whole days of 24 hours, keeping the time of day", () => {
    expect(passWithDays("2026-12-01T15:59:00.000Z", 3, NOW).endsAt).toBe(
      "2026-12-04T15:59:00.000Z",
    );
  });
});

describe("the days an Owner can give", () => {
  it("grants 30, 90, 180 or 365 days, or a custom number up to 365", () => {
    expect(GRANT_DAYS).toEqual([30, 90, 180, 365]);
    expect(GRANT_MAX_DAYS).toBe(365);
  });

  it("extends by 3, 7, 14 or 30 days", () => {
    expect(EXTEND_DAYS).toEqual([3, 7, 14, 30]);
  });
});

describe("the end date a grant shows, in Asia/Manila", () => {
  it("is the next day in Manila when a grant made just after Manila midnight ends", () => {
    // 00:30 on 20 Nov in Manila is still 19 Nov in UTC: 30 days on, 20 Dec in Manila.
    const justAfterMidnight = new Date("2026-11-19T16:30:00.000Z");
    const { endsAt } = passWithDays(null, 30, justAfterMidnight);
    expect(endsAt).toBe("2026-12-19T16:30:00.000Z");
    expect(passEndDate(endsAt)).toBe("20 Dec 2026");
  });

  it("is the same day in Manila when a grant made just before Manila midnight ends", () => {
    const justBeforeMidnight = new Date("2026-11-19T15:59:00.000Z");
    const { endsAt } = passWithDays(null, 30, justBeforeMidnight);
    expect(passEndDate(endsAt)).toBe("19 Dec 2026");
  });
});
