import {
  cardImportCalls,
  type CardImportStore,
  type SubjectCards,
  cardSubjectStateOf,
} from "@/services/card-import.core";
import type { ImportSubject } from "@/services/content-import.core";
import { topicsOf } from "@/services/content.rules";
import { getSampleStore } from "@/services/mock/sample-store";
import {
  quizImportCalls,
  type QuizImportStore,
  quizSubjectStateOf,
  type SubjectQuizzes,
} from "@/services/quiz-import.core";
import { sampleContentFiles } from "@/services/uploads.mock";

// ─────────────────────────────────────────────────────────────────────────────
// The sample arm of the Admin seam's spreadsheet imports: cards (Phase 3,
// ticket 06) and quizzes (ticket 09), each the shared import
// (src/services/content-import.core.ts) over the in-memory sample store, with
// the sample data's private content bucket. A save checks the Subject and
// applies every change with no await in between, so no other request can
// come between them; should any part of it fail, the parts already applied
// are put back.
// ─────────────────────────────────────────────────────────────────────────────

/** A Subject with its Topics, as the store holds them now, or null when it isn't in the catalogue. */
function readTopics(examCode: string, subjectCode: string): ImportSubject | null {
  const store = getSampleStore();
  const exam = store.catalogue.exams.find((candidate) => candidate.code === examCode);
  const subject = exam?.subjects.find((candidate) => candidate.code === subjectCode);
  if (!exam || !subject) return null;
  return {
    exam: { code: exam.code, name: exam.name },
    subject: { code: subject.code, name: subject.name },
    topics: topicsOf(store.topics, exam.code, subject.code),
  };
}

/** A Subject with its Topics, their decks and cards, as the store holds them now. */
function readSubjectCards(examCode: string, subjectCode: string): SubjectCards | null {
  const read = readTopics(examCode, subjectCode);
  if (!read) return null;
  const store = getSampleStore();
  const topicIds = new Set(read.topics.map((topic) => topic.id));
  const decks = store.decks.filter((deck) => topicIds.has(deck.topicId));
  const deckIds = new Set(decks.map((deck) => deck.id));
  return structuredClone({
    ...read,
    decks,
    cards: store.cards.filter((card) => deckIds.has(card.deckId)),
  });
}

/** A Subject with its Topics, their quizzes and the questions in them, as the store holds them now. */
function readSubjectQuizzes(examCode: string, subjectCode: string): SubjectQuizzes | null {
  const read = readTopics(examCode, subjectCode);
  if (!read) return null;
  const store = getSampleStore();
  const topicIds = new Set(read.topics.map((topic) => topic.id));
  const quizzes = store.quizzes.filter((quiz) => topicIds.has(quiz.topicId));
  const quizIds = new Set(quizzes.map((quiz) => quiz.id));
  return structuredClone({
    ...read,
    quizzes,
    questions: store.questions.filter(
      (question) => quizIds.has(question.quizId) && question.removedAt === null,
    ),
  });
}

const sampleCardImportStore: CardImportStore = {
  read: async (examCode, subjectCode) => readSubjectCards(examCode, subjectCode),
  files: sampleContentFiles,
  save: async (subject, writes, activity, state) => {
    const current = readSubjectCards(subject.exam.code, subject.subject.code);
    if (!current || cardSubjectStateOf(current) !== state) return "conflict";

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

const sampleQuizImportStore: QuizImportStore = {
  read: async (examCode, subjectCode) => readSubjectQuizzes(examCode, subjectCode),
  files: sampleContentFiles,
  save: async (subject, writes, activity, state) => {
    const current = readSubjectQuizzes(subject.exam.code, subject.subject.code);
    if (!current || quizSubjectStateOf(current) !== state) return "conflict";

    const store = getSampleStore();
    const { topics, quizzes, questions } = store;
    const updated = new Map(writes.updated.map((question) => [question.id, question]));
    const removed = new Set(writes.removed);
    try {
      store.topics = [...topics, ...structuredClone(writes.topics)];
      store.quizzes = [...quizzes, ...structuredClone(writes.quizzes)];
      store.questions = [
        // A removed question is kept, marked removed, for the attempts that answered it.
        ...questions.map((question) =>
          removed.has(question.id)
            ? { ...question, position: null, removedAt: writes.removedAt }
            : structuredClone(updated.get(question.id) ?? question),
        ),
        ...structuredClone(writes.inserted),
      ];
      store.staffActivity = [...store.staffActivity, structuredClone(activity)];
    } catch (error) {
      store.topics = topics;
      store.quizzes = quizzes;
      store.questions = questions;
      throw error;
    }
    return "saved";
  },
};

export const { planCardImport, confirmCardImport } = cardImportCalls(sampleCardImportStore);
export const { planQuizImport, confirmQuizImport } = quizImportCalls(sampleQuizImportStore);
