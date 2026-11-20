import { describe, expect, it } from "vitest";

import {
  answer,
  currentQuestion,
  goTo,
  move,
  shuffled,
  startQuiz,
  submission,
  unanswered,
} from "./quiz-session";

// A Member's pass through a quiz on the quiz screen (stories 98 and 133k;
// mockups `quizStart` and `quiz`): one question at a time, Back and Next,
// answers they can change until they submit, the questions they left
// unanswered, and what Submit sends. The quiz's questions are a, b, c and d,
// in the quiz's order.
const QUIZ = ["a", "b", "c", "d"];
const ATTEMPT = "6a1f0e1c-5b55-4a51-9d0e-0a1b2c3d4e5f";
const fresh = () => startQuiz({ questionIds: QUIZ, shuffle: false, attemptId: ATTEMPT });

/** A stand-in for Math.random that gives these numbers in turn, then repeats them. */
function sequence(...numbers: number[]) {
  let next = 0;
  return () => numbers[next++ % numbers.length] ?? 0;
}

describe("startQuiz", () => {
  it("starts at the first question, in the quiz's order, with nothing answered", () => {
    const session = fresh();
    expect(session.order).toEqual(QUIZ);
    expect(currentQuestion(session)).toBe("a");
    expect(session.answers).toEqual({});
    expect(session.attemptId).toBe(ATTEMPT);
  });

  it("shuffles the questions when the quiz says so", () => {
    const session = startQuiz({
      questionIds: QUIZ,
      shuffle: true,
      attemptId: ATTEMPT,
      random: sequence(0),
    });
    // Fisher–Yates with every number 0 swaps each last place with the first:
    // a b c d → d b c a → c b d a → b c d a.
    expect(session.order).toEqual(["b", "c", "d", "a"]);
    expect([...session.order].sort()).toEqual(QUIZ);
  });
});

describe("shuffled", () => {
  it("gives every question once, in an order that changes with the random numbers", () => {
    const first = shuffled(QUIZ, sequence(0.9, 0.1, 0.5));
    const second = shuffled(QUIZ, sequence(0.1, 0.9, 0.2));
    expect([...first].sort()).toEqual(QUIZ);
    expect([...second].sort()).toEqual(QUIZ);
    expect(first).not.toEqual(second);
  });

  it("leaves the list it's given as it was", () => {
    const ids = [...QUIZ];
    shuffled(ids, sequence(0));
    expect(ids).toEqual(QUIZ);
  });
});

describe("answer", () => {
  it("picks a choice for the current question, and changes it when picked again", () => {
    const once = answer(fresh(), "B");
    expect(once.answers).toEqual({ a: "B" });
    expect(answer(once, "D").answers).toEqual({ a: "D" });
  });
});

describe("move and goTo", () => {
  it("goes to the next question and back, keeping the answers", () => {
    const answered = move(answer(fresh(), "C"), 1);
    expect(currentQuestion(answered)).toBe("b");
    const back = move(answered, -1);
    expect(currentQuestion(back)).toBe("a");
    expect(back.answers).toEqual({ a: "C" });
  });

  it("stays at the first question going back, and at the last going on", () => {
    expect(move(fresh(), -1).index).toBe(0);
    expect(move(goTo(fresh(), 3), 1).index).toBe(3);
  });

  it("goes straight to a question by its place, held to the quiz", () => {
    expect(currentQuestion(goTo(fresh(), 2))).toBe("c");
    expect(goTo(fresh(), 9).index).toBe(3);
    expect(goTo(fresh(), -2).index).toBe(0);
  });
});

describe("unanswered", () => {
  it("lists the places, from 1, of the questions not yet answered", () => {
    const session = answer(goTo(answer(fresh(), "A"), 2), "B");
    expect(unanswered(session)).toEqual([2, 4]);
    expect(unanswered(fresh())).toEqual([1, 2, 3, 4]);
  });
});

describe("submission", () => {
  it("sends the attempt, the quiz and every question in the order seen, unanswered ones as null", () => {
    const session = answer(goTo(answer(fresh(), "A"), 3), "D");
    expect(submission(session, "quiz-1")).toEqual({
      attemptId: ATTEMPT,
      quizId: "quiz-1",
      answers: [
        { questionId: "a", choice: "A" },
        { questionId: "b", choice: null },
        { questionId: "c", choice: null },
        { questionId: "d", choice: "D" },
      ],
    });
  });
});
