import { describe, expect, it } from "vitest";

import type { PlansExam } from "@/services/member.types";

import {
  courseRows,
  pickedItem,
  askedExam,
  defaultPlanId,
  openPlansExam,
  orderPlansExams,
  planRows,
  plansHeading,
} from "./plans-view";

// The Member's Plans page, worded and ordered (Phase 4, ticket 02; spec,
// Phase 4 planning decisions → Who buys, and which Exams, Renewal reminders;
// stories 134 and 151c; BUILD-MAP §3 Plans). "Now" is 17 Nov 2026, 11:42 in
// Manila (03:42 UTC).
const NOW = new Date("2026-11-17T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function exam(examCode: string, fields: Partial<PlansExam> = {}): PlansExam {
  return {
    examCode,
    board: `${examCode}LE`,
    name: `${examCode} Exam`,
    plans: [
      {
        id: `${examCode}-30`,
        name: `${examCode} All-Access`,
        days: 30,
        priceCentavos: 44_900,
        bestValue: false,
      },
    ],
    courses: [],
    passEndsAt: null,
    examDate: null,
    ...fields,
  };
}

const CE = exam("CE", {
  board: "CELE",
  plans: [
    { id: "ce-30", name: "CE All-Access", days: 30, priceCentavos: 49_900, bestValue: false },
    { id: "ce-90", name: "CE All-Access", days: 90, priceCentavos: 129_900, bestValue: true },
    { id: "ce-180", name: "CE All-Access", days: 180, priceCentavos: 229_900, bestValue: false },
  ],
});

const codes = (exams: readonly PlansExam[]) => exams.map((candidate) => candidate.examCode);

describe("orderPlansExams", () => {
  const catalogue = [CE, exam("ME"), exam("EE"), exam("MT"), exam("CPA")];

  it("puts the Member's Target Exams first, in the order they added them, then the rest in order", () => {
    const ordered = orderPlansExams(catalogue, [{ examCode: "MT" }, { examCode: "ME" }]);
    expect(codes(ordered)).toEqual(["MT", "ME", "CE", "EE", "CPA"]);
  });

  it("leaves out a Target Exam with nothing on sale: it has no pill", () => {
    const ordered = orderPlansExams([CE, exam("EE")], [{ examCode: "ME" }, { examCode: "EE" }]);
    expect(codes(ordered)).toEqual(["EE", "CE"]);
  });
});

describe("askedExam", () => {
  it("reads ?exam= as an Exam code, in any case", () => {
    expect(askedExam("ce")).toBe("CE");
    expect(askedExam(" Me ")).toBe("ME");
  });

  it("takes the first of several", () => {
    expect(askedExam(["ee", "ce"])).toBe("EE");
  });

  it.each([undefined, "", "  ", "x".repeat(40)])("reads %j as no Exam", (raw) => {
    expect(askedExam(raw)).toBeNull();
  });
});

describe("openPlansExam", () => {
  const exams = [exam("ME"), CE, exam("EE")];

  it("opens on the Exam the address asks for", () => {
    expect(openPlansExam(exams, "EE", "ME")?.examCode).toBe("EE");
  });

  it("falls back to the Member's current Exam for an Exam that isn't one", () => {
    expect(openPlansExam(exams, "ZZ", "CE")?.examCode).toBe("CE");
  });

  it("falls back to the Member's current Exam for one with nothing on sale", () => {
    expect(openPlansExam(exams, "MT", "CE")?.examCode).toBe("CE");
  });

  it("opens on the Member's current Exam when the address asks for none", () => {
    expect(openPlansExam(exams, null, "CE")?.examCode).toBe("CE");
  });

  it("opens on the first pill when the current Exam has nothing on sale", () => {
    expect(openPlansExam(exams, null, "CPA")?.examCode).toBe("ME");
  });

  it("opens on nothing when nothing is on sale", () => {
    expect(openPlansExam([], "CE", "CE")).toBeNull();
  });
});

describe("plansHeading", () => {
  it("names the Exam's All-Access and what it opens", () => {
    expect(plansHeading("CE")).toBe("CE ALL-ACCESS · FLASHCARDS, QUIZZES, REVIEWERS");
  });
});

describe("planRows", () => {
  it("shows each Plan's period, price, per-month figure and Best value, shortest first", () => {
    expect(
      planRows(CE, NOW).map(({ id, period, price, perMonth, bestValue }) => ({
        id,
        period,
        price,
        perMonth,
        bestValue,
      })),
    ).toEqual([
      { id: "ce-30", period: "1 month", price: "₱499", perMonth: "for 30 days", bestValue: false },
      {
        id: "ce-90",
        period: "3 months",
        price: "₱1,299",
        perMonth: "₱433 / month",
        bestValue: true,
      },
      {
        id: "ce-180",
        period: "6 months",
        price: "₱2,299",
        perMonth: "₱383 / month",
        bestValue: false,
      },
    ]);
  });

  it("counts the days from now with no pass", () => {
    expect(planRows(CE, NOW).map((row) => row.until)).toEqual([
      "17 Dec 2026",
      "15 Feb 2027",
      "16 May 2027",
    ]);
  });

  it("counts the days from the pass's end while it's active: 20 days left are kept", () => {
    const passEndsAt = new Date(NOW.getTime() + 20 * DAY).toISOString(); // 7 Dec 2026
    expect(planRows({ ...CE, passEndsAt }, NOW).map((row) => row.until)).toEqual([
      "6 Jan 2027",
      "7 Mar 2027",
      "5 Jun 2027",
    ]);
  });

  it("counts the days from now once the pass has ended", () => {
    const passEndsAt = new Date(NOW.getTime() - 3 * DAY).toISOString();
    expect(planRows({ ...CE, passEndsAt }, NOW)[0]?.until).toBe("17 Dec 2026");
  });

  it("dates the end in Manila: a minute before midnight there stays that day", () => {
    // 23:59 on 17 Nov in Manila is 15:59 UTC: 30 days on ends 23:59 on 17 Dec.
    const lateEvening = new Date("2026-11-17T15:59:00.000Z");
    expect(planRows(CE, lateEvening)[0]?.until).toBe("17 Dec 2026");
  });

  it("dates the end in Manila: a minute after midnight there is the next day, though UTC isn't", () => {
    // 00:01 on 18 Nov in Manila is still 17 Nov, 16:01 UTC.
    const justAfterMidnight = new Date("2026-11-17T16:01:00.000Z");
    expect(planRows(CE, justAfterMidnight)[0]?.until).toBe("18 Dec 2026");
  });

  it("says a Plan covers the Exam Date when its end reaches it, and not the others", () => {
    const rows = planRows({ ...CE, examDate: "2027-02-10" }, NOW);
    expect(rows.map((row) => row.coversExamOn)).toEqual([null, "10 Feb 2027", "10 Feb 2027"]);
  });

  it("counts a Plan ending on the Exam Date itself, in Manila, as covering it", () => {
    // 90 days on ends 15 Feb 2027, 11:42 in Manila.
    expect(planRows({ ...CE, examDate: "2027-02-15" }, NOW)[1]?.coversExamOn).toBe("15 Feb 2027");
    expect(planRows({ ...CE, examDate: "2027-02-16" }, NOW)[1]?.coversExamOn).toBeNull();
  });

  it("says nothing about an Exam Date that has passed, or with none", () => {
    expect(planRows({ ...CE, examDate: "2026-11-16" }, NOW)[0]?.coversExamOn).toBeNull();
    expect(planRows(CE, NOW)[0]?.coversExamOn).toBeNull();
  });

  it("words the order summary: the Plan and period, and the end with no auto-renewal", () => {
    const row = planRows(CE, NOW)[1];
    expect(row?.summary).toBe("CE All-Access · 3 months");
    expect(row?.summaryUntil).toBe("UNTIL 15 FEB 2027 · NO AUTO-RENEWAL");
  });
});

describe("defaultPlanId", () => {
  it("picks the Best value Plan", () => {
    expect(defaultPlanId(planRows(CE, NOW))).toBe("ce-90");
  });

  it("picks the shortest when none is Best value", () => {
    expect(defaultPlanId(planRows(exam("ME"), NOW))).toBe("ME-30");
  });

  it("picks nothing with no Plans", () => {
    expect(defaultPlanId([])).toBeNull();
  });
});

describe("courseRows (Phase 5, ticket 06)", () => {
  const PSAD = { id: "psad-id", title: "PSAD Masterclass", priceCentavos: 149_900, owned: false };

  it("gives each One-time purchase its row: video course only, yours to keep, no expiry", () => {
    expect(courseRows(exam("CE", { courses: [PSAD] }))).toEqual([
      {
        id: "course:psad-id",
        courseId: "psad-id",
        title: "PSAD Masterclass",
        line: "Video course only · yours to keep",
        price: "₱1,499",
        owned: false,
        href: "/app/courses/psad-id",
        summary: "PSAD Masterclass · Video course",
        summaryUntil: "ONE-TIME · NO EXPIRY",
      },
    ]);
  });

  it("marks a Course the Member owns", () => {
    expect(courseRows(exam("CE", { courses: [{ ...PSAD, owned: true }] }))[0]?.owned).toBe(true);
  });
});

describe("pickedItem (Phase 5, ticket 06)", () => {
  const PSAD = { id: "psad-id", title: "PSAD Masterclass", priceCentavos: 149_900, owned: false };
  const ce = exam("CE", { courses: [PSAD] });

  it("picks the Course the address asks for, when the Member can buy it", () => {
    expect(pickedItem(planRows(ce, NOW), courseRows(ce), "psad-id")).toBe("course:psad-id");
  });

  it("picks the Best value Plan otherwise, or for a Course the Member owns", () => {
    const owned = exam("CE", { courses: [{ ...PSAD, owned: true }] });
    expect(pickedItem(planRows(ce, NOW), courseRows(ce), null)).toBe("CE-30");
    expect(pickedItem(planRows(owned, NOW), courseRows(owned), "psad-id")).toBe("CE-30");
  });

  it("picks the first Course the Member can buy when the Exam has no Plan on sale", () => {
    const onlyCourse = exam("CE", { plans: [], courses: [PSAD] });
    expect(pickedItem([], courseRows(onlyCourse), null)).toBe("course:psad-id");
    expect(pickedItem([], [], null)).toBeNull();
  });
});
