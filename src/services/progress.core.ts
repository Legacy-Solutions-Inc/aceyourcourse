import { type AccessPassEnd, accessDecision } from "@/lib/member-app/access";
import {
  memberProgress,
  type MemberProgress,
  type ProgressCourse,
  type ProgressRecords,
  type ProgressSubject,
} from "@/lib/member-app/progress";
import { accessCourseOf, type CourseTree, progressCourseOf } from "@/services/course-study.core";
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
//
// Lessons (Phase 5, ticket 04) are the exception: they count over the
// Courses the Member can open now ("9 / 32 LESSONS"), which the access
// decision says from their own Access Passes and Course Ownerships, as if
// on their Active Device (a progress read writes and plays nothing). Their
// Lesson progress is kept either way, and counts again once access is
// renewed.
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
   * Days, which the streak counts account-wide, and their Lesson progress
   * (any Lesson's: only the Courses that count are read from it).
   */
  readRecords(userId: string, examCode: string): Promise<ProgressRecords>;
  /** The Exam's Courses, Hidden ones too, each whole. */
  readExamCourses(examCode: string): Promise<CourseTree[]>;
  /** The ids of the Courses this Member owns: their own Course Ownerships only. */
  readOwnedCourseIds(userId: string): Promise<string[]>;
  /** The Member's own Access Passes: each one's Exam and end. */
  readAccessPasses(userId: string): Promise<AccessPassEnd[]>;
}

/** Whose progress is read, beyond the Member: whether they're active Staff, who open every Course. */
export interface ProgressOptions {
  activeStaff?: boolean;
}

/**
 * Pure: the Exam's Courses this Member can open at `now`, each with its
 * Published Lessons in order: those whose full Lessons the access decision
 * allows (a Free Preview Lesson doesn't open its Course).
 */
export function openCourses(
  trees: readonly CourseTree[],
  member: { ownedCourseIds: readonly string[]; passes: readonly AccessPassEnd[] },
  activeStaff: boolean,
  now: Date,
): ProgressCourse[] {
  const owned = new Set(member.ownedCourseIds);
  return trees
    .filter(({ course }) => {
      const decision = accessDecision({
        gate: "open",
        device: "active",
        activeStaff,
        passes: member.passes,
        now,
        content: {
          examCode: course.examCode,
          available: true,
          freePreview: false,
          course: accessCourseOf(course, owned.has(course.id)),
        },
      });
      return decision.outcome === "allowed";
    })
    .sort((a, b) => a.course.createdAt.localeCompare(b.course.createdAt))
    .map(progressCourseOf);
}

/** The Member seam's progress reads, over an arm's store. */
export function progressCalls(store: ProgressStore) {
  async function progressOf(
    userId: string,
    examCode: string,
    { activeStaff = false }: ProgressOptions = {},
  ): Promise<MemberProgress> {
    const wanted = memberUserIdSchema.parse(userId);
    const code = examCodeOf(examCode);
    const now = new Date();
    const [subjects, records, trees, ownedCourseIds, passes] = await Promise.all([
      store.readExamContent(code),
      store.readRecords(wanted, code),
      store.readExamCourses(code),
      store.readOwnedCourseIds(wanted),
      store.readAccessPasses(wanted),
    ]);
    const courses = openCourses(trees, { ownedCourseIds, passes }, activeStaff, now);
    return memberProgress(subjects, records, now, courses);
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
