import { describe, expect, it } from "vitest";

import type { Question, QuizAttemptAnswer } from "@/services/content.types";

import { bestScoreOf, gradeAnswers, hasPassed, reviewOf, scorePercent } from "./grading";

// Marking a quiz on the server (spec, Phase 3 → Quizzes are graded on the
// server, Corrections never cost progress; stories 99, 100, 133k, 133l): the
// score from the Member's answers, pass or fail, the Best Score, and what the
// review shows with "show answers after" on and off. The quiz's questions
// are q1, q2 and q3, in that order; q0 was removed from it earlier.

function question(id: string, position: number | null, correct: Question["correct"]): Question {
  return {
    id,
    quizId: "quiz",
    position,
    question: `Question ${id}`,
    choices: { A: `${id} A`, B: `${id} B`, C: `${id} C`, D: `${id} D` },
    correct,
    explanation: `Why ${id} is ${correct}`,
    figure: id === "q2" ? "quizzes/quiz/figure.png" : null,
    removedAt: position === null ? "2026-11-10T00:00:00.000Z" : null,
  };
}

const Q0 = question("q0", null, "A");
const Q1 = question("q1", 1, "A");
const Q2 = question("q2", 2, "B");
const Q3 = question("q3", 3, "C");
// Out of order, as a store may give them: the quiz's order is their positions.
const QUESTIONS = [Q3, Q0, Q1, Q2];

describe("scorePercent", () => {
  it("is the share of right answers as a whole percentage", () => {
    expect(scorePercent(7, 10)).toBe(70);
    expect(scorePercent(10, 10)).toBe(100);
    expect(scorePercent(0, 4)).toBe(0);
  });

  it("rounds down, so a score is never shown as reaching what it doesn't", () => {
    expect(scorePercent(2, 3)).toBe(66);
    expect(scorePercent(199, 200)).toBe(99);
  });
});

describe("hasPassed", () => {
  it("passes at exactly the passing score, and fails one below", () => {
    expect(hasPassed(70, 70)).toBe(true);
    expect(hasPassed(69, 70)).toBe(false);
    expect(hasPassed(100, 100)).toBe(true);
  });
});

describe("bestScoreOf", () => {
  it("is the highest score, so a lower retake never lowers it", () => {
    expect(bestScoreOf([{ score: 60 }, { score: 80 }, { score: 40 }])).toBe(80);
  });

  it("is null before any attempt", () => {
    expect(bestScoreOf([])).toBeNull();
  });
});

describe("gradeAnswers", () => {
  it("marks each answer against the correct choice, in the order the Member saw them", () => {
    expect(
      gradeAnswers(QUESTIONS, [
        { questionId: "q2", choice: "B" },
        { questionId: "q3", choice: "A" },
        { questionId: "q1", choice: "A" },
      ]),
    ).toEqual({
      ok: true,
      answers: [
        { questionId: "q2", choice: "B", isCorrect: true },
        { questionId: "q3", choice: "A", isCorrect: false },
        { questionId: "q1", choice: "A", isCorrect: true },
      ],
      correctCount: 2,
      questionCount: 3,
      score: 66,
    });
  });

  it("scores a question left unanswered, or missing from the submit, as wrong", () => {
    expect(gradeAnswers(QUESTIONS, [{ questionId: "q1", choice: null }])).toEqual({
      ok: true,
      answers: [
        { questionId: "q1", choice: null, isCorrect: false },
        { questionId: "q2", choice: null, isCorrect: false },
        { questionId: "q3", choice: null, isCorrect: false },
      ],
      correctCount: 0,
      questionCount: 3,
      score: 0,
    });
  });

  it("counts every question in the quiz, however few the submit names", () => {
    const graded = gradeAnswers(QUESTIONS, [{ questionId: "q3", choice: "C" }]);
    expect(graded).toMatchObject({ ok: true, correctCount: 1, questionCount: 3, score: 33 });
  });

  it("refuses the whole submit when it names a question that isn't the quiz's", () => {
    expect(
      gradeAnswers(QUESTIONS, [
        { questionId: "q1", choice: "A" },
        { questionId: "elsewhere", choice: "A" },
      ]),
    ).toEqual({ ok: false, reason: "mismatch" });
  });

  it("refuses the whole submit when it answers a question twice", () => {
    expect(
      gradeAnswers(QUESTIONS, [
        { questionId: "q1", choice: "B" },
        { questionId: "q1", choice: "A" },
      ]),
    ).toEqual({ ok: false, reason: "mismatch" });
  });

  it("refuses the whole submit when it answers a question taken out of the quiz while the Member took it", () => {
    // The quiz changed under the attempt (a Replace, a delete): it's no longer the quiz they took.
    expect(
      gradeAnswers(QUESTIONS, [
        { questionId: "q0", choice: "A" },
        { questionId: "q1", choice: "A" },
        { questionId: "q2", choice: "B" },
        { questionId: "q3", choice: "C" },
      ]),
    ).toEqual({ ok: false, reason: "mismatch" });
  });

  it("refuses a quiz with no questions to grade", () => {
    expect(gradeAnswers([Q0], [])).toEqual({ ok: false, reason: "mismatch" });
  });
});

describe("reviewOf", () => {
  const ANSWERS: QuizAttemptAnswer[] = [
    { questionId: "q2", choice: "B", isCorrect: true },
    { questionId: "q3", choice: "A", isCorrect: false },
    { questionId: "q1", choice: null, isCorrect: false },
  ];
  const URLS = { "quizzes/quiz/figure.png": "https://signed.example/figure.png" };

  it("with “show answers after” on, gives each question with the correct answer and explanation", () => {
    expect(reviewOf(ANSWERS, QUESTIONS, true, URLS)).toEqual({
      showAnswers: true,
      questions: [
        {
          status: "answered",
          number: 1,
          id: "q2",
          question: "Question q2",
          choices: { A: "q2 A", B: "q2 B", C: "q2 C", D: "q2 D" },
          figureUrl: "https://signed.example/figure.png",
          chosen: "B",
          isCorrect: true,
          answer: "B",
          explanation: "Why q2 is B",
          correctedSince: false,
        },
        expect.objectContaining({
          number: 2,
          id: "q3",
          chosen: "A",
          isCorrect: false,
          answer: "C",
          explanation: "Why q3 is C",
          figureUrl: null,
        }),
        expect.objectContaining({ number: 3, id: "q1", chosen: null, isCorrect: false }),
      ],
    });
  });

  it("with it off, says which were missed and never gives a correct answer or an explanation", () => {
    const review = reviewOf(ANSWERS, QUESTIONS, false, URLS);
    expect(review).toEqual({
      showAnswers: false,
      questions: [
        {
          status: "answered",
          number: 1,
          id: "q2",
          question: "Question q2",
          choices: { A: "q2 A", B: "q2 B", C: "q2 C", D: "q2 D" },
          figureUrl: "https://signed.example/figure.png",
          chosen: "B",
          isCorrect: true,
        },
        expect.objectContaining({ number: 2, id: "q3", chosen: "A", isCorrect: false }),
        expect.objectContaining({ number: 3, id: "q1", chosen: null, isCorrect: false }),
      ],
    });
    const serialised = JSON.stringify(review);
    expect(serialised).not.toMatch(/"answer"|"explanation"|"correctedSince"|Why q/);
  });

  it("shows a question removed since as removed, with nothing of it but the Member's own verdict", () => {
    const review = reviewOf(
      [
        { questionId: "q0", choice: "A", isCorrect: true },
        { questionId: "q1", choice: "B", isCorrect: false },
      ],
      QUESTIONS,
      true,
      {},
    );
    expect(review.questions[0]).toEqual({
      status: "removed",
      number: 1,
      id: "q0",
      isCorrect: true,
    });
    expect(review.questions[1]).toMatchObject({ status: "answered", number: 2, id: "q1" });
    expect(JSON.stringify(review.questions[0])).not.toContain("Question q0");
  });

  it("keeps the verdict an answer had, and says when the question was corrected since", () => {
    // q3's correct choice was A when the Member answered it; an Editor made it C.
    const review = reviewOf(
      [{ questionId: "q3", choice: "A", isCorrect: true }],
      QUESTIONS,
      true,
      {},
    );
    expect(review.questions[0]).toMatchObject({
      chosen: "A",
      isCorrect: true,
      answer: "C",
      correctedSince: true,
    });
  });

  it("shows a question gone altogether as removed", () => {
    const review = reviewOf(
      [{ questionId: "gone", choice: "A", isCorrect: false }],
      QUESTIONS,
      false,
      {},
    );
    expect(review.questions).toEqual([
      { status: "removed", number: 1, id: "gone", isCorrect: false },
    ]);
  });
});
