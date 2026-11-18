import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { adminWriteLock } from "@/lib/db/admin-locks";
import { getDb } from "@/lib/db/client";
import type { Database } from "@/lib/db/connect";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { isStorageConfigured } from "@/lib/supabase/admin";
import { SEEDED_RECORD, staffActivityToRow, stampsFromRows } from "@/services/admin.rows";
import { questionFromRow } from "@/services/content.rows";
import {
  quizEditorCalls,
  type QuizEditorStore,
  type QuizKey,
  quizRecordOf,
  type TopicQuiz,
} from "@/services/quiz-editor.core";
import { sampleContentFiles } from "@/services/uploads.mock";
import { storageArm } from "@/services/uploads.storage";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's quiz screen on Postgres (Phase 3, ticket 09): the shared
// calls (src/services/quiz-editor.core.ts), reading one Topic's quiz and its
// questions with Drizzle rather than the whole content, as the card editor
// does. A save runs in one transaction, which takes the content write lock
// (the one Topic writes and the imports take), reads the quiz again, and
// writes the quiz's settings, their stamp and Staff Activity. A failure at
// any step rolls back every row.
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
  const records = [SEEDED_RECORD, ...(quiz ? [quizRecordOf(quiz.id)] : [])];
  const stampRows = await db
    .select()
    .from(recordStamps)
    .where(inArray(recordStamps.record, records));
  const { seededAt, stamps } = stampsFromRows(stampRows);
  const { topic } = found;
  return {
    exam: { code: topic.examCode, name: found.examName },
    subject: { code: topic.subjectCode, name: found.subjectName },
    topic: { ...topic },
    quiz: quiz ? { ...quiz } : null,
    questions: questionRows.map(questionFromRow),
    stamp: quiz ? (stamps[quizRecordOf(quiz.id)] ?? null) : null,
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
        const { quiz, stamp, activity } = planned.writes;
        const { visibility, freePreview, passingScore, shuffle, showAnswers } = quiz;
        await tx
          .update(schema.quizzes)
          .set({ visibility, freePreview, passingScore, shuffle, showAnswers })
          .where(eq(schema.quizzes.id, quiz.id));
        if (stamp) {
          const row = {
            record: quizRecordOf(quiz.id),
            updatedAt: new Date(stamp.savedAt),
            updatedBy: stamp.savedBy,
          };
          await tx
            .insert(schema.recordStamps)
            .values(row)
            .onConflictDoUpdate({
              target: schema.recordStamps.record,
              set: { updatedAt: row.updatedAt, updatedBy: row.updatedBy },
            });
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
} = quizEditorCalls(databaseQuizStore);
