import {
  CONTENT_KINDS,
  type ContentCounts,
  type ContentKind,
  type ContentRecords,
  type ContentVisibility,
  type Deck,
  type Quiz,
  type ReviewerPdf,
  type Topic,
  type TopicContent,
} from "@/services/content.types";
import type { ContentItem, LibraryItem, LibrarySubject } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The content model's rules (spec, Phase 3 → Content model), pure and shared
// by both arms of the Member seam and the Admin seam: each arm reads the
// records its own way and hands them here, so the sample data and the
// database answer alike.
// ─────────────────────────────────────────────────────────────────────────────

/** An Exam's Subjects, in the catalogue's order, as the rules need them. */
export interface ContentExam {
  code: string;
  subjects: readonly { code: string; name: string }[];
}

/** Pure: whether Members can see it: a Visible deck or quiz, or a Published Reviewer PDF. */
export function isAvailable(record: Deck | Quiz | ReviewerPdf): boolean {
  return "status" in record ? record.status === "published" : record.visibility === "visible";
}

/** Pure: a Subject's Topics, in their order. */
export function topicsOf(topics: readonly Topic[], examCode: string, subjectCode: string): Topic[] {
  return topics
    .filter((topic) => topic.examCode === examCode && topic.subjectCode === subjectCode)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

/** The record of each kind a Topic has, or null. */
function recordsOf(topicId: string, content: ContentRecords) {
  return {
    deck: content.decks.find((deck) => deck.topicId === topicId) ?? null,
    quiz: content.quizzes.find((quiz) => quiz.topicId === topicId) ?? null,
    "reviewer-pdf": content.reviewerPdfs.find((pdf) => pdf.topicId === topicId) ?? null,
  } satisfies Record<ContentKind, Deck | Quiz | ReviewerPdf | null>;
}

/**
 * Pure: an Exam's Library: each of its Subjects in order, each with its
 * Topics in order, each with only the content Members can see. Hidden decks
 * and quizzes and Reviewer PDFs that aren't Published never appear.
 */
export function libraryOf(exam: ContentExam, content: ContentRecords): LibrarySubject[] {
  return exam.subjects.map((subject) => ({
    code: subject.code,
    name: subject.name,
    topics: topicsOf(content.topics, exam.code, subject.code).map((topic) => {
      const records = recordsOf(topic.id, content);
      const items = CONTENT_KINDS.flatMap((kind): LibraryItem[] => {
        const record = records[kind];
        return record && isAvailable(record)
          ? [{ kind, id: record.id, freePreview: record.freePreview }]
          : [];
      });
      return { id: topic.id, name: topic.name, position: topic.position, items };
    }),
  }));
}

/** Pure: the record of one kind with this id, or null. */
function findRecord(
  kind: ContentKind,
  id: string,
  content: ContentRecords,
): Deck | Quiz | ReviewerPdf | null {
  const list: readonly (Deck | Quiz | ReviewerPdf)[] =
    kind === "deck" ? content.decks : kind === "quiz" ? content.quizzes : content.reviewerPdfs;
  return list.find((record) => record.id === id) ?? null;
}

/**
 * Pure: one deck, quiz or Reviewer PDF as opening it needs, Hidden or not;
 * null when there's none with that id, or for a Reviewer PDF no one has
 * placed under a Topic yet, which was never in the Member App.
 */
export function contentItemOf(
  kind: ContentKind,
  id: string,
  exams: readonly ContentExam[],
  content: ContentRecords,
): ContentItem | null {
  const record = findRecord(kind, id, content);
  if (!record?.topicId) return null;
  const topic = content.topics.find((candidate) => candidate.id === record.topicId);
  const exam = exams.find((candidate) => candidate.code === topic?.examCode);
  const subject = exam?.subjects.find((candidate) => candidate.code === topic?.subjectCode);
  if (!topic || !subject) return null;
  return {
    kind,
    id: record.id,
    examCode: topic.examCode,
    subjectCode: subject.code,
    subjectName: subject.name,
    topicId: topic.id,
    topicName: topic.name,
    available: isAvailable(record),
    freePreview: record.freePreview,
  };
}

/**
 * Pure: why a deck or quiz holding `items` cards or questions can't be given
 * this visibility, or null when it can: Visible is refused while it's empty
 * (story 127), so Members never see empty content. Hidden always can.
 */
export function visibilityRefusal(
  visibility: ContentVisibility,
  items: number,
  item: "card" | "question",
): string | null {
  return visibility === "visible" && items === 0 ? `ADD A ${item.toUpperCase()} FIRST` : null;
}

/**
 * Pure: a deck's or quiz's visibility once items are removed and `itemsLeft`
 * remain: a Visible one with nothing left becomes Hidden, which `hidden` says,
 * for the screen to tell the Editor. The card editor (ticket 07) and the
 * question editor (ticket 10) both apply it, so neither leaves empty content
 * Visible.
 */
export function visibilityAfterRemoval(
  visibility: ContentVisibility,
  itemsLeft: number,
): { visibility: ContentVisibility; hidden: boolean } {
  return visibility === "visible" && itemsLeft === 0
    ? { visibility: "hidden", hidden: true }
    : { visibility, hidden: false };
}

/** Pure: what a Topic holds. */
export function topicContentOf(topicId: string, content: ContentRecords): TopicContent {
  const records = recordsOf(topicId, content);
  return {
    deck: records.deck?.visibility ?? null,
    quiz: records.quiz?.visibility ?? null,
    reviewerPdf: records["reviewer-pdf"]?.status ?? null,
  };
}

/** Pure: how much content the Topics that match hold, Hidden, Draft and the rest included. */
export function contentCountsOf(
  content: ContentRecords,
  matches: (topic: Topic) => boolean,
): ContentCounts {
  const ids = new Set(content.topics.filter(matches).map((topic) => topic.id));
  const inTopics = (record: { topicId: string | null }) =>
    record.topicId !== null && ids.has(record.topicId);
  return {
    decks: content.decks.filter(inTopics).length,
    quizzes: content.quizzes.filter(inTopics).length,
    reviewerPdfs: content.reviewerPdfs.filter(inTopics).length,
  };
}
