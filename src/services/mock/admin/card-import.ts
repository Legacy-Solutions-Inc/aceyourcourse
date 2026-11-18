import {
  cardImportCalls,
  type CardImportStore,
  type SubjectCards,
  subjectStateOf,
} from "@/services/card-import.core";
import { topicsOf } from "@/services/content.rules";
import { getSampleStore } from "@/services/mock/sample-store";
import { sampleContentFiles } from "@/services/uploads.mock";

// ─────────────────────────────────────────────────────────────────────────────
// The sample arm of the Admin seam's card import (Phase 3, ticket 06): the
// shared import (src/services/card-import.core.ts) over the in-memory sample
// store, with the sample data's private content bucket. A save checks the
// Subject and applies every change with no await in between, so no other
// request can come between them; should any part of it fail, the parts
// already applied are put back.
// ─────────────────────────────────────────────────────────────────────────────

/** A Subject with its Topics, their decks and cards, as the store holds them now. */
function readSubject(examCode: string, subjectCode: string): SubjectCards | null {
  const store = getSampleStore();
  const exam = store.catalogue.exams.find((candidate) => candidate.code === examCode);
  const subject = exam?.subjects.find((candidate) => candidate.code === subjectCode);
  if (!exam || !subject) return null;
  const topics = topicsOf(store.topics, exam.code, subject.code);
  const topicIds = new Set(topics.map((topic) => topic.id));
  const decks = store.decks.filter((deck) => topicIds.has(deck.topicId));
  const deckIds = new Set(decks.map((deck) => deck.id));
  return structuredClone({
    exam: { code: exam.code, name: exam.name },
    subject: { code: subject.code, name: subject.name },
    topics,
    decks,
    cards: store.cards.filter((card) => deckIds.has(card.deckId)),
  });
}

const sampleCardImportStore: CardImportStore = {
  read: async (examCode, subjectCode) => readSubject(examCode, subjectCode),
  files: sampleContentFiles,
  save: async (subject, writes, activity, state) => {
    const current = readSubject(subject.exam.code, subject.subject.code);
    if (!current || subjectStateOf(current) !== state) return "conflict";

    const store = getSampleStore();
    const { topics, decks, cards, cardMarks } = store;
    const updated = new Map(writes.updated.map((card) => [card.id, card]));
    const removed = new Set(writes.removed);
    try {
      store.topics = [...topics, ...structuredClone(writes.topics)];
      store.decks = [...decks, ...structuredClone(writes.decks)];
      store.cards = [
        ...cards
          .filter((card) => !removed.has(card.id))
          .map((card) => structuredClone(updated.get(card.id) ?? card)),
        ...structuredClone(writes.inserted),
      ];
      // A removed card's marks go with it, as the database's cascade deletes them.
      store.cardMarks = cardMarks.filter((mark) => !removed.has(mark.cardId));
      store.staffActivity = [...store.staffActivity, structuredClone(activity)];
    } catch (error) {
      store.topics = topics;
      store.decks = decks;
      store.cards = cards;
      store.cardMarks = cardMarks;
      throw error;
    }
    return "saved";
  },
};

export const { planCardImport, confirmCardImport } = cardImportCalls(sampleCardImportStore);
