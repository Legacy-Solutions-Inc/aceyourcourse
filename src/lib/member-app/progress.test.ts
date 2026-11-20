import { describe, expect, it } from "vitest";

import { manilaDate } from "@/lib/manila-time";

import {
  type ProgressRecords,
  type ProgressSubject,
  type ProgressTopic,
  memberProgress,
  studyStreak,
  topicProgress,
} from "./progress";

// The progress calculator (spec, Phase 3 → Progress calculator; Testing
// Decisions → Seam 3; stories 90–93), pure, over current-state records: the
// latest Card Mark per card, every Quiz Attempt's score, the Reviewer PDF
// pages viewed, the deck and reader places, and the Study Days. The content
// is an Exam's Subjects and Topics, each Topic with its deck (its cards'
// ids, in order), quiz (its passing score and question count) and Reviewer
// PDF (its readable pages), Hidden and Draft ones marked unavailable.

const T0 = "2026-11-17T03:42:00.000Z";
const later = (minutes: number) => new Date(Date.parse(T0) + minutes * 60_000).toISOString();

const cardIds = (deckId: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${deckId}-card-${index + 1}`);

const deck = (id: string, cards: number, available = true) => ({
  id,
  available,
  cardIds: cardIds(id, cards),
});
const quiz = (id: string, { passingScore = 70, questionCount = 10, available = true } = {}) => ({
  id,
  available,
  passingScore,
  questionCount,
});
const pdf = (id: string, pageCount: number, available = true) => ({ id, available, pageCount });

function topic(id: string, parts: Partial<ProgressTopic> = {}, position = 1): ProgressTopic {
  return { id, name: `Topic ${id}`, position, deck: null, quiz: null, reviewerPdf: null, ...parts };
}

const subject = (code: string, ...topics: ProgressTopic[]): ProgressSubject => ({
  code,
  name: `${code} subject`,
  topics,
});

function records(partial: Partial<ProgressRecords> = {}): ProgressRecords {
  return {
    cardMarks: [],
    quizScores: [],
    pageViews: [],
    deckPositions: [],
    readerPositions: [],
    studyDays: [],
    ...partial,
  };
}

const mark = (cardId: string, verdict: "got" | "again", markedAt = T0) => ({
  cardId,
  verdict,
  markedAt,
});
const marks = (deckId: string, verdict: "got" | "again", count: number, from = 1) =>
  Array.from({ length: count }, (_, index) => mark(`${deckId}-card-${from + index}`, verdict));
const score = (quizId: string, value: number, submittedAt = T0) => ({
  quizId,
  score: value,
  submittedAt,
});
const views = (reviewerPdfId: string, ...pages: number[]) =>
  pages.map((page) => ({ reviewerPdfId, page }));

describe("topicProgress", () => {
  it("is the mean of the share of cards got, the Best Score and the share of pages viewed", () => {
    const studied = topic("t1", {
      deck: deck("d1", 4),
      quiz: quiz("q1"),
      reviewerPdf: pdf("p1", 10),
    });

    const progress = topicProgress(
      studied,
      records({
        cardMarks: marks("d1", "got", 2),
        quizScores: [score("q1", 80)],
        pageViews: views("p1", 1, 2, 3, 4, 5),
      }),
    );

    // (50 + 80 + 50) / 3
    expect(progress.percent).toBe(60);
    expect(progress.cards).toEqual({ deckId: "d1", total: 4, got: 2, again: 0 });
    expect(progress.quiz).toEqual({ quizId: "q1", bestScore: 80, passingScore: 70, attempts: 1 });
    expect(progress.pages).toEqual({ reviewerPdfId: "p1", total: 10, viewed: 5 });
  });

  it("averages only what a Topic has: a missing deck, quiz or Reviewer PDF isn't a 0", () => {
    const quizOnly = topic("t1", { quiz: quiz("q1") });
    const noQuiz = topic("t2", { deck: deck("d2", 4), reviewerPdf: pdf("p2", 4) });
    const studied = records({
      quizScores: [score("q1", 80)],
      cardMarks: marks("d2", "got", 1),
      pageViews: views("p2", 1, 2, 3, 4),
    });

    expect(topicProgress(quizOnly, studied)).toMatchObject({
      percent: 80,
      cards: null,
      pages: null,
    });
    // (25 + 100) / 2 = 62.5, rounded down.
    expect(topicProgress(noQuiz, studied)).toMatchObject({ percent: 62, quiz: null });
  });

  it("has no % for a Topic with nothing to study yet", () => {
    expect(topicProgress(topic("t1"), records()).percent).toBeNull();
    // An empty deck, a quiz with no questions, and a Reviewer PDF with no pages yet.
    const empty = topic("t2", {
      deck: deck("d2", 0),
      quiz: quiz("q2", { questionCount: 0 }),
      reviewerPdf: pdf("p2", 0),
    });
    expect(topicProgress(empty, records())).toMatchObject({
      percent: null,
      cards: null,
      quiz: null,
      pages: null,
    });
  });

  it("counts a quiz the Member hasn't taken as 0, with no Best Score", () => {
    const studied = topic("t1", { deck: deck("d1", 2), quiz: quiz("q1") });

    const progress = topicProgress(studied, records({ cardMarks: marks("d1", "got", 2) }));

    expect(progress.percent).toBe(50);
    expect(progress.quiz).toEqual({ quizId: "q1", bestScore: null, passingScore: 70, attempts: 0 });
  });

  it("counts only the latest mark on a card re-marked", () => {
    const studied = topic("t1", { deck: deck("d1", 2) });
    const remarked = records({
      // Listed out of order: the time decides which is the latest.
      cardMarks: [
        mark("d1-card-1", "again", later(5)),
        mark("d1-card-1", "got", later(1)),
        mark("d1-card-2", "again", later(1)),
        mark("d1-card-2", "got", later(9)),
      ],
    });

    expect(topicProgress(studied, remarked)).toMatchObject({
      percent: 50,
      cards: { total: 2, got: 1, again: 1 },
    });
  });

  it("uses the Best Score, not the latest attempt", () => {
    const studied = topic("t1", { quiz: quiz("q1") });
    const retaken = records({
      quizScores: [score("q1", 90, later(1)), score("q1", 40, later(60))],
    });

    expect(topicProgress(studied, retaken)).toMatchObject({
      percent: 90,
      quiz: { bestScore: 90, attempts: 2 },
    });
  });

  it("counts each page viewed once, and only pages the Reviewer PDF has", () => {
    const studied = topic("t1", { reviewerPdf: pdf("p1", 4) });

    const progress = topicProgress(studied, records({ pageViews: views("p1", 1, 1, 2, 9) }));

    expect(progress).toMatchObject({ percent: 50, pages: { total: 4, viewed: 2 } });
  });

  it("ignores records of other content", () => {
    const studied = topic("t1", {
      deck: deck("d1", 2),
      quiz: quiz("q1"),
      reviewerPdf: pdf("p1", 2),
    });
    const elsewhere = records({
      cardMarks: marks("d9", "got", 2),
      quizScores: [score("q9", 100)],
      pageViews: views("p9", 1, 2),
    });

    expect(topicProgress(studied, elsewhere).percent).toBe(0);
  });
});

describe("a Weak Topic", () => {
  const quizTopic = topic("t1", { quiz: quiz("q1", { passingScore: 70 }) });
  const deckTopic = topic("t2", { deck: deck("d2", 10) });

  it("is one whose Best Score is below the quiz's passing score, and exactly the passing score isn't", () => {
    expect(topicProgress(quizTopic, records({ quizScores: [score("q1", 69)] })).weak).toBe(true);
    expect(topicProgress(quizTopic, records({ quizScores: [score("q1", 70)] })).weak).toBe(false);
    // The Best Score decides: a later, lower attempt doesn't make it weak.
    const retaken = records({ quizScores: [score("q1", 70, later(1)), score("q1", 10, later(2))] });
    expect(topicProgress(quizTopic, retaken).weak).toBe(false);
  });

  it("isn't weak on a quiz the Member hasn't taken", () => {
    expect(topicProgress(quizTopic, records()).weak).toBe(false);
  });

  it("is one with 5 or more cards marked Review again, and 4 isn't", () => {
    expect(topicProgress(deckTopic, records({ cardMarks: marks("d2", "again", 5) })).weak).toBe(
      true,
    );
    expect(topicProgress(deckTopic, records({ cardMarks: marks("d2", "again", 4) })).weak).toBe(
      false,
    );
  });

  it("counts only each card's latest mark towards the 5", () => {
    const remarked = records({
      cardMarks: [...marks("d2", "again", 5), mark("d2-card-5", "got", later(1))],
    });
    expect(topicProgress(deckTopic, remarked).weak).toBe(false);
  });
});

describe("Hidden and Draft content", () => {
  it("counts nowhere in a Topic: not its %, its components or whether it's weak", () => {
    const hidden = topic("t1", {
      deck: deck("d1", 10, false),
      quiz: quiz("q1", { available: false }),
      reviewerPdf: pdf("p1", 4, false),
    });
    const studied = records({
      cardMarks: marks("d1", "again", 6),
      quizScores: [score("q1", 10)],
      pageViews: views("p1", 1, 2),
    });

    expect(topicProgress(hidden, studied)).toMatchObject({
      percent: null,
      cards: null,
      quiz: null,
      pages: null,
      weak: false,
    });
  });

  it("leaves a Topic's % to what's Visible or Published", () => {
    const mixed = topic("t1", {
      deck: deck("d1", 2),
      quiz: quiz("q1", { available: false }),
      reviewerPdf: pdf("p1", 4, false),
    });
    const studied = records({ cardMarks: marks("d1", "got", 1), quizScores: [score("q1", 100)] });

    expect(topicProgress(mixed, studied).percent).toBe(50);
  });
});

describe("studyStreak", () => {
  // 17 Nov 2026, 11:42 in Manila (03:42 UTC).
  const NOW = new Date(T0);

  it("counts consecutive Study Days ending today, and the best run", () => {
    const streak = studyStreak(["2026-11-15", "2026-11-16", "2026-11-17"], NOW);

    expect(streak).toMatchObject({ current: 3, best: 3, studiedToday: true });
  });

  it("keeps a streak ending yesterday going until today ends", () => {
    expect(studyStreak(["2026-11-15", "2026-11-16"], NOW)).toMatchObject({
      current: 2,
      studiedToday: false,
    });
  });

  it("is broken by a gap day", () => {
    expect(studyStreak(["2026-11-13", "2026-11-14", "2026-11-17"], NOW).current).toBe(1);
    // The last Study Day was the day before yesterday: no streak now.
    expect(studyStreak(["2026-11-14", "2026-11-15"], NOW).current).toBe(0);
  });

  it("keeps the best streak after a gap", () => {
    const days = [
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-16",
      "2026-11-17",
    ];

    expect(studyStreak(days, NOW)).toMatchObject({ current: 2, best: 4 });
  });

  it("counts Asia/Manila days across midnight, whatever the UTC date", () => {
    // 23:30 on 16 Nov and 00:30 on 17 Nov in Manila: one UTC day, two Study Days.
    const days = [
      manilaDate(new Date("2026-11-16T15:30:00Z")),
      manilaDate(new Date("2026-11-16T16:30:00Z")),
    ];
    expect(days).toEqual(["2026-11-16", "2026-11-17"]);

    // At 00:10 on 17 Nov in Manila (16:10 UTC on the 16th), it's already the 17th.
    expect(studyStreak(days, new Date("2026-11-16T16:10:00Z"))).toMatchObject({
      current: 2,
      studiedToday: true,
      today: "2026-11-17",
    });
    // At 23:59 on 18 Nov in Manila the streak is still alive; at 00:00 on the 19th it's gone.
    expect(studyStreak(days, new Date("2026-11-18T15:59:00Z")).current).toBe(2);
    expect(studyStreak(days, new Date("2026-11-18T16:00:00Z")).current).toBe(0);
  });

  it("gives the last 7 days, oldest first, ending today", () => {
    const streak = studyStreak(["2026-11-10", "2026-11-12", "2026-11-16", "2026-11-17"], NOW);

    expect(streak.lastSevenDays).toEqual([
      { day: "2026-11-11", studied: false },
      { day: "2026-11-12", studied: true },
      { day: "2026-11-13", studied: false },
      { day: "2026-11-14", studied: false },
      { day: "2026-11-15", studied: false },
      { day: "2026-11-16", studied: true },
      { day: "2026-11-17", studied: true },
    ]);
  });

  it("counts each day once, in any order, and never a day after today", () => {
    const streak = studyStreak(["2026-11-17", "2026-11-16", "2026-11-17", "2026-11-18"], NOW);

    expect(streak).toMatchObject({ current: 2, best: 2, lastStudyDay: "2026-11-17" });
  });

  it("is all zeros, not NaN, with no Study Days", () => {
    const streak = studyStreak([], NOW);

    expect(streak).toMatchObject({ current: 0, best: 0, studiedToday: false, lastStudyDay: null });
    expect(streak.lastSevenDays.every((day) => !day.studied)).toBe(true);
  });
});

describe("memberProgress", () => {
  const NOW = new Date(T0);

  it("gives each Subject the mean of its Topics' %, over Topics with something to study", () => {
    const subjects = [
      subject(
        "MSTC",
        topic("t1", { quiz: quiz("q1") }, 1),
        topic("t2", { deck: deck("d2", 4) }, 2),
        // Nothing to study yet: not part of the mean.
        topic("t3", {}, 3),
      ),
      subject("HPGE", topic("t4", {}, 1)),
    ];

    const progress = memberProgress(
      subjects,
      records({ quizScores: [score("q1", 90)], cardMarks: marks("d2", "got", 1) }),
      NOW,
    );

    // (90 + 25) / 2 = 57.5
    expect(progress.subjects.map(({ code, percent }) => [code, percent])).toEqual([
      ["MSTC", 57],
      ["HPGE", null],
    ]);
    expect(progress.subjects[0]?.topics.map(({ percent }) => percent)).toEqual([90, 25, null]);
  });

  it("gives the quiz average as the mean of Best Scores over the quizzes taken", () => {
    const subjects = [
      subject("MSTC", topic("t1", { quiz: quiz("q1") }, 1), topic("t2", { quiz: quiz("q2") }, 2)),
      subject("HPGE", topic("t3", { quiz: quiz("q3") }, 1), topic("t4", { quiz: quiz("q4") }, 2)),
    ];
    const taken = records({
      // q1's Best Score is 80, not its latest 20. q3 and q4 aren't taken.
      quizScores: [score("q1", 80, later(1)), score("q1", 20, later(2)), score("q2", 65)],
    });

    const progress = memberProgress(subjects, taken, NOW);

    // (80 + 65) / 2 = 72.5
    expect(progress).toMatchObject({ quizAverage: 72, quizzesTaken: 2 });
    expect(
      progress.subjects.map(({ quizAverage, quizzesTaken }) => [quizAverage, quizzesTaken]),
    ).toEqual([
      [72, 2],
      [null, 0],
    ]);
  });

  it("counts the cards got, across the Exam and in each Subject", () => {
    const subjects = [
      subject(
        "MSTC",
        topic("t1", { deck: deck("d1", 4) }, 1),
        topic("t2", { deck: deck("d2", 6) }, 2),
      ),
      subject("HPGE", topic("t3", { deck: deck("d3", 10) }, 1)),
    ];
    const studied = records({
      cardMarks: [...marks("d1", "got", 3), ...marks("d2", "again", 2), ...marks("d3", "got", 1)],
    });

    const progress = memberProgress(subjects, studied, NOW);

    expect(progress.cards).toEqual({ got: 4, total: 20 });
    expect(progress.subjects.map(({ cards }) => cards)).toEqual([
      { got: 3, total: 10 },
      { got: 1, total: 10 },
    ]);
  });

  describe("weakTopics", () => {
    const weakQuiz = (id: string, position: number) =>
      topic(id, { quiz: quiz(`q-${id}`, { passingScore: 70 }) }, position);
    const scores = (...pairs: [string, number][]) =>
      records({ quizScores: pairs.map(([id, value]) => score(`q-${id}`, value)) });

    it("are the 3 lowest by Topic %, lowest first", () => {
      const subjects = [
        subject("MSTC", weakQuiz("a", 1), weakQuiz("b", 2), weakQuiz("c", 3)),
        subject("HPGE", weakQuiz("d", 1), weakQuiz("e", 2)),
      ];

      const progress = memberProgress(
        subjects,
        scores(["a", 60], ["b", 20], ["c", 50], ["d", 40], ["e", 90]),
        NOW,
      );

      expect(
        progress.weakTopics.map(({ id, subjectCode, percent }) => [id, subjectCode, percent]),
      ).toEqual([
        ["b", "MSTC", 20],
        ["d", "HPGE", 40],
        ["c", "MSTC", 50],
      ]);
    });

    it("show only those there are when fewer than 3, and none when nothing is weak", () => {
      const subjects = [subject("MSTC", weakQuiz("a", 1), weakQuiz("b", 2))];

      expect(
        memberProgress(subjects, scores(["a", 60], ["b", 95]), NOW).weakTopics.map(({ id }) => id),
      ).toEqual(["a"]);
      expect(memberProgress(subjects, scores(["a", 70], ["b", 95]), NOW).weakTopics).toEqual([]);
    });

    it("keep the Library's order between Topics at the same %", () => {
      const subjects = [
        subject("MSTC", weakQuiz("a", 2), weakQuiz("b", 1)),
        subject("HPGE", weakQuiz("c", 1)),
      ];

      const progress = memberProgress(subjects, scores(["a", 50], ["b", 50], ["c", 50]), NOW);

      expect(progress.weakTopics.map(({ id }) => id)).toEqual(["b", "a", "c"]);
    });
  });

  it("leaves Hidden and Draft content out of every denominator", () => {
    const subjects = [
      subject(
        "MSTC",
        topic("t1", { deck: deck("d1", 4), quiz: quiz("q1", { available: false }) }, 1),
        topic("t2", { deck: deck("d2", 10, false), reviewerPdf: pdf("p2", 8, false) }, 2),
      ),
    ];
    const studied = records({
      cardMarks: [...marks("d1", "got", 2), ...marks("d2", "again", 9)],
      quizScores: [score("q1", 10)],
      pageViews: views("p2", 1, 2, 3),
    });

    const progress = memberProgress(subjects, studied, NOW);

    expect(progress).toMatchObject({
      cards: { got: 2, total: 4 },
      pages: { viewed: 0, total: 0 },
      quizAverage: null,
      quizzesTaken: 0,
      weakTopics: [],
    });
    expect(progress.subjects[0]).toMatchObject({ percent: 50, cards: { got: 2, total: 4 } });
  });

  describe("resume", () => {
    const subjects = [
      subject(
        "MSTC",
        topic("t1", { deck: deck("d1", 48), reviewerPdf: pdf("p1", 36) }, 1),
        topic("t2", { deck: deck("d2", 10, false), reviewerPdf: pdf("p2", 5) }, 2),
      ),
    ];

    it("gives the last deck the Member left, at their card, and the last Reviewer PDF page", () => {
      const progress = memberProgress(
        subjects,
        records({
          deckPositions: [{ deckId: "d1", cardId: "d1-card-12", savedAt: later(5) }],
          readerPositions: [
            { reviewerPdfId: "p1", page: 4, savedAt: later(9) },
            { reviewerPdfId: "p2", page: 2, savedAt: later(1) },
          ],
        }),
        NOW,
      );

      expect(progress.resume).toEqual({
        deck: {
          deckId: "d1",
          subjectCode: "MSTC",
          topicName: "Topic t1",
          card: 12,
          cardCount: 48,
          savedAt: later(5),
        },
        reviewerPdf: {
          reviewerPdfId: "p1",
          subjectCode: "MSTC",
          topicName: "Topic t1",
          page: 4,
          pageCount: 36,
          savedAt: later(9),
        },
      });
    });

    it("skips Hidden content, a card no longer in its deck, and a page past the last", () => {
      const progress = memberProgress(
        subjects,
        records({
          deckPositions: [
            { deckId: "d2", cardId: "d2-card-1", savedAt: later(9) },
            { deckId: "d1", cardId: "gone", savedAt: later(5) },
          ],
          readerPositions: [{ reviewerPdfId: "p2", page: 6, savedAt: later(9) }],
        }),
        NOW,
      );

      expect(progress.resume).toEqual({ deck: null, reviewerPdf: null });
    });
  });

  it("gives an empty history a starter state, with no NaN", () => {
    const subjects = [
      subject(
        "MSTC",
        topic("t1", { deck: deck("d1", 4), quiz: quiz("q1"), reviewerPdf: pdf("p1", 3) }, 1),
      ),
    ];

    const progress = memberProgress(subjects, records(), NOW);

    expect(progress).toMatchObject({
      started: false,
      quizAverage: null,
      weakTopics: [],
      resume: { deck: null, reviewerPdf: null },
      streak: { current: 0, best: 0 },
    });
    expect(JSON.stringify(progress)).not.toMatch(/NaN|Infinity/);
    expect(memberProgress([], records(), NOW)).toMatchObject({
      started: false,
      cards: { got: 0, total: 0 },
      subjects: [],
    });
  });

  it("has started once the Member has any progress or a place to continue", () => {
    const subjects = [subject("MSTC", topic("t1", { deck: deck("d1", 4) }, 1))];

    expect(
      memberProgress(subjects, records({ cardMarks: marks("d1", "again", 1) }), NOW).started,
    ).toBe(true);
    expect(
      memberProgress(
        subjects,
        records({ deckPositions: [{ deckId: "d1", cardId: "d1-card-2", savedAt: T0 }] }),
        NOW,
      ).started,
    ).toBe(true);
    // Studying elsewhere (another Exam) doesn't start this one, though it counts for the streak.
    const elsewhere = memberProgress(
      subjects,
      records({ cardMarks: marks("d9", "got", 1), studyDays: ["2026-11-17"] }),
      NOW,
    );
    expect(elsewhere).toMatchObject({ started: false, streak: { current: 1 } });
  });
});
