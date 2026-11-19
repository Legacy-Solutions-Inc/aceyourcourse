import {
  memberProgress,
  type MemberProgress,
  type ProgressRecords,
  type ProgressSubject,
} from "@/lib/member-app/progress";
import { type ContentExam, isAvailable, topicsOf } from "@/services/content.rules";
import type { ContentRecords } from "@/services/content.types";
import { examCodeOf } from "@/services/member.rules";
import { memberUserIdSchema } from "@/services/member.schema";
import type { TopicPercents } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// A Member's progress through the Member seam (spec, Phase 3 → Progress
// calculator, Progress storage, Resume; ticket 15), shared by both arms:
// each arm reads an Exam's content and the Member's own records its own way
// (the ProgressStore below), and the pure calculator
// (src/lib/member-app/progress.ts) makes every number from them. Progress is
// a read with no access decision: it's the Member's own, kept and shown
// when their access ends, and Hidden or Draft content counts nowhere.
// ─────────────────────────────────────────────────────────────────────────────

/** The counts the calculator reads beyond the content records, by deck, quiz and Reviewer PDF. */
export interface ProgressCounts {
  /** Every card in the Exam's decks, with its place in its deck. */
  cards: readonly { id: string; deckId: string; position: number }[];
  /** How many questions each quiz has now, removed ones aside, by quiz id. */
  questionCounts: ReadonlyMap<string, number>;
  /** How many pages a Member can read in each Reviewer PDF, by its id (readablePageCount). */
  pageCounts: ReadonlyMap<string, number>;
}

/**
 * Pure: an Exam's Subjects in order, each with every Topic in order and its
 * content as the calculator reads it, Hidden and Draft content marked
 * unavailable (it counts nowhere).
 */
export function progressSubjectsOf(
  exam: ContentExam,
  content: ContentRecords,
  counts: ProgressCounts,
): ProgressSubject[] {
  // Each deck's cards in its order, grouped once: an Exam can hold thousands.
  const decksCards = new Map<string, string[]>();
  for (const card of [...counts.cards].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  )) {
    const inDeck = decksCards.get(card.deckId);
    if (inDeck) inDeck.push(card.id);
    else decksCards.set(card.deckId, [card.id]);
  }
  const cardIdsOf = (deckId: string) => decksCards.get(deckId) ?? [];
  return exam.subjects.map((subject) => ({
    code: subject.code,
    name: subject.name,
    topics: topicsOf(content.topics, exam.code, subject.code).map((topic) => {
      const deck = content.decks.find((candidate) => candidate.topicId === topic.id);
      const quiz = content.quizzes.find((candidate) => candidate.topicId === topic.id);
      const pdf = content.reviewerPdfs.find((candidate) => candidate.topicId === topic.id);
      return {
        id: topic.id,
        name: topic.name,
        position: topic.position,
        deck: deck
          ? { id: deck.id, available: isAvailable(deck), cardIds: cardIdsOf(deck.id) }
          : null,
        quiz: quiz
          ? {
              id: quiz.id,
              available: isAvailable(quiz),
              passingScore: quiz.passingScore,
              questionCount: counts.questionCounts.get(quiz.id) ?? 0,
            }
          : null,
        reviewerPdf: pdf
          ? {
              id: pdf.id,
              available: isAvailable(pdf),
              pageCount: counts.pageCounts.get(pdf.id) ?? 0,
            }
          : null,
      };
    }),
  }));
}

/** How an arm reads what the calculator needs. */
export interface ProgressStore {
  /** An Exam's Subjects and Topics with their content (progressSubjectsOf); none for a code that isn't an Exam's. */
  readExamContent(examCode: string): Promise<ProgressSubject[]>;
  /**
   * The Member's own study records: their Card Marks, Quiz Attempt scores,
   * pages viewed, deck and reader places in this Exam's content (records of
   * other content are ignored, so more is harmless), and all their Study
   * Days, which the streak counts account-wide.
   */
  readRecords(userId: string, examCode: string): Promise<ProgressRecords>;
}

/** The Member seam's progress reads, over an arm's store. */
export function progressCalls(store: ProgressStore) {
  async function progressOf(userId: string, examCode: string): Promise<MemberProgress> {
    const wanted = memberUserIdSchema.parse(userId);
    const code = examCodeOf(examCode);
    const [subjects, records] = await Promise.all([
      store.readExamContent(code),
      store.readRecords(wanted, code),
    ]);
    return memberProgress(subjects, records, new Date());
  }

  return {
    getProgress: progressOf,
    async getTopicPercents(userId: string, examCode: string): Promise<TopicPercents> {
      const { subjects } = await progressOf(userId, examCode);
      return Object.fromEntries(
        subjects.flatMap(({ topics }) => topics.map(({ id, percent }) => [id, percent])),
      );
    },
  };
}
