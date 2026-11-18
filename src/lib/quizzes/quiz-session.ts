import type { QuizChoice } from "@/lib/quizzes/quiz-rules";
import type { QuizSubmitInput } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// A Member's pass through a quiz on the quiz screen (stories 98 and 133k;
// mockups `quizStart` and `quiz`), as pure functions over the attempt's
// state: the questions in the order this attempt shows them (shuffled when
// the quiz says so, afresh for each attempt), one at a time, with Back and
// Next, answers the Member can change until they submit, and the questions
// still unanswered. Nothing here knows the correct choices: the server marks
// the submit (src/lib/quizzes/grading.ts). The attempt's id goes with the
// submit, so sending it twice saves one attempt.
// ─────────────────────────────────────────────────────────────────────────────

export interface QuizSession {
  /** The attempt's own id, made when it starts: the server saves one attempt per id. */
  attemptId: string;
  /** The questions, in the order this attempt shows them. */
  order: readonly string[];
  /** The current question's place in `order`. */
  index: number;
  /** The Member's choice on each question they've answered. */
  answers: Readonly<Record<string, QuizChoice>>;
}

export interface QuizStart {
  /** The quiz's questions, in its order. Never empty. */
  questionIds: readonly string[];
  shuffle: boolean;
  attemptId: string;
  /** A number in [0, 1), as Math.random gives. */
  random?: () => number;
}

/** Pure: a copy of the ids in a random order (Fisher–Yates), from `random`. */
export function shuffled(ids: readonly string[], random: () => number): string[] {
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j] as string, order[i] as string];
  }
  return order;
}

/** Pure: an attempt at its first question, nothing answered, its questions shuffled when the quiz says so. */
export function startQuiz({
  questionIds,
  shuffle,
  attemptId,
  random = Math.random,
}: QuizStart): QuizSession {
  return {
    attemptId,
    order: shuffle ? shuffled(questionIds, random) : [...questionIds],
    index: 0,
    answers: {},
  };
}

/** Pure: the current question's id. */
export const currentQuestion = (session: QuizSession): string => session.order[session.index] ?? "";

/** Pure: picks a choice for the current question, replacing one picked before. */
export function answer(session: QuizSession, choice: QuizChoice): QuizSession {
  return { ...session, answers: { ...session.answers, [currentQuestion(session)]: choice } };
}

/** Pure: the question at this place, held to the attempt's first and last. */
export function goTo(session: QuizSession, index: number): QuizSession {
  return { ...session, index: Math.min(Math.max(index, 0), session.order.length - 1) };
}

/** Pure: Next (1) or Back (-1), staying put at either end. */
export const move = (session: QuizSession, step: -1 | 1): QuizSession =>
  goTo(session, session.index + step);

/** Pure: the places, from 1, of the questions not answered yet, in the order shown. */
export const unanswered = (session: QuizSession): number[] =>
  session.order.flatMap((id, index) => (session.answers[id] ? [] : [index + 1]));

/** Pure: what Submit sends for this attempt at this quiz: an answer for every question, in the order seen. */
export const submission = (session: QuizSession, quizId: string): QuizSubmitInput => ({
  attemptId: session.attemptId,
  quizId,
  answers: session.order.map((questionId) => ({
    questionId,
    choice: session.answers[questionId] ?? null,
  })),
});
