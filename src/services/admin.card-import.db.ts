import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

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
  type SubjectCards,
  subjectStateOf,
} from "@/services/card-import.core";
import { cardFromRow, cardToRow } from "@/services/content.rows";
import { sampleContentFiles } from "@/services/uploads.mock";
import { storageArm } from "@/services/uploads.storage";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's card import on Postgres (Phase 3, ticket 06): the shared
// import (src/services/card-import.core.ts), reading one Subject's Topics,
// decks and cards with Drizzle rather than the whole content as the rest of
// the database arm does (a Subject can hold thousands of cards). A save runs
// in one transaction, which takes the content write lock (the one Topic
// writes take), reads the Subject again and saves nothing if it changed,
// then writes the Topics, decks, cards and Staff Activity. A failure at any
// step rolls back every row. Cards are upserted, never deleted and
// re-inserted, so the cards Replace keeps hold on to their Members' Card
// Marks.
// Files go to Storage's private content bucket, or, without Storage
// (database tests with no secret key), to the sample data's, as the rest of
// the database arm does.
// ─────────────────────────────────────────────────────────────────────────────

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** How many cards go in one insert: 8 values each, well under Postgres's 65,535. */
const CHUNK = 1000;

/** A Subject with its Topics, their decks and cards, read on `db`. */
async function readSubject(
  db: Database | Transaction,
  examCode: string,
  subjectCode: string,
): Promise<SubjectCards | null> {
  const { exams, subjects, topics, decks, cards } = schema;
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
  const topicIds = topicRows.map((topic) => topic.id);
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
  return {
    exam: { code: examCode, name: found.examName },
    subject: { code: subjectCode, name: found.subjectName },
    topics: topicRows.map((row) => ({ ...row })),
    decks: deckRows.map((row) => ({ ...row })),
    cards: cardRows.map(cardFromRow),
  };
}

/** A card's every column but its id, from the row an upsert offered. */
const fromExcluded = (column: string) => sql.raw(`excluded."${column}"`);

const databaseCardImportStore: CardImportStore = {
  read: async (examCode, subjectCode) => {
    try {
      return await readSubject(getDb(), examCode, subjectCode);
    } catch (error) {
      throw asDatabaseError(error);
    }
  },
  files: isStorageConfigured ? storageArm.contentFiles : sampleContentFiles,
  save: async (subject, writes, activity, state) => {
    try {
      return await getDb().transaction(async (tx) => {
        await tx.execute(adminWriteLock("content"));
        const current = await readSubject(tx, subject.exam.code, subject.subject.code);
        if (!current || subjectStateOf(current) !== state) return "conflict" as const;

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
      });
    } catch (error) {
      throw asDatabaseError(error);
    }
  },
};

export const { planCardImport, confirmCardImport } = cardImportCalls(databaseCardImportStore);
