import { describe, expect, it } from "vitest";

import type { MemberProgress } from "@/lib/member-app/progress";

import {
  memberInitials,
  pageSummary,
  passEnd,
  progressFigures,
  roleLabel,
  USER_FILTER_LABELS,
} from "./users-view";

// How the Users screens word a Member (BUILD-MAP §3.10; stories 129, 130).
// Every date is the day in Asia/Manila, whatever the server's time zone.

describe("passEnd", () => {
  // 23:59:59.999 on 19 Nov in Manila: the pass's last instant is "today" there.
  const END_OF_THE_19TH = "2026-11-19T15:59:59.999Z";

  it("shows a pass ending today in Manila as active, a minute before midnight", () => {
    expect(passEnd(END_OF_THE_19TH, new Date("2026-11-19T15:59:00.000Z"))).toEqual({
      date: "19 NOV 2026",
      expired: false,
    });
  });

  it("shows the same pass as expired just after Manila midnight, on the same date", () => {
    expect(passEnd(END_OF_THE_19TH, new Date("2026-11-19T16:00:00.000Z"))).toEqual({
      date: "19 NOV 2026",
      expired: true,
    });
  });

  it("dates a pass by its day in Manila, not in UTC", () => {
    // 1 am on 20 Nov in Manila is still the 19th in UTC.
    expect(passEnd("2026-11-19T17:00:00.000Z", new Date("2026-11-19T00:00:00.000Z"))).toEqual({
      date: "20 NOV 2026",
      expired: false,
    });
  });

  it("counts a pass ending this instant as expired", () => {
    const end = "2026-12-01T04:00:00.000Z";
    expect(passEnd(end, new Date(end)).expired).toBe(true);
  });
});

describe("roleLabel", () => {
  it.each([
    ["member", "MEMBER"],
    ["editor", "EDITOR"],
    ["owner", "OWNER"],
  ] as const)("words %s as %s", (role, label) => {
    expect(roleLabel(role)).toBe(label);
  });
});

describe("USER_FILTER_LABELS", () => {
  it("names each filter as the list's chips do", () => {
    expect(USER_FILTER_LABELS).toEqual({
      all: "All",
      active: "Active Pass",
      expired: "Expired",
      none: "None",
      staff: "Staff",
      beta: "Beta Tester",
    });
  });
});

describe("memberInitials", () => {
  it("takes the first letters of the first two words of a name", () => {
    expect(memberInitials("Angel Rose L. Lepaña", "angel@aceyourcourse.ph")).toBe("AR");
  });

  it("takes one letter from a one-word name", () => {
    expect(memberInitials("bea", "tester@example.com")).toBe("B");
  });

  it("takes the email's first letter without a name", () => {
    expect(memberInitials(null, "stranger@example.com")).toBe("S");
  });
});

describe("pageSummary", () => {
  it("says which Members a page shows, of how many", () => {
    expect(pageSummary({ query: { page: 2 }, rows: 5, matching: 30 })).toBe("26–30 OF 30 MEMBERS");
  });

  it("says one Member", () => {
    expect(pageSummary({ query: { page: 1 }, rows: 1, matching: 1 })).toBe("1 OF 1 MEMBER");
  });

  it("says none", () => {
    expect(pageSummary({ query: { page: 1 }, rows: 0, matching: 0 })).toBe("0 MEMBERS");
  });

  it("writes large counts with separators", () => {
    expect(pageSummary({ query: { page: 1 }, rows: 25, matching: 1240 })).toBe(
      "1–25 OF 1,240 MEMBERS",
    );
  });
});

describe("progressFigures", () => {
  const progress = (change: Partial<MemberProgress> = {}): MemberProgress =>
    ({
      started: true,
      cards: { got: 312, total: 1040 },
      pages: { viewed: 2, total: 36 },
      quizAverage: 76,
      quizzesTaken: 3,
      subjects: [],
      weakTopics: [],
      resume: { deck: null, reviewerPdf: null },
      streak: {
        current: 2,
        best: 6,
        today: "2026-11-19",
        studiedToday: true,
        lastSevenDays: [],
        lastStudyDay: "2026-11-19",
      },
      ...change,
    }) as MemberProgress;

  it("gives the cards got, the quiz average, the pages read and the last Study Day", () => {
    expect(progressFigures(progress())).toEqual({
      cards: "312 / 1,040",
      quizAverage: "76%",
      quizzes: "3 QUIZZES TAKEN",
      pages: "2 / 36",
      lastActive: "19 Nov 2026",
      streak: "2 DAYS · BEST 6",
    });
  });

  it("says what isn't there yet", () => {
    expect(
      progressFigures(
        progress({
          cards: { got: 0, total: 0 },
          pages: { viewed: 0, total: 0 },
          quizAverage: null,
          quizzesTaken: 0,
          streak: { ...progress().streak, current: 0, best: 0, lastStudyDay: null },
        }),
      ),
    ).toEqual({
      cards: "—",
      quizAverage: "—",
      quizzes: "NO QUIZ TAKEN",
      pages: "—",
      lastActive: "Never",
      streak: "NO STREAK YET",
    });
  });

  it("says one quiz and one day", () => {
    expect(
      progressFigures(
        progress({ quizzesTaken: 1, streak: { ...progress().streak, current: 1, best: 1 } }),
      ),
    ).toMatchObject({ quizzes: "1 QUIZ TAKEN", streak: "1 DAY · BEST 1" });
  });
});
