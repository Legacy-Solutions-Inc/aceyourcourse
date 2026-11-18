import "server-only";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { adminWriteLock } from "@/lib/db/admin-locks";
import { getDb } from "@/lib/db/client";
import type { Database } from "@/lib/db/connect";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { isStorageConfigured } from "@/lib/supabase/admin";
import { staffActivityToRow } from "@/services/admin.rows";
import {
  cardImportCalls,
  type CardImportStore,
  cardSubjectStateOf,
  type SubjectCards,
} from "@/services/card-import.core";
import type { ImportSubject } from "@/services/content-import.core";
import { cardFromRow, cardToRow, questionFromRow, questionToRow } from "@/services/content.rows";
import {
  quizImportCalls,
  type QuizImportStore,
  quizSubjectStateOf,
  type SubjectQuizzes,
} from "@/services/quiz-import.core";
import { sampleContentFiles } from "@/services/uploads.mock";
import { storageArm } from "@/services/uploads.storage";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's spreadsheet imports on Postgres: cards (Phase 3, ticket
// 06) and quizzes (ticket 09), each the shared import
// (src/services/content-import.core.ts), reading one Subject's Topics and
// what they hold with Drizzle rather than the whole content as the rest of
// the database arm does (a Subject can hold thousands of cards or
// questions). A save runs in one transaction, which takes the content write
// lock (the one Topic writes take), reads the Subject again and saves
// nothing if it changed, then writes the Topics, decks or quizzes, their
// items and Staff Activity. A failure at any step rolls back every row.
// Cards and questions are upserted, never deleted and re-inserted, so the
// cards Replace keeps hold on to their Members' Card Marks and the questions
// to their attempts. A question Replace takes out is only marked removed.
// Files go to Storage's private content bucket, or, without Storage
// (database tests with no secret key), to the sample data's, as the rest of
// the database arm does.
// ─────────────────────────────────────────────────────────────────────────────

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** How many rows go in one insert: well under Postgres's 65,535 values. */
const CHUNK = 1000;

/** A Subject with its Topics in order, read on `db`, or null when it isn't in the catalogue. */
async function readTopics(
  db: Database | Transaction,
  examCode: string,
  subjectCode: string,
): Promise<ImportSubject | null> {
  const { exams, subjects, topics } = schema;
  const [found] = await db
    .select({ examName: exams.name, subjectName: subjects.name })
    .from(subjects)
    .innerJoin(exams, eq(exams.code, subjects.examCode))
    .where(and(eq(subjects.examCode, examCode), eq(subjects.code, subjectCode)));
  if (!found) return null;
  const topicRows = await db
    .select()
    .from(topics)
    .where(and(eq(topics.examCode, examCode), eq(topics.subjectCode, subjectCode)))
    .orderBy(asc(topics.position), asc(topics.id));
  return {
    exam: { code: examCode, name: found.examName },
    subject: { code: subjectCode, name: found.subjectName },
    topics: topicRows.map((row) => ({ ...row })),
  };
}

/** A Subject with its Topics, their decks and cards, read on `db`. */
async function readSubjectCards(
  db: Database | Transaction,
  examCode: string,
  subjectCode: string,
): Promise<SubjectCards | null> {
  const read = await readTopics(db, examCode, subjectCode);
  if (!read) return null;
  const { decks, cards } = schema;
  const topicIds = read.topics.map((topic) => topic.id);
  const deckRows = topicIds.length
    ? await db.select().from(decks).where(inArray(decks.topicId, topicIds))
    : [];
  const deckIds = deckRows.map((deck) => deck.id);
  const cardRows = deckIds.length
    ? await db
        .select()
        .from(cards)
        .where(inArray(cards.deckId, deckIds))
        .orderBy(asc(cards.position), asc(cards.id))
    : [];
  return { ...read, decks: deckRows.map((row) => ({ ...row })), cards: cardRows.map(cardFromRow) };
}

/** A Subject with its Topics, their quizzes and the questions in them (removed ones left out), read on `db`. */
async function readSubjectQuizzes(
  db: Database | Transaction,
  examCode: string,
  subjectCode: string,
): Promise<SubjectQuizzes | null> {
  const read = await readTopics(db, examCode, subjectCode);
  if (!read) return null;
  const { quizzes, questions } = schema;
  const topicIds = read.topics.map((topic) => topic.id);
  const quizRows = topicIds.length
    ? await db.select().from(quizzes).where(inArray(quizzes.topicId, topicIds))
    : [];
  const quizIds = quizRows.map((quiz) => quiz.id);
  const questionRows = quizIds.length
    ? await db
        .select()
        .from(questions)
        .where(and(inArray(questions.quizId, quizIds), isNull(questions.removedAt)))
        .orderBy(asc(questions.position), asc(questions.id))
    : [];
  return {
    ...read,
    quizzes: quizRows.map((row) => ({ ...row })),
    questions: questionRows.map(questionFromRow),
  };
}

/** A column's value as the row an upsert offered has it. */
const fromExcluded = (column: string) => sql.raw(`excluded."${column}"`);

/** Runs a save in one transaction under the content write lock, as a database error if it fails. */
async function underContentLock<T>(save: (tx: Transaction) => Promise<T>): Promise<T> {
  try {
    return await getDb().transaction(async (tx) => {
      await tx.execute(adminWriteLock("content"));
      return save(tx);
    });
  } catch (error) {
    throw asDatabaseError(error);
  }
}

/** Reads on the database, as a database error if it fails. */
async function reading<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    throw asDatabaseError(error);
  }
}

const files = isStorageConfigured ? storageArm.contentFiles : sampleContentFiles;

const databaseCardImportStore: CardImportStore = {
  read: (examCode, subjectCode) => reading(() => readSubjectCards(getDb(), examCode, subjectCode)),
  files,
  save: (subject, writes, activity, state) =>
    underContentLock(async (tx) => {
      const current = await readSubjectCards(tx, subject.exam.code, subject.subject.code);
      if (!current || cardSubjectStateOf(current) !== state) return "conflict" as const;

      if (writes.topics.length) await tx.insert(schema.topics).values(writes.topics);
      if (writes.decks.length) await tx.insert(schema.decks).values(writes.decks);
      if (writes.removed.length) {
        await tx.delete(schema.cards).where(inArray(schema.cards.id, writes.removed));
      }
      const rows = [...writes.updated, ...writes.inserted].map(cardToRow);
      for (let start = 0; start < rows.length; start += CHUNK) {
        await tx
          .insert(schema.cards)
          .values(rows.slice(start, start + CHUNK))
          .onConflictDoUpdate({
            target: schema.cards.id,
            set: {
              deckId: fromExcluded("deck_id"),
              position: fromExcluded("position"),
              front: fromExcluded("front"),
              back: fromExcluded("back"),
              note: fromExcluded("note"),
              imagePath: fromExcluded("image_path"),
              frontHash: fromExcluded("front_hash"),
            },
          });
      }
      await tx.insert(schema.staffActivity).values(staffActivityToRow(activity));
      return "saved" as const;
    }),
};

const databaseQuizImportStore: QuizImportStore = {
  read: (examCode, subjectCode) =>
    reading(() => readSubjectQuizzes(getDb(), examCode, subjectCode)),
  files,
  save: (subject, writes, activity, state) =>
    underContentLock(async (tx) => {
      const current = await readSubjectQuizzes(tx, subject.exam.code, subject.subject.code);
      if (!current || quizSubjectStateOf(current) !== state) return "conflict" as const;

      const { questions } = schema;
      if (writes.topics.length) await tx.insert(schema.topics).values(writes.topics);
      if (writes.quizzes.length) await tx.insert(schema.quizzes).values(writes.quizzes);
      if (writes.removed.length) {
        // Kept, for the attempts that answered them: out of the quiz's order, marked removed.
        await tx
          .update(questions)
          .set({ position: null, removedAt: new Date(writes.removedAt) })
          .where(inArray(questions.id, writes.removed));
      }
      const rows = [...writes.updated, ...writes.inserted].map(questionToRow);
      for (let start = 0; start < rows.length; start += CHUNK) {
        await tx
          .insert(questions)
          .values(rows.slice(start, start + CHUNK))
          .onConflictDoUpdate({
            target: questions.id,
            set: {
              position: fromExcluded("position"),
              question: fromExcluded("question"),
              choiceA: fromExcluded("choice_a"),
              choiceB: fromExcluded("choice_b"),
              choiceC: fromExcluded("choice_c"),
              choiceD: fromExcluded("choice_d"),
              correctChoice: fromExcluded("correct_choice"),
              explanation: fromExcluded("explanation"),
              figurePath: fromExcluded("figure_path"),
            },
          });
      }
      await tx.insert(schema.staffActivity).values(staffActivityToRow(activity));
      return "saved" as const;
    }),
};

export const { planCardImport, confirmCardImport } = cardImportCalls(databaseCardImportStore);
export const { planQuizImport, confirmQuizImport } = quizImportCalls(databaseQuizImportStore);
