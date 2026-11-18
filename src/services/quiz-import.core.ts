import { cardImageType } from "@/lib/cards/card-rules";
import type { ImportPlan } from "@/lib/content-import/plan";
import {
  type ExistingQuizTopic,
  QUIZ_IMPORT,
  type QuestionFields,
} from "@/lib/content-import/quizzes";
import { DEFAULT_QUIZ_SETTINGS, quizFigurePath } from "@/lib/quizzes/quiz-rules";
import type { ImportTopicResult } from "@/services/admin.types";
import {
  type ContentImporter,
  importCalls,
  type ImportStore,
  type ImportSubject,
  importStateOf,
  type ImportWrites,
  topicsFor,
  topicsInOrder,
} from "@/services/content-import.core";
import type { Question, Quiz } from "@/services/content.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's quiz import (Phase 3, ticket 09; spec, Phase 3 →
// Spreadsheet import, Corrections never cost progress; stories 119–124,
// 133l), shared by both arms: the shared import (content-import.core.ts) with
// the quiz rows (src/lib/content-import/quizzes.ts). A Topic's questions go
// in its quiz, which the import makes, Hidden and with the default settings,
// when it has none. Replace keeps the id of each question whose text is
// unchanged, and never deletes a question: those no row matches are marked
// removed (`removedAt`, their place cleared), so every Member's attempts that
// answered them, and their Best Scores, keep them. The quiz keeps its id and
// settings. Each figure goes under its quiz in the private content bucket.
// ─────────────────────────────────────────────────────────────────────────────

/** A Subject, with its Topics in order, their quizzes, and the questions in those quizzes. */
export interface SubjectQuizzes extends ImportSubject {
  quizzes: Quiz[];
  /** The questions in the quizzes, removed ones left out. */
  questions: Question[];
}

/** Everything a confirmed quiz import changes, worked out before anything is saved. */
export interface QuizImportWrites extends ImportWrites {
  /** The quizzes it creates: Hidden, not Free Preview, with the default settings. */
  quizzes: Quiz[];
  inserted: Question[];
  updated: Question[];
  /** The questions Replace takes out of their quizzes, kept and marked removed at `removedAt`. */
  removed: string[];
  removedAt: string;
}

export type QuizImportStore = ImportStore<SubjectQuizzes, QuizImportWrites>;

const byPosition = (a: Question, b: Question) =>
  (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id);

/** Pure: a Subject's Topics as the planner reads them, each with its quiz and questions in order. */
function existingTopicsOf(subject: SubjectQuizzes): ExistingQuizTopic[] {
  return topicsInOrder(subject.topics).map((topic) => {
    const quiz = subject.quizzes.find((candidate) => candidate.topicId === topic.id) ?? null;
    const questions = quiz
      ? subject.questions
          .filter((question) => question.quizId === quiz.id && question.removedAt === null)
          .sort(byPosition)
      : [];
    return {
      id: topic.id,
      name: topic.name,
      content: quiz ? { id: quiz.id, visibility: quiz.visibility } : null,
      items: questions.map(({ id, question, choices, correct, explanation, figure }) => ({
        id,
        question,
        choices,
        correct,
        explanation,
        image: figure,
      })),
    };
  });
}

/**
 * Pure: everything a quiz plan with no problems changes. Replace gives a
 * quiz the CSV's order and marks the questions it takes out removed, keeping
 * their figures for old attempts; Add puts the new questions after the
 * existing ones. Each figure gets a new path under its quiz, so a stored file
 * is never overwritten; a replaced question's old figure is no longer used.
 */
function writesOf(
  subject: SubjectQuizzes,
  planned: ImportPlan<QuestionFields>,
  newId: () => string,
  now: Date,
): QuizImportWrites {
  const topics = topicsFor(subject, newId);
  const writes: QuizImportWrites = {
    topics: topics.created,
    quizzes: [],
    inserted: [],
    updated: [],
    removed: [],
    removedAt: now.toISOString(),
    images: [],
    staleImages: [],
    result: { topics: [] },
  };
  const questionsById = new Map(subject.questions.map((question) => [question.id, question]));

  for (const topicPlan of planned.topics) {
    const topicId = topics.idOf(topicPlan);
    let quizId = topicPlan.content?.id ?? null;
    if (!quizId) {
      quizId = newId();
      writes.quizzes.push({
        id: quizId,
        topicId,
        visibility: "hidden",
        freePreview: false,
        ...DEFAULT_QUIZ_SETTINGS,
      });
    }
    const last = subject.questions.reduce(
      (highest, question) =>
        question.quizId === quizId && question.position !== null
          ? Math.max(highest, question.position)
          : highest,
      0,
    );
    const first = topicPlan.mode === "replace" ? 1 : last + 1;

    topicPlan.items.forEach((planned, index) => {
      let figure: string | null = null;
      if (planned.image) {
        const contentType = cardImageType(planned.image);
        if (!contentType) throw new Error(`“${planned.image}” isn’t an image the planner allows.`);
        figure = quizFigurePath(quizId, newId(), contentType);
        writes.images.push({ path: figure, entry: planned.image, contentType });
      }
      const question: Question = {
        id: planned.existingId ?? newId(),
        quizId,
        position: first + index,
        question: planned.question,
        choices: { ...planned.choices },
        correct: planned.correct,
        explanation: planned.explanation,
        figure,
        removedAt: null,
      };
      const before = planned.existingId ? questionsById.get(planned.existingId) : undefined;
      if (!before) {
        writes.inserted.push(question);
        return;
      }
      if (before.figure) writes.staleImages.push(before.figure);
      const unchanged =
        planned.change === "keep" && before.position === question.position && !before.figure;
      if (!unchanged) writes.updated.push(question);
    });
    // Kept, with their figures, for the attempts that answered them.
    writes.removed.push(...topicPlan.removed);
    writes.result.topics.push({
      topicId,
      contentId: quizId,
      name: topicPlan.name,
      created: topicPlan.topicId === null,
      counts: topicPlan.counts,
    } satisfies ImportTopicResult);
  }
  return writes;
}

const QUIZ_IMPORTER: ContentImporter<SubjectQuizzes, QuestionFields, QuizImportWrites> = {
  rows: QUIZ_IMPORT,
  activity: { entity: "quiz-import", contentKey: "quizId" },
  existingTopics: existingTopicsOf,
  writesOf,
};

/** Pure: what the Subject's Topics, quizzes and questions are, as one hash (importStateOf). */
export const quizSubjectStateOf = (subject: SubjectQuizzes) =>
  importStateOf(QUIZ_IMPORTER, subject);

/** The quiz import's two calls, on an arm's store. */
export function quizImportCalls(store: QuizImportStore) {
  const { plan, confirm } = importCalls(QUIZ_IMPORTER, store);
  return { planQuizImport: plan, confirmQuizImport: confirm };
}
