import { describe, expect, it } from "vitest";

import type { MemberProgress, TopicProgress } from "@/lib/member-app/progress";

import { examKept, keptNote } from "./study-states";

// What a refused study screen says the Member kept. Once their Access Pass
// ended, it's their progress in the whole Exam (Phase 4, ticket 12; spec,
// Phase 4 planning decisions → Renewal reminders; mockup `expired`): "312
// cards marked, 14 quizzes taken", leaving out what's none.

/** A Topic's progress with only what examKept reads. */
const topic = (cards: { got: number; again: number } | null): TopicProgress => ({
  id: crypto.randomUUID(),
  name: "Topic",
  position: 1,
  percent: null,
  cards: cards && { deckId: crypto.randomUUID(), total: 400, ...cards },
  quiz: null,
  pages: null,
  weak: false,
});

/** An Exam's progress: its Topics' cards, the quizzes taken and the pages viewed. */
function progress(
  topics: TopicProgress[],
  quizzesTaken: number,
  viewed = 0,
): Pick<MemberProgress, "subjects" | "quizzesTaken" | "pages"> {
  return {
    subjects: [
      {
        code: "MSTC",
        name: "Math",
        percent: null,
        cards: { got: 0, total: 0 },
        pages: { viewed: 0, total: 0 },
        quizAverage: null,
        quizzesTaken,
        topics,
      },
    ],
    quizzesTaken,
    pages: { viewed, total: 100 },
  };
}

describe("examKept", () => {
  it("counts every card marked, Got it or Review again, and the quizzes taken", () => {
    expect(
      examKept(progress([topic({ got: 200, again: 12 }), topic({ got: 100, again: 0 })], 14)),
    ).toBe("312 cards marked, 14 quizzes taken");
  });

  it("leaves out what's none, and says one in the singular", () => {
    expect(examKept(progress([topic({ got: 1, again: 0 }), topic(null)], 0))).toBe("1 card marked");
    expect(examKept(progress([topic({ got: 0, again: 0 })], 1))).toBe("1 quiz taken");
  });

  it("adds the Reviewer PDF pages viewed when there are any", () => {
    expect(examKept(progress([topic({ got: 3, again: 0 })], 2, 40))).toBe(
      "3 cards marked, 2 quizzes taken, 40 pages viewed",
    );
    expect(examKept(progress([], 0, 1))).toBe("1 page viewed");
  });

  it("is null with no progress at all", () => {
    expect(examKept(progress([topic({ got: 0, again: 0 })], 0))).toBeNull();
  });
});

describe("keptNote", () => {
  it("asks to renew once the pass ended, with what's kept or without", () => {
    const expired = { outcome: "expired", passEndedAt: "2026-11-14T02:00:00.000Z" } as const;
    expect(keptNote(expired, "312 cards marked, 14 quizzes taken")).toBe(
      "Renew to keep reviewing. Your progress is kept: 312 cards marked, 14 quizzes taken.",
    );
    expect(keptNote(expired, null)).toBe("Renew to keep reviewing. Your progress is kept.");
  });
});
