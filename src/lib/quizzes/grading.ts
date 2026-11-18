import type { QuizChoice } from "@/lib/quizzes/quiz-rules";
import type { Question, QuizAttemptAnswer } from "@/services/content.types";
import type { QuizSubmitInput } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// Marking a quiz (spec, Phase 3 → Quizzes are graded on the server,
// Corrections never cost progress; stories 99, 100, 133k, 133l), as pure
// functions the Member seam runs on the server (quiz-study.core.ts):
//   - every question in the quiz counts, so an answer left out of the submit,
//     or left unanswered, is wrong;
//   - a submit naming a question that isn't in the quiz, one taken out of it
//     while the Member took it (a Replace, a delete) included, or answering
//     one twice, is refused whole: it isn't the quiz as it is;
//   - the score is a whole percentage, rounded down, and passes at or above
//     the passing score; the Best Score is the highest score;
//   - the review gives each question in the order the Member saw it, the
//     correct answer and explanation only when the quiz shows answers after,
//     and a question removed since as removed, with nothing of it.
// ─────────────────────────────────────────────────────────────────────────────

/** One answer as the quiz screen sends it: the question, and the choice picked, or null. */
export type SubmittedAnswer = QuizSubmitInput["answers"][number];

/** A submit marked: each answer's verdict, in the order sent, and the score. Refused when it doesn't match the quiz. */
export type Grading =
  | { ok: false; reason: "mismatch" }
  | {
      ok: true;
      answers: QuizAttemptAnswer[];
      correctCount: number;
      questionCount: number;
      score: number;
    };

/** Pure: right answers as a whole percentage of the questions, rounded down. */
export const scorePercent = (correctCount: number, questionCount: number): number =>
  Math.floor((correctCount * 100) / questionCount);

/** Pure: whether a score passes: at or above the passing score. */
export const hasPassed = (score: number, passingScore: number): boolean => score >= passingScore;

/** Pure: the Best Score, the highest of the attempts' scores, or null before any attempt. */
export const bestScoreOf = (attempts: readonly { score: number }[]): number | null =>
  attempts.length === 0 ? null : Math.max(...attempts.map((attempt) => attempt.score));

/** Pure: the questions in the quiz now, in its order: removed ones left out. */
export const questionsInQuiz = (questions: readonly Question[]): Question[] =>
  questions
    .filter((question) => question.removedAt === null)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));

/**
 * Pure: marks a submit against the quiz's questions as they are (removed ones
 * may be among them: they're not in the quiz). The answers come in the order
 * the Member saw them, then each question in the quiz they didn't answer, wrong.
 */
export function gradeAnswers(
  questions: readonly Question[],
  submitted: readonly SubmittedAnswer[],
): Grading {
  const inQuiz = questionsInQuiz(questions);
  const correctOf = new Map(inQuiz.map((question) => [question.id, question.correct]));
  const named = new Set<string>();
  for (const { questionId } of submitted) {
    if (!correctOf.has(questionId) || named.has(questionId)) {
      return { ok: false, reason: "mismatch" };
    }
    named.add(questionId);
  }
  if (inQuiz.length === 0) return { ok: false, reason: "mismatch" };

  const answers: QuizAttemptAnswer[] = submitted.map(({ questionId, choice }) => ({
    questionId,
    choice,
    isCorrect: choice === correctOf.get(questionId),
  }));
  for (const question of inQuiz) {
    if (!named.has(question.id)) {
      answers.push({ questionId: question.id, choice: null, isCorrect: false });
    }
  }

  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  return {
    ok: true,
    answers,
    correctCount,
    questionCount: inQuiz.length,
    score: scorePercent(correctCount, inQuiz.length),
  };
}

/** A question taken out of the quiz since the attempt: "This question has since been removed". */
export interface RemovedQuestion {
  status: "removed";
  /** Its place in the attempt, from 1. */
  number: number;
  id: string;
  /** Whether the Member's answer was right when they submitted: their own record, which still counts. */
  isCorrect: boolean;
}

/** A question in an attempt's review, as the quiz shows it: the Member's answer and whether it was right. */
export interface ReviewedQuestion {
  status: "answered";
  /** Its place in the attempt, from 1. */
  number: number;
  id: string;
  question: string;
  choices: Record<QuizChoice, string>;
  /** Its figure's signed URL, or null. */
  figureUrl: string | null;
  /** The Member's choice, or null when they left it unanswered. */
  chosen: QuizChoice | null;
  /** Whether it was right when they submitted. */
  isCorrect: boolean;
}

/** A reviewed question with what "show answers after" adds: the correct answer and the explanation. */
export interface RevealedQuestion extends ReviewedQuestion {
  answer: QuizChoice;
  explanation: string;
  /** An Editor changed the correct choice since, so it no longer agrees with the verdict kept. */
  correctedSince: boolean;
}

/** An attempt's review: with the answers when the quiz shows them after, and without when it doesn't. */
export type AttemptReview =
  | { showAnswers: true; questions: (RevealedQuestion | RemovedQuestion)[] }
  | { showAnswers: false; questions: (ReviewedQuestion | RemovedQuestion)[] };

/**
 * Pure: an attempt's review from its answers and the quiz's questions as they
 * are now (removed ones too), with each figure's signed URL by path. With
 * `showAnswers` off, nothing in it gives a correct answer or an explanation.
 */
export function reviewOf(
  answers: readonly QuizAttemptAnswer[],
  questions: readonly Question[],
  showAnswers: boolean,
  figureUrls: Readonly<Record<string, string>>,
): AttemptReview {
  const byId = new Map(questions.map((question) => [question.id, question]));
  type Entry =
    { removed: RemovedQuestion } | { removed: null; shown: ReviewedQuestion; question: Question };
  const entries = answers.map(({ questionId, choice, isCorrect }, index): Entry => {
    const number = index + 1;
    const question = byId.get(questionId);
    if (!question || question.removedAt !== null) {
      return { removed: { status: "removed", number, id: questionId, isCorrect } };
    }
    return {
      removed: null,
      question,
      shown: {
        status: "answered",
        number,
        id: question.id,
        question: question.question,
        choices: { ...question.choices },
        figureUrl: question.figure ? (figureUrls[question.figure] ?? null) : null,
        chosen: choice,
        isCorrect,
      },
    };
  });

  if (!showAnswers) {
    return {
      showAnswers: false,
      questions: entries.map((entry) => entry.removed ?? entry.shown),
    };
  }
  return {
    showAnswers: true,
    questions: entries.map(
      (entry): RevealedQuestion | RemovedQuestion =>
        entry.removed ?? {
          ...entry.shown,
          answer: entry.question.correct,
          explanation: entry.question.explanation,
          correctedSince: (entry.shown.chosen === entry.question.correct) !== entry.shown.isCorrect,
        },
    ),
  };
}
