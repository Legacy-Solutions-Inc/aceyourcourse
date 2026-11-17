import { describe, expect, it } from "vitest";

import { countdownLabel, examCountdown, isPastExamDate, resolveExamDate } from "./exam-date";

// A Target Exam's Exam Date and its countdown (spec, Phase 3 → Target Exams;
// stories 84–88). The date is the Member's own once they edit it, and the
// Exam's Official Exam Date until then. Days left are Asia/Manila calendar
// days, whatever the server's clock zone: Manila is UTC+8, so its midnight is
// 16:00 UTC the day before.
describe("resolveExamDate", () => {
  it("follows the Official Exam Date while the Member has set none", () => {
    expect(resolveExamDate({ memberDate: null, officialDate: "2026-11-21" })).toEqual({
      date: "2026-11-21",
      setBy: "official",
    });
  });

  it("keeps the Member's own date once they set one, whatever the official one is", () => {
    expect(resolveExamDate({ memberDate: "2027-04-18", officialDate: "2026-11-21" })).toEqual({
      date: "2027-04-18",
      setBy: "member",
    });
    expect(resolveExamDate({ memberDate: "2027-04-18", officialDate: null })).toEqual({
      date: "2027-04-18",
      setBy: "member",
    });
  });

  it("has no date when neither is set", () => {
    expect(resolveExamDate({ memberDate: null, officialDate: null })).toBeNull();
  });
});

describe("examCountdown", () => {
  it.each([
    // 15:59 UTC on 20 Nov is 23:59 on 20 Nov in Manila: one day to go.
    ["just before Manila midnight", "2026-11-20T15:59:59.999Z", { kind: "days", days: 1 }],
    // 16:00 UTC on 20 Nov is 00:00 on 21 Nov in Manila: the day itself.
    ["just after Manila midnight", "2026-11-20T16:00:00.000Z", { kind: "exam-day" }],
    ["late on the day in Manila", "2026-11-21T15:59:59.999Z", { kind: "exam-day" }],
    ["the day after, in Manila", "2026-11-21T16:00:00.000Z", { kind: "passed" }],
    ["long after", "2027-03-01T00:00:00.000Z", { kind: "passed" }],
    ["a week before", "2026-11-14T02:00:00.000Z", { kind: "days", days: 7 }],
    ["across a month end", "2026-10-31T16:00:00.000Z", { kind: "days", days: 20 }],
    ["across a year end and a leap day", "2023-12-31T15:00:00.000Z", { kind: "days", days: 1056 }],
  ] as const)("counts Manila calendar days to 21 Nov 2026 %s", (_when, now, expected) => {
    expect(examCountdown("2026-11-21", new Date(now))).toEqual(expected);
  });

  it("has nothing to count without a date", () => {
    expect(examCountdown(null, new Date("2026-11-17T00:00:00.000Z"))).toEqual({ kind: "no-date" });
  });
});

describe("countdownLabel", () => {
  it.each([
    [{ kind: "days", days: 4 }, "4 days to the exam"],
    [{ kind: "days", days: 1 }, "1 day to the exam"],
    [{ kind: "exam-day" }, "Exam day"],
    [{ kind: "passed" }, "Exam passed. Update your date in Account."],
    [{ kind: "no-date" }, "No exam date yet. Set one in Account."],
  ] as const)("reads %j as %j", (countdown, label) => {
    expect(countdownLabel(countdown)).toBe(label);
  });
});

describe("isPastExamDate", () => {
  it.each([
    ["yesterday in Manila", "2026-11-20", "2026-11-20T16:00:00.000Z", true],
    ["today in Manila", "2026-11-21", "2026-11-20T16:00:00.000Z", false],
    ["today in Manila, still yesterday in UTC", "2026-11-21", "2026-11-20T23:00:00.000Z", false],
    ["tomorrow", "2026-11-22", "2026-11-20T16:00:00.000Z", false],
  ])("%s: %s at %s is past? %s", (_label, date, now, expected) => {
    expect(isPastExamDate(date, new Date(now))).toBe(expected);
  });
});
