import { manilaDate } from "@/lib/manila-time";
import type { MemberAccess, RefusedDecision } from "@/lib/member-app/access";
import {
  bestScoreOf,
  gradeAnswers,
  hasPassed,
  questionsInQuiz,
  reviewOf,
} from "@/lib/quizzes/grading";
import { CARD_IMAGE_URL_SECONDS } from "@/services/deck-study.core";
import type { Question, Quiz, QuizAttempt, QuizAttemptScore } from "@/services/content.types";
import {
  attemptRefSchema,
  isRecordId,
  memberUserIdSchema,
  quizSubmitSchema,
} from "@/services/member.schema";
import type {
  AttemptOpening,
  AttemptRef,
  AttemptSummary,
  ContentItem,
  QuizOpening,
  QuizResult,
  QuizSubmitInput,
  RefusedQuiz,
  ScoredAttempt,
} from "@/services/member.types";
import { decide } from "@/services/study-access";

// ─────────────────────────────────────────────────────────────────────────────
// Taking a quiz (spec, Phase 3 → Quizzes are graded on the server,
// Corrections never cost progress, Progress storage; ticket 11): the Member
// seam's quiz calls, written once over a small store port that each arm
// implements (member.mock.ts over the sample store, member.db.ts over
// Postgres), so both arms apply the same rules.
//
// Every call decides the quiz with the access decision first, from the
// content as it is now and the Member's side the server gathered for this
// request (src/lib/member-app/access-check.ts). A refused quiz's questions
// are never read, its figures never signed, and nothing is written. A
// question read never carries the correct choice or the explanation: the
// submit is marked here (src/lib/quizzes/grading.ts), and only its review,
// when the quiz shows answers after, gives them. The attempt's own id makes
// the same attempt posted twice save once. Figures are signed URLs that stop
// working after about 10 minutes, like card images.
// ─────────────────────────────────────────────────────────────────────────────

/** What each arm gives the quiz calls. Every read and write of attempts is the given Member's own. */
export interface QuizStudyStore {
  /** A quiz as the access decision reads it, with where it sits, or null when there's no quiz with this id. */
  readQuizItem(quizId: string): Promise<ContentItem | null>;
  /**
   * The quiz's settings and every question it has had, removed ones too:
   * only ever read once the access decision allows the quiz. Null when it's gone.
   */
  readQuiz(quizId: string): Promise<{ quiz: Quiz; questions: Question[] } | null>;
  /** The Member's attempts at a quiz, without their answers, newest first. */
  readAttempts(userId: string, quizId: string): Promise<QuizAttemptScore[]>;
  /** One of the Member's attempts, with its answers in order, or null: none, or another Member's. */
  readAttempt(userId: string, attemptId: string): Promise<QuizAttempt | null>;
  /**
   * Saves the attempt with its answers and the Study Day, once per day,
   * together, unless an attempt with its id is already saved, whoever's it
   * is: then it saves nothing and says so. Throws for a User with no Member
   * record.
   */
  saveAttempt(attempt: QuizAttempt, day: string): Promise<"saved" | "exists">;
  /** Signed URLs for these figures, by path, working for `seconds`. A file that's gone has none. */
  signImages(paths: readonly string[], seconds: number): Promise<Record<string, string>>;
}

/** How long a figure's signed URL works: about 10 minutes, as a card image's. */
export const QUIZ_FIGURE_URL_SECONDS = CARD_IMAGE_URL_SECONDS;

const NOT_FOUND = { ok: false, refusal: { reason: "not-found" } } as const;
const MISMATCH = { ok: false, refusal: { reason: "mismatch" } } as const;

/** Pure: an attempt as the attempts list and the score screen show it. */
export const attemptSummaryOf = (attempt: QuizAttemptScore): AttemptSummary => ({
  id: attempt.id,
  submittedAt: attempt.submittedAt,
  correctCount: attempt.correctCount,
  questionCount: attempt.questionCount,
  score: attempt.score,
  passingScore: attempt.passingScore,
  passed: hasPassed(attempt.score, attempt.passingScore),
});

/** The quiz calls over one arm's store (the Member seam's contract, in member.ts). */
export function quizStudyCalls(store: QuizStudyStore) {
  /** The Member's record on a quiz that refused them: kept, and all they're told of it. */
  async function refusedQuiz(
    userId: string,
    item: ContentItem,
    decision: RefusedDecision,
  ): Promise<RefusedQuiz> {
    const attempts = await store.readAttempts(userId, item.id);
    return {
      status: "refused",
      item,
      decision,
      attemptCount: attempts.length,
      bestScore: bestScoreOf(attempts),
    };
  }

  /** Signed URLs for the figures of these questions, and when they stop working. */
  async function figuresOf(
    questions: readonly Question[],
    now: Date,
  ): Promise<{ urls: Record<string, string>; expireAt: string | null }> {
    const paths = questions.flatMap((question) => (question.figure ? [question.figure] : []));
    if (paths.length === 0) return { urls: {}, expireAt: null };
    return {
      urls: await store.signImages(paths, QUIZ_FIGURE_URL_SECONDS),
      expireAt: new Date(now.getTime() + QUIZ_FIGURE_URL_SECONDS * 1000).toISOString(),
    };
  }

  /** A saved attempt, marked again for the screen: its review under the quiz's rule now, and the Best Score. */
  async function scoredOf(
    attempt: QuizAttempt,
    current: { quiz: Quiz; questions: Question[] },
    now: Date,
  ): Promise<ScoredAttempt> {
    const shown = current.questions.filter((question) =>
      attempt.answers.some((answer) => answer.questionId === question.id),
    );
    const figures = await figuresOf(questionsInQuiz(shown), now);
    const attempts = await store.readAttempts(attempt.userId, attempt.quizId);
    return {
      attempt: attemptSummaryOf(attempt),
      // The attempts read include this one, saved.
      bestScore: bestScoreOf(attempts) ?? attempt.score,
      review: reviewOf(attempt.answers, current.questions, current.quiz.showAnswers, figures.urls),
    };
  }

  async function openQuiz(
    userId: string,
    quizId: string,
    access: MemberAccess,
  ): Promise<QuizOpening> {
    const member = memberUserIdSchema.parse(userId);
    // The id is the browser's: one that isn't an id is no quiz.
    const item = isRecordId(quizId) ? await store.readQuizItem(quizId) : null;
    if (!item) return { status: "not-found" };
    const decided = decide(item, access);
    if (!decided.allowed) return refusedQuiz(member, item, decided.decision);

    const [current, attempts] = await Promise.all([
      store.readQuiz(item.id),
      store.readAttempts(member, item.id),
    ]);
    if (!current) return { status: "not-found" };
    const questions = questionsInQuiz(current.questions);
    const figures = await figuresOf(questions, access.now);
    const { passingScore, shuffle, showAnswers } = current.quiz;
    return {
      status: "allowed",
      item,
      via: decided.via,
      quiz: {
        passingScore,
        shuffle,
        showAnswers,
        // Built field by field: the correct choice and the explanation stay on the server.
        questions: questions.map((question) => ({
          id: question.id,
          question: question.question,
          choices: { ...question.choices },
          figureUrl: question.figure ? (figures.urls[question.figure] ?? null) : null,
        })),
        imagesExpireAt: figures.expireAt,
        bestScore: bestScoreOf(attempts),
        attempts: attempts.map(attemptSummaryOf),
      },
    };
  }

  async function submitQuiz(
    userId: string,
    input: QuizSubmitInput,
    access: MemberAccess,
  ): Promise<QuizResult<ScoredAttempt>> {
    const member = memberUserIdSchema.parse(userId);
    const { attemptId, quizId, answers } = quizSubmitSchema.parse(input);
    const item = isRecordId(quizId) ? await store.readQuizItem(quizId) : null;
    if (!item) return NOT_FOUND;
    const decided = decide(item, access);
    if (!decided.allowed) {
      return { ok: false, refusal: { reason: "refused", decision: decided.decision } };
    }
    const current = await store.readQuiz(item.id);
    if (!current) return NOT_FOUND;

    /** What a repeat of a saved attempt gets: its first marking, when it's the Member's at this quiz. */
    const repeat = async (saved: QuizAttempt | null): Promise<QuizResult<ScoredAttempt>> =>
      saved && saved.quizId === item.id
        ? { ok: true, value: await scoredOf(saved, current, access.now) }
        : NOT_FOUND;

    // Posted again (a double click, a retry): the first marking stands.
    const before = await store.readAttempt(member, attemptId);
    if (before) return repeat(before);

    const graded = gradeAnswers(current.questions, answers);
    if (!graded.ok) return MISMATCH;
    const attempt: QuizAttempt = {
      id: attemptId,
      userId: member,
      quizId: item.id,
      submittedAt: access.now.toISOString(),
      correctCount: graded.correctCount,
      questionCount: graded.questionCount,
      score: graded.score,
      passingScore: current.quiz.passingScore,
      answers: graded.answers,
    };
    // Submitting is studying: the day it's submitted in Manila is a Study Day.
    // An id saved meanwhile: the same attempt sent twice at once, or another Member's.
    if ((await store.saveAttempt(attempt, manilaDate(access.now))) === "exists") {
      return repeat(await store.readAttempt(member, attemptId));
    }
    return { ok: true, value: await scoredOf(attempt, current, access.now) };
  }

  async function reviewQuizAttempt(
    userId: string,
    ref: AttemptRef,
    access: MemberAccess,
  ): Promise<AttemptOpening> {
    const member = memberUserIdSchema.parse(userId);
    // The address is the browser's: anything that isn't a quiz's and an attempt's id names nothing.
    const sent = attemptRefSchema.safeParse(ref);
    if (!sent.success) return { status: "not-found" };
    const { quizId, attemptId } = sent.data;
    const item = isRecordId(quizId) ? await store.readQuizItem(quizId) : null;
    if (!item) return { status: "not-found" };
    const decided = decide(item, access);
    if (!decided.allowed) return refusedQuiz(member, item, decided.decision);

    const attempt = isRecordId(attemptId) ? await store.readAttempt(member, attemptId) : null;
    if (!attempt || attempt.quizId !== item.id) return { status: "not-found" };
    const current = await store.readQuiz(item.id);
    if (!current) return { status: "not-found" };
    return {
      status: "allowed",
      item,
      via: decided.via,
      ...(await scoredOf(attempt, current, access.now)),
    };
  }

  return { openQuiz, submitQuiz, reviewQuizAttempt };
}
