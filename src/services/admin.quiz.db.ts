import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { adminWriteLock } from "@/lib/db/admin-locks";
import { getDb } from "@/lib/db/client";
import type { Database } from "@/lib/db/connect";
import { asDatabaseError } from "@/lib/db/errors";
import { setStamp } from "@/lib/db/record-stamps";
import * as schema from "@/lib/db/schema";
import { QUESTION_UPSERT_SET } from "@/lib/db/upsert";
import { isStorageConfigured } from "@/lib/supabase/admin";
import { SEEDED_RECORD, staffActivityToRow, stampsFromRows } from "@/services/admin.rows";
import type { RecordStamp } from "@/services/admin.types";
import { questionFromRow, questionToRow } from "@/services/content.rows";
import {
  questionRecordOf,
  quizEditorCalls,
  type QuizEditorStore,
  type QuizKey,
  quizRecordOf,
  type TopicQuiz,
} from "@/services/quiz-editor.core";
import { sampleContentFiles } from "@/services/uploads.mock";
import { storageArm } from "@/services/uploads.storage";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's quiz screen and question editor on Postgres (Phase 3,
// tickets 09 and 10): the shared calls (src/services/quiz-editor.core.ts),
// reading one Topic's quiz and its questions with Drizzle rather than the
// whole content, as the card editor does. A save runs in one transaction,
// which takes the content write lock (the one Topic writes and the imports
// take), reads the quiz again, and writes the quiz (made, or its settings),
// the questions, their stamps and Staff Activity. A failure at any step rolls
// back every row. Questions are upserted, so a question keeps its id, and
// every Member's attempts that answered it, while it moves, is edited or is
// taken out of the quiz: a removed one is never deleted, only marked
// removed (`removed_at`, its place cleared).
// Files are read from Storage's private content bucket, or, without Storage
// (database tests with no secret key), from the sample data's, as the rest of
// the database arm does.
// ─────────────────────────────────────────────────────────────────────────────

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** The Topic a key names: its own id, its quiz's Topic, or its question's quiz's Topic. */
async function topicIdOf(db: Database | Transaction, key: QuizKey): Promise<string | null> {
  const { quizzes, questions } = schema;
  if ("topic" in key) return key.topic;
  const [found] =
    "quiz" in key
      ? await db.select({ topicId: quizzes.topicId }).from(quizzes).where(eq(quizzes.id, key.quiz))
      : await db
          .select({ topicId: quizzes.topicId })
          .from(questions)
          .innerJoin(quizzes, eq(quizzes.id, questions.quizId))
          .where(and(eq(questions.id, key.question), isNull(questions.removedAt)));
  return found?.topicId ?? null;
}

/** A Topic's quiz and questions, read on `db`, or null when the key names nothing. */
async function readQuiz(db: Database | Transaction, key: QuizKey): Promise<TopicQuiz | null> {
  const { exams, subjects, topics, quizzes, questions, recordStamps } = schema;
  const topicId = await topicIdOf(db, key);
  if (!topicId) return null;
  const [found] = await db
    .select({ topic: topics, examName: exams.name, subjectName: subjects.name })
    .from(topics)
    .innerJoin(
      subjects,
      and(eq(subjects.examCode, topics.examCode), eq(subjects.code, topics.subjectCode)),
    )
    .innerJoin(exams, eq(exams.code, topics.examCode))
    .where(eq(topics.id, topicId));
  if (!found) return null;
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.topicId, topicId));
  const questionRows = quiz
    ? await db
        .select()
        .from(questions)
        .where(and(eq(questions.quizId, quiz.id), isNull(questions.removedAt)))
        .orderBy(asc(questions.position), asc(questions.id))
    : [];
  const records = [
    SEEDED_RECORD,
    ...(quiz ? [quizRecordOf(quiz.id)] : []),
    ...questionRows.map((question) => questionRecordOf(question.id)),
  ];
  const stampRows = await db
    .select()
    .from(recordStamps)
    .where(inArray(recordStamps.record, records));
  const { seededAt, stamps } = stampsFromRows(stampRows);
  const questionStamps: Record<string, RecordStamp> = {};
  for (const question of questionRows) {
    const stamp = stamps[questionRecordOf(question.id)];
    if (stamp) questionStamps[question.id] = stamp;
  }
  const { topic } = found;
  return {
    exam: { code: topic.examCode, name: found.examName },
    subject: { code: topic.subjectCode, name: found.subjectName },
    topic: { ...topic },
    quiz: quiz ? { ...quiz } : null,
    questions: questionRows.map(questionFromRow),
    stamp: quiz ? (stamps[quizRecordOf(quiz.id)] ?? null) : null,
    questionStamps,
    seededAt,
  };
}

const databaseQuizStore: QuizEditorStore = {
  read: async (key) => {
    try {
      return await getDb().transaction((tx) => readQuiz(tx, key), {
        isolationLevel: "repeatable read",
        accessMode: "read only",
      });
    } catch (error) {
      throw asDatabaseError(error);
    }
  },
  files: isStorageConfigured ? storageArm.contentFiles : sampleContentFiles,
  save: async (key, plan) => {
    try {
      return await getDb().transaction(async (tx) => {
        await tx.execute(adminWriteLock("content"));
        const planned = plan(await readQuiz(tx, key));
        if (!planned.ok || !planned.writes) return planned;
        const { quiz, stamp, questions, questionStamps, activity } = planned.writes;
        if (quiz?.isNew) await tx.insert(schema.quizzes).values(quiz.value);
        else if (quiz) {
          const { visibility, freePreview, passingScore, shuffle, showAnswers } = quiz.value;
          await tx
            .update(schema.quizzes)
            .set({ visibility, freePreview, passingScore, shuffle, showAnswers })
            .where(eq(schema.quizzes.id, quiz.value.id));
        }
        if (quiz && stamp) await setStamp(tx, quizRecordOf(quiz.value.id), stamp);
        if (questions.length > 0) {
          await tx
            .insert(schema.questions)
            .values(questions.map(questionToRow))
            .onConflictDoUpdate({ target: schema.questions.id, set: QUESTION_UPSERT_SET });
        }
        for (const [questionId, questionStamp] of Object.entries(questionStamps)) {
          await setStamp(tx, questionRecordOf(questionId), questionStamp);
        }
        if (activity.length > 0) {
          await tx.insert(schema.staffActivity).values(activity.map(staffActivityToRow));
        }
        return planned;
      });
    } catch (error) {
      throw asDatabaseError(error);
    }
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
} = quizEditorCalls(databaseQuizStore);
