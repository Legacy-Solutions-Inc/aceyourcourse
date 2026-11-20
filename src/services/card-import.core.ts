import { cardImagePath, cardImageType } from "@/lib/cards/card-rules";
import { CARD_IMPORT, type CardFields, type ExistingCardTopic } from "@/lib/content-import/cards";
import type { ImportPlan } from "@/lib/content-import/plan";
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
import type { Card, Deck } from "@/services/content.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's card import (Phase 3, ticket 06; spec, Phase 3 →
// Spreadsheet import; stories 118, 120–124, 133p), shared by both arms: the
// shared import (content-import.core.ts) with the card rows
// (src/lib/content-import/cards.ts). A Topic's cards go in its deck, which
// the import makes, Hidden, when it has none. Replace keeps the id of each
// card whose front is unchanged, so its Members' Card Marks stay with it,
// and deletes the cards no row matches (their marks go with them). Each
// card's image goes under its deck in the private content bucket.
// ─────────────────────────────────────────────────────────────────────────────

/** A Subject, with its Topics in order, their decks, and those decks' cards. */
export interface SubjectCards extends ImportSubject {
  decks: Deck[];
  cards: Card[];
}

/** Everything a confirmed card import changes, worked out before anything is saved. */
export interface CardImportWrites extends ImportWrites {
  /** The decks it creates, all Hidden. */
  decks: Deck[];
  inserted: Card[];
  updated: Card[];
  /** The ids of the cards Replace removes. */
  removed: string[];
}

export type CardImportStore = ImportStore<SubjectCards, CardImportWrites>;

/** Pure: a Subject's Topics as the planner reads them, each with its deck and cards in order. */
function existingTopicsOf(subject: SubjectCards): ExistingCardTopic[] {
  return topicsInOrder(subject.topics).map((topic) => {
    const deck = subject.decks.find((candidate) => candidate.topicId === topic.id) ?? null;
    const cards = deck
      ? subject.cards
          .filter((card) => card.deckId === deck.id)
          .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      : [];
    return {
      id: topic.id,
      name: topic.name,
      content: deck ? { id: deck.id, visibility: deck.visibility } : null,
      items: cards.map(({ id, front, back, note, image }) => ({ id, front, back, note, image })),
    };
  });
}

/**
 * Pure: everything a card plan with no problems changes. Replace gives a
 * deck the CSV's order, Add puts the new cards after the existing ones. Each
 * image gets a new path under its deck, so a stored file is never
 * overwritten; a replaced or removed card's old image is no longer used.
 */
function writesOf(
  subject: SubjectCards,
  planned: ImportPlan<CardFields>,
  newId: () => string,
): CardImportWrites {
  const topics = topicsFor(subject, newId);
  const writes: CardImportWrites = {
    topics: topics.created,
    decks: [],
    inserted: [],
    updated: [],
    removed: [],
    images: [],
    staleImages: [],
    result: { topics: [] },
  };
  const cardsById = new Map(subject.cards.map((card) => [card.id, card]));

  for (const topicPlan of planned.topics) {
    const topicId = topics.idOf(topicPlan);
    let deckId = topicPlan.content?.id ?? null;
    if (!deckId) {
      deckId = newId();
      writes.decks.push({ id: deckId, topicId, visibility: "hidden", freePreview: false });
    }
    const last = subject.cards.reduce(
      (highest, card) => (card.deckId === deckId ? Math.max(highest, card.position) : highest),
      0,
    );
    const first = topicPlan.mode === "replace" ? 1 : last + 1;

    topicPlan.items.forEach((planned, index) => {
      let image: string | null = null;
      if (planned.image) {
        const contentType = cardImageType(planned.image);
        if (!contentType) throw new Error(`“${planned.image}” isn’t an image the planner allows.`);
        image = cardImagePath(deckId, newId(), contentType);
        writes.images.push({ path: image, entry: planned.image, contentType });
      }
      const card: Card = {
        id: planned.existingId ?? newId(),
        deckId,
        position: first + index,
        front: planned.front,
        back: planned.back,
        note: planned.note,
        image,
      };
      const before = planned.existingId ? cardsById.get(planned.existingId) : undefined;
      if (!before) {
        writes.inserted.push(card);
        return;
      }
      if (before.image) writes.staleImages.push(before.image);
      const unchanged =
        planned.change === "keep" && before.position === card.position && !before.image;
      if (!unchanged) writes.updated.push(card);
    });
    for (const id of topicPlan.removed) {
      writes.removed.push(id);
      const image = cardsById.get(id)?.image;
      if (image) writes.staleImages.push(image);
    }
    writes.result.topics.push({
      topicId,
      contentId: deckId,
      name: topicPlan.name,
      created: topicPlan.topicId === null,
      counts: topicPlan.counts,
    } satisfies ImportTopicResult);
  }
  return writes;
}

const CARD_IMPORTER: ContentImporter<SubjectCards, CardFields, CardImportWrites> = {
  rows: CARD_IMPORT,
  activity: { entity: "card-import", contentKey: "deckId" },
  existingTopics: existingTopicsOf,
  writesOf,
};

/** Pure: what the Subject's Topics and cards are, as one hash (importStateOf). */
export const cardSubjectStateOf = (subject: SubjectCards) => importStateOf(CARD_IMPORTER, subject);

/** The card import's two calls, on an arm's store. */
export function cardImportCalls(store: CardImportStore) {
  const { plan, confirm } = importCalls(CARD_IMPORTER, store);
  return { planCardImport: plan, confirmCardImport: confirm };
}
