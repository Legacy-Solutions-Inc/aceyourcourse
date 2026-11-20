import { createHash } from "node:crypto";

import { matchingFront } from "@/lib/cards/card-rules";
import type * as schema from "@/lib/db/schema";
import type {
  AccessPass,
  AccessPassGrant,
  Card,
  ContentRecords,
  Deck,
  Question,
  Quiz,
  QuizAttempt,
  QuizAttemptAnswer,
  QuizAttemptScore,
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
type AccessPassGrantRow = typeof schema.accessPassGrants.$inferSelect;
type CardRow = typeof schema.cards.$inferSelect;
type QuestionRow = typeof schema.questions.$inferSelect;
type QuizAttemptRow = typeof schema.quizAttempts.$inferSelect;
type QuizAttemptAnswerRow = typeof schema.quizAttemptAnswers.$inferSelect;

/** Every content table's rows, as the records are. */
export interface ContentRows {
  topics: TopicRow[];
  decks: DeckRow[];
  quizzes: QuizRow[];
  /** A Reviewer PDF's record only: its upload and job (ticket 12) are read and written apart. */
  reviewerPdfs: Pick<ReviewerPdfRow, keyof ReviewerPdf>[];
}

export const quizFromRow = (row: QuizRow): Quiz => ({ ...row });

/** Pure: the records the rows hold. */
export function contentFromRows(rows: ContentRows): ContentRecords {
  return {
    topics: rows.topics.map((row): Topic => ({ ...row })),
    decks: rows.decks.map((row): Deck => ({ ...row })),
    quizzes: rows.quizzes.map(quizFromRow),
    reviewerPdfs: rows.reviewerPdfs.map(({ id, topicId, status, freePreview }): ReviewerPdf => ({
      id,
      topicId,
      status,
      freePreview,
    })),
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

export const accessPassGrantFromRow = (row: AccessPassGrantRow): AccessPassGrant => ({
  userId: row.userId,
  examCode: row.examCode,
  days: row.days,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt.toISOString(),
  reason: row.reason,
  grantedBy: { email: row.grantedByEmail, name: row.grantedByName },
  grantedAt: row.grantedAt.toISOString(),
});

/** A grant as a row to add: its `seq` is the table's to give. */
export const accessPassGrantToRow = (grant: AccessPassGrant): Omit<AccessPassGrantRow, "seq"> => ({
  userId: grant.userId,
  examCode: grant.examCode,
  days: grant.days,
  startsAt: new Date(grant.startsAt),
  endsAt: new Date(grant.endsAt),
  reason: grant.reason,
  grantedByEmail: grant.grantedBy.email,
  grantedByName: grant.grantedBy.name,
  grantedAt: new Date(grant.grantedAt),
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

export const quizAttemptFromRow = (row: QuizAttemptRow): QuizAttemptScore => ({
  id: row.id,
  userId: row.userId,
  quizId: row.quizId,
  submittedAt: row.submittedAt.toISOString(),
  correctCount: row.correctCount,
  questionCount: row.questionCount,
  score: row.score,
  passingScore: row.passingScore,
});

export const quizAttemptToRow = (attempt: QuizAttemptScore): QuizAttemptRow => ({
  id: attempt.id,
  userId: attempt.userId,
  quizId: attempt.quizId,
  submittedAt: new Date(attempt.submittedAt),
  correctCount: attempt.correctCount,
  questionCount: attempt.questionCount,
  score: attempt.score,
  passingScore: attempt.passingScore,
});

/** Pure: an attempt's answers as rows, numbered from 1 in the order the Member saw them. */
export const quizAttemptAnswersToRows = (attempt: QuizAttempt): QuizAttemptAnswerRow[] =>
  attempt.answers.map((answer, index) => ({
    attemptId: attempt.id,
    position: index + 1,
    questionId: answer.questionId,
    choice: answer.choice,
    isCorrect: answer.isCorrect,
  }));

export const quizAttemptAnswerFromRow = (row: QuizAttemptAnswerRow): QuizAttemptAnswer => ({
  questionId: row.questionId,
  choice: row.choice,
  isCorrect: row.isCorrect,
});
