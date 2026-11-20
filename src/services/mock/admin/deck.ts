import type { RecordStamp } from "@/services/admin.types";
import {
  cardRecordOf,
  type DeckEditorStore,
  deckEditorCalls,
  type DeckKey,
  type DeckWrites,
  type TopicDeck,
} from "@/services/deck-editor.core";
import { getSampleStore } from "@/services/mock/sample-store";
import { sampleContentFiles } from "@/services/uploads.mock";

// ─────────────────────────────────────────────────────────────────────────────
// The sample arm of the Admin seam's card editor (Phase 3, ticket 07): the
// shared editor (src/services/deck-editor.core.ts) over the in-memory sample
// store, with the sample data's private content bucket. A save reads the deck
// and applies its writes with no await in between, so no other request can
// come between them; should any part of it fail, the parts already applied
// are put back. A deleted card's Card Marks go with it, as the database's
// cascade deletes them.
// ─────────────────────────────────────────────────────────────────────────────

/** The Topic a key names: its own id, its deck's Topic, or its card's deck's Topic. */
function topicIdOf(key: DeckKey): string | undefined {
  const { decks, cards } = getSampleStore();
  if ("topic" in key) return key.topic;
  const deckId = "deck" in key ? key.deck : cards.find((card) => card.id === key.card)?.deckId;
  return decks.find((deck) => deck.id === deckId)?.topicId;
}

/** A Topic's deck and cards, as the store holds them now, or null when the key names nothing. */
function readDeck(key: DeckKey): TopicDeck | null {
  const store = getSampleStore();
  const topic = store.topics.find((candidate) => candidate.id === topicIdOf(key));
  const exam = store.catalogue.exams.find((candidate) => candidate.code === topic?.examCode);
  const subject = exam?.subjects.find((candidate) => candidate.code === topic?.subjectCode);
  if (!topic || !exam || !subject) return null;
  const deck = store.decks.find((candidate) => candidate.topicId === topic.id) ?? null;
  const cards = deck
    ? store.cards
        .filter((card) => card.deckId === deck.id)
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    : [];
  const stamps: Record<string, RecordStamp> = {};
  for (const card of cards) {
    const stamp = store.stamps[cardRecordOf(card.id)];
    if (stamp) stamps[card.id] = stamp;
  }
  return structuredClone({
    exam: { code: exam.code, name: exam.name },
    subject: { code: subject.code, name: subject.name },
    topic,
    deck,
    cards,
    stamps,
    seededAt: store.bootedAt,
  });
}

/** Applies a save's writes to the store, all or none. */
function apply(writes: DeckWrites): void {
  const store = getSampleStore();
  const { decks, cards, cardMarks, stamps, staffActivity } = store;
  const removed = new Set(writes.removed);
  const changed = new Map(writes.cards.map((card) => [card.id, structuredClone(card)]));
  try {
    const deck = writes.deck;
    if (deck) {
      const value = structuredClone(deck.value);
      store.decks = deck.isNew
        ? [...decks, value]
        : decks.map((candidate) => (candidate.id === value.id ? value : candidate));
    }
    const kept = cards
      .filter((card) => !removed.has(card.id))
      .map((card) => changed.get(card.id) ?? card);
    const added = [...changed.values()].filter((card) => !cards.some((c) => c.id === card.id));
    store.cards = [...kept, ...added];
    store.cardMarks = cardMarks.filter((mark) => !removed.has(mark.cardId));
    const next = { ...stamps };
    for (const id of removed) delete next[cardRecordOf(id)];
    for (const [id, stamp] of Object.entries(writes.stamps)) next[cardRecordOf(id)] = stamp;
    store.stamps = next;
    store.staffActivity = [...staffActivity, ...structuredClone(writes.activity)];
  } catch (error) {
    store.decks = decks;
    store.cards = cards;
    store.cardMarks = cardMarks;
    store.stamps = stamps;
    throw error;
  }
}

const sampleDeckStore: DeckEditorStore = {
  read: async (key) => readDeck(key),
  files: sampleContentFiles,
  save: async (key, plan) => {
    const planned = plan(readDeck(key));
    if (planned.ok && planned.writes) apply(planned.writes);
    return planned;
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
} = deckEditorCalls(sampleDeckStore);
