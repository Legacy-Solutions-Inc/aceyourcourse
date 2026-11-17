import type * as schema from "@/lib/db/schema";
import type {
  AccessPass,
  ContentRecords,
  Deck,
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
    quizzes: content.quizzes.map(({ id, topicId, visibility, freePreview }) => ({
      id,
      topicId,
      visibility,
      freePreview,
    })),
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
