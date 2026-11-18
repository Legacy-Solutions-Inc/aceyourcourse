import { createHash } from "node:crypto";

import { matchingFront } from "@/lib/cards/card-rules";
import type * as schema from "@/lib/db/schema";
import type {
  AccessPass,
  Card,
  ContentRecords,
  Deck,
  Question,
  Quiz,
  ReviewerPdf,
  Topic,
} from "@/services/content.types";

// Pure mappings between the content model's records (content.types.ts) and
// their table rows (src/lib/db/schema.ts), shared by the seed and both
// seams' database arms. Times are ISO strings in the records and Dates in
// the rows.

type TopicRow = typeof schema.topics.$inferSelect;
type DeckRow = typeof schema.decks.$inferSelect;
type QuizRow = typeof schema.quizzes.$inferSelect;
type ReviewerPdfRow = typeof schema.reviewerPdfs.$inferSelect;
type AccessPassRow = typeof schema.accessPasses.$inferSelect;
type CardRow = typeof schema.cards.$inferSelect;
type QuestionRow = typeof schema.questions.$inferSelect;

/** Every content table's rows, as the records are. */
export interface ContentRows {
  topics: TopicRow[];
  decks: DeckRow[];
  quizzes: QuizRow[];
  reviewerPdfs: ReviewerPdfRow[];
}

/** Pure: the records the rows hold. */
export function contentFromRows(rows: ContentRows): ContentRecords {
  return {
    topics: rows.topics.map((row): Topic => ({ ...row })),
    decks: rows.decks.map((row): Deck => ({ ...row })),
    quizzes: rows.quizzes.map((row): Quiz => ({ ...row })),
    reviewerPdfs: rows.reviewerPdfs.map((row): ReviewerPdf => ({ ...row })),
  };
}

/** Pure: the rows that hold the records. */
export function contentToRows(content: ContentRecords): ContentRows {
  return {
    topics: content.topics.map(({ id, examCode, subjectCode, name, position }) => ({
      id,
      examCode,
      subjectCode,
      name,
      position,
    })),
    decks: content.decks.map(({ id, topicId, visibility, freePreview }) => ({
      id,
      topicId,
      visibility,
      freePreview,
    })),
    quizzes: content.quizzes.map(
      ({ id, topicId, visibility, freePreview, passingScore, shuffle, showAnswers }) => ({
        id,
        topicId,
        visibility,
        freePreview,
        passingScore,
        shuffle,
        showAnswers,
      }),
    ),
    reviewerPdfs: content.reviewerPdfs.map(({ id, topicId, status, freePreview }) => ({
      id,
      topicId,
      status,
      freePreview,
    })),
  };
}

export const accessPassFromRow = (row: AccessPassRow): AccessPass => ({
  userId: row.userId,
  examCode: row.examCode,
  endsAt: row.endsAt.toISOString(),
});

export const accessPassToRow = (pass: AccessPass): AccessPassRow => ({
  userId: pass.userId,
  examCode: pass.examCode,
  endsAt: new Date(pass.endsAt),
});

/** Pure: the SHA-256 of a front as a re-import matches it, which the cards table keeps. */
export const frontHashOf = (front: string) =>
  createHash("sha256").update(matchingFront(front), "utf8").digest("hex");

export const cardFromRow = (row: CardRow): Card => ({
  id: row.id,
  deckId: row.deckId,
  position: row.position,
  front: row.front,
  back: row.back,
  note: row.note,
  image: row.imagePath,
});

/** Pure: a card's row, with its front's hash, so the hash can't drift from the front. */
export const cardToRow = (card: Card): CardRow => ({
  id: card.id,
  deckId: card.deckId,
  position: card.position,
  front: card.front,
  back: card.back,
  note: card.note,
  imagePath: card.image,
  frontHash: frontHashOf(card.front),
});

export const questionFromRow = (row: QuestionRow): Question => ({
  id: row.id,
  quizId: row.quizId,
  position: row.position,
  question: row.question,
  choices: { A: row.choiceA, B: row.choiceB, C: row.choiceC, D: row.choiceD },
  correct: row.correctChoice,
  explanation: row.explanation,
  figure: row.figurePath,
  removedAt: row.removedAt?.toISOString() ?? null,
});

export const questionToRow = (question: Question): QuestionRow => ({
  id: question.id,
  quizId: question.quizId,
  position: question.position,
  question: question.question,
  choiceA: question.choices.A,
  choiceB: question.choices.B,
  choiceC: question.choices.C,
  choiceD: question.choices.D,
  correctChoice: question.correct,
  explanation: question.explanation,
  figurePath: question.figure,
  removedAt: question.removedAt === null ? null : new Date(question.removedAt),
});
