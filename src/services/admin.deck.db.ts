import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { adminWriteLock } from "@/lib/db/admin-locks";
import { getDb } from "@/lib/db/client";
import type { Database } from "@/lib/db/connect";
import { asDatabaseError } from "@/lib/db/errors";
import { setStamp } from "@/lib/db/record-stamps";
import * as schema from "@/lib/db/schema";
import { fromExcluded } from "@/lib/db/upsert";
import { isStorageConfigured } from "@/lib/supabase/admin";
import { SEEDED_RECORD, staffActivityToRow, stampsFromRows } from "@/services/admin.rows";
import type { RecordStamp } from "@/services/admin.types";
import { cardFromRow, cardToRow } from "@/services/content.rows";
import {
  cardRecordOf,
  type DeckEditorStore,
  deckEditorCalls,
  type DeckKey,
  type TopicDeck,
} from "@/services/deck-editor.core";
import { sampleContentFiles } from "@/services/uploads.mock";
import { storageArm } from "@/services/uploads.storage";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's card editor on Postgres (Phase 3, ticket 07): the shared
// editor (src/services/deck-editor.core.ts), reading one Topic's deck and its
// cards with Drizzle rather than the whole content, as the card import does.
// A save runs in one transaction, which takes the content write lock (the one
// Topic writes and the card import take), reads the deck again, and writes
// the deck, the cards, their stamps and Staff Activity. A failure at any step
// rolls back every row. Deleting a card deletes every Member's Card Mark on
// it (card_marks cascades). Cards are upserted, so a card keeps its id and
// its marks while it moves or is edited.
// Files go to Storage's private content bucket, or, without Storage
// (database tests with no secret key), to the sample data's, as the rest of
// the database arm does.
// ─────────────────────────────────────────────────────────────────────────────

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** The Topic a key names: its own id, its deck's Topic, or its card's deck's Topic. */
async function topicIdOf(db: Database | Transaction, key: DeckKey): Promise<string | null> {
  const { decks, cards } = schema;
  if ("topic" in key) return key.topic;
  const [found] =
    "deck" in key
      ? await db.select({ topicId: decks.topicId }).from(decks).where(eq(decks.id, key.deck))
      : await db
          .select({ topicId: decks.topicId })
          .from(cards)
          .innerJoin(decks, eq(decks.id, cards.deckId))
          .where(eq(cards.id, key.card));
  return found?.topicId ?? null;
}

/** A Topic's deck and cards, read on `db`, or null when the key names nothing. */
async function readDeck(db: Database | Transaction, key: DeckKey): Promise<TopicDeck | null> {
  const { exams, subjects, topics, decks, cards, recordStamps } = schema;
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
  const [deck] = await db.select().from(decks).where(eq(decks.topicId, topicId));
  const cardRows = deck
    ? await db
        .select()
        .from(cards)
        .where(eq(cards.deckId, deck.id))
        .orderBy(asc(cards.position), asc(cards.id))
    : [];
  const records = [SEEDED_RECORD, ...cardRows.map((card) => cardRecordOf(card.id))];
  const stampRows = await db
    .select()
    .from(recordStamps)
    .where(inArray(recordStamps.record, records));
  const { seededAt, stamps: byRecord } = stampsFromRows(stampRows);
  const stamps: Record<string, RecordStamp> = {};
  for (const card of cardRows) {
    const stamp = byRecord[cardRecordOf(card.id)];
    if (stamp) stamps[card.id] = stamp;
  }
  const { topic } = found;
  return {
    exam: { code: topic.examCode, name: found.examName },
    subject: { code: topic.subjectCode, name: found.subjectName },
    topic: { ...topic },
    deck: deck ? { ...deck } : null,
    cards: cardRows.map(cardFromRow),
    stamps,
    seededAt,
  };
}

const databaseDeckStore: DeckEditorStore = {
  read: async (key) => {
    try {
      return await getDb().transaction((tx) => readDeck(tx, key), {
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
        const planned = plan(await readDeck(tx, key));
        if (!planned.ok || !planned.writes) return planned;
        const { deck, cards, removed, stamps, activity } = planned.writes;
        const { decks, recordStamps } = schema;

        if (deck?.isNew) await tx.insert(decks).values(deck.value);
        else if (deck) {
          const { visibility, freePreview } = deck.value;
          await tx
            .update(decks)
            .set({ visibility, freePreview })
            .where(eq(decks.id, deck.value.id));
        }
        if (removed.length > 0) {
          // Each card's Card Marks go with it: card_marks cascades.
          await tx.delete(schema.cards).where(inArray(schema.cards.id, removed));
          await tx
            .delete(recordStamps)
            .where(inArray(recordStamps.record, removed.map(cardRecordOf)));
        }
        if (cards.length > 0) {
          await tx
            .insert(schema.cards)
            .values(cards.map(cardToRow))
            .onConflictDoUpdate({
              target: schema.cards.id,
              set: {
                position: fromExcluded("position"),
                front: fromExcluded("front"),
                back: fromExcluded("back"),
                note: fromExcluded("note"),
                imagePath: fromExcluded("image_path"),
                frontHash: fromExcluded("front_hash"),
              },
            });
        }
        for (const [cardId, stamp] of Object.entries(stamps)) {
          await setStamp(tx, cardRecordOf(cardId), stamp);
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
  getDeckForAdmin,
  getCardImageForAdmin,
  createCard,
  updateCard,
  moveCard,
  deleteCard,
  setDeckVisibility,
  setDeckFreePreview,
} = deckEditorCalls(databaseDeckStore);
