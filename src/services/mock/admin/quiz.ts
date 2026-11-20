import type { RecordStamp } from "@/services/admin.types";
import { getSampleStore } from "@/services/mock/sample-store";
import {
  questionRecordOf,
  quizEditorCalls,
  type QuizEditorStore,
  type QuizKey,
  quizRecordOf,
  type QuizWrites,
  type TopicQuiz,
} from "@/services/quiz-editor.core";
import { sampleContentFiles } from "@/services/uploads.mock";

// ─────────────────────────────────────────────────────────────────────────────
// The sample arm of the Admin seam's quiz screen and question editor (Phase
// 3, tickets 09 and 10): the shared calls (src/services/quiz-editor.core.ts)
// over the in-memory sample store, with the sample data's private content
// bucket. A save reads the quiz and applies its writes with no await in
// between, so no other request can come between them; should any part of it
// fail, the parts already applied are put back. A question is never deleted:
// one taken out of its quiz stays in the store, marked removed.
// ─────────────────────────────────────────────────────────────────────────────

/** The Topic a key names: its own id, its quiz's Topic, or its question's quiz's Topic. */
function topicIdOf(key: QuizKey): string | undefined {
  const { quizzes, questions } = getSampleStore();
  if ("topic" in key) return key.topic;
  const quizId =
    "quiz" in key
      ? key.quiz
      : questions.find((question) => question.id === key.question && question.removedAt === null)
          ?.quizId;
  return quizzes.find((quiz) => quiz.id === quizId)?.topicId;
}

/** A Topic's quiz and questions, as the store holds them now, or null when the key names nothing. */
function readQuiz(key: QuizKey): TopicQuiz | null {
  const store = getSampleStore();
  const topic = store.topics.find((candidate) => candidate.id === topicIdOf(key));
  const exam = store.catalogue.exams.find((candidate) => candidate.code === topic?.examCode);
  const subject = exam?.subjects.find((candidate) => candidate.code === topic?.subjectCode);
  if (!topic || !exam || !subject) return null;
  const quiz = store.quizzes.find((candidate) => candidate.topicId === topic.id) ?? null;
  const questions = quiz
    ? store.questions
        .filter((question) => question.quizId === quiz.id && question.removedAt === null)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id))
    : [];
  const questionStamps: Record<string, RecordStamp> = {};
  for (const question of questions) {
    const stamp = store.stamps[questionRecordOf(question.id)];
    if (stamp) questionStamps[question.id] = stamp;
  }
  return structuredClone({
    exam: { code: exam.code, name: exam.name },
    subject: { code: subject.code, name: subject.name },
    topic,
    quiz,
    questions,
    stamp: quiz ? (store.stamps[quizRecordOf(quiz.id)] ?? null) : null,
    questionStamps,
    seededAt: store.bootedAt,
  });
}

/** Applies a save's writes to the store, all or none. */
function apply(writes: QuizWrites): void {
  const store = getSampleStore();
  const { quizzes, questions, stamps, staffActivity } = store;
  const changed = new Map(
    writes.questions.map((question) => [question.id, structuredClone(question)]),
  );
  try {
    const quiz = writes.quiz;
    if (quiz) {
      const value = structuredClone(quiz.value);
      store.quizzes = quiz.isNew
        ? [...quizzes, value]
        : quizzes.map((candidate) => (candidate.id === value.id ? value : candidate));
    }
    const kept = questions.map((question) => changed.get(question.id) ?? question);
    const added = [...changed.values()].filter(
      (question) => !questions.some((existing) => existing.id === question.id),
    );
    store.questions = [...kept, ...added];
    const next = { ...stamps };
    if (quiz && writes.stamp) next[quizRecordOf(quiz.value.id)] = writes.stamp;
    for (const [id, stamp] of Object.entries(writes.questionStamps)) {
      next[questionRecordOf(id)] = stamp;
    }
    store.stamps = next;
    store.staffActivity = [...staffActivity, ...structuredClone(writes.activity)];
  } catch (error) {
    store.quizzes = quizzes;
    store.questions = questions;
    store.stamps = stamps;
    throw error;
  }
}

const sampleQuizStore: QuizEditorStore = {
  read: async (key) => readQuiz(key),
  files: sampleContentFiles,
  save: async (key, plan) => {
    const planned = plan(readQuiz(key));
    if (planned.ok && planned.writes) apply(planned.writes);
    return planned;
  },
};

export const {
  getQuizForAdmin,
  getQuestionFigureForAdmin,
  updateQuizSettings,
  setQuizVisibility,
  setQuizFreePreview,
  createQuestion,
  updateQuestion,
  moveQuestion,
  deleteQuestion,
} = quizEditorCalls(sampleQuizStore);
