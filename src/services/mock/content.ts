import type { CatalogueSeed } from "@/services/catalogue.schema";
import type {
  ContentRecords,
  ContentVisibility,
  ReviewerPdfStatus,
} from "@/services/content.types";

import { stableUuid } from "./stable-uuid";

// ─────────────────────────────────────────────────────────────────────────────
// The Member App's sample content (Phase 3, ticket 05): a few CE Topics with a
// mix of Visible, Hidden, Free Preview and empty items, so the Library shows
// every state. Kept small: later tickets add cards, questions and pages. The
// ids are made from names, so they're the same on every restart and in the
// database seed. The sample Members' Access Passes are in members.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** What a sample Topic holds: each kind's visibility or status, and whether it's Free Preview. */
interface SampleTopic {
  name: string;
  deck?: { visibility: ContentVisibility; freePreview?: boolean };
  quiz?: { visibility: ContentVisibility; freePreview?: boolean };
  reviewerPdf?: { status: ReviewerPdfStatus; freePreview?: boolean };
}

/** The sample Topics, by Exam and Subject, in each Subject's order. */
const SAMPLE_TOPICS: Record<string, Record<string, SampleTopic[]>> = {
  CE: {
    MSTC: [
      {
        name: "Simple Curves",
        deck: { visibility: "visible", freePreview: true },
        quiz: { visibility: "visible" },
        reviewerPdf: { status: "published" },
      },
      {
        name: "Spiral Curves",
        deck: { visibility: "visible" },
        quiz: { visibility: "hidden" },
        reviewerPdf: { status: "draft" },
      },
      { name: "Surveying" },
      { name: "Algebra", deck: { visibility: "hidden" } },
    ],
    HPGE: [
      {
        name: "Hydrostatics",
        deck: { visibility: "visible" },
        quiz: { visibility: "visible", freePreview: true },
      },
      {
        name: "Soil Mechanics",
        deck: { visibility: "hidden" },
        reviewerPdf: { status: "published" },
      },
      { name: "Fluid Properties" },
    ],
  },
};

/** Pure: a sample Topic's id, from its Exam, Subject and name. */
export const sampleTopicId = (exam: string, subject: string, name: string) =>
  stableUuid(`sample-topic:${exam}:${subject}:${name.toLowerCase()}`);

/** Pure: the id of a sample Topic's deck, quiz or Reviewer PDF. */
export const sampleContentId = (topicId: string, kind: "deck" | "quiz" | "reviewer-pdf") =>
  stableUuid(`sample-${kind}:${topicId}`);

/**
 * The sample Topics and their content, for the Subjects the catalogue has
 * (an edited seed without one drops its Topics, as the database's foreign
 * key would).
 */
export function sampleContent(catalogue: CatalogueSeed): ContentRecords {
  const records: ContentRecords = { topics: [], decks: [], quizzes: [], reviewerPdfs: [] };
  for (const [examCode, subjects] of Object.entries(SAMPLE_TOPICS)) {
    const exam = catalogue.exams.find((candidate) => candidate.code === examCode);
    for (const [subjectCode, topics] of Object.entries(subjects)) {
      if (!exam?.subjects.some((subject) => subject.code === subjectCode)) continue;
      topics.forEach((sample, index) => {
        const id = sampleTopicId(examCode, subjectCode, sample.name);
        records.topics.push({ id, examCode, subjectCode, name: sample.name, position: index + 1 });
        if (sample.deck) {
          const { visibility, freePreview = false } = sample.deck;
          records.decks.push({
            id: sampleContentId(id, "deck"),
            topicId: id,
            visibility,
            freePreview,
          });
        }
        if (sample.quiz) {
          const { visibility, freePreview = false } = sample.quiz;
          records.quizzes.push({
            id: sampleContentId(id, "quiz"),
            topicId: id,
            visibility,
            freePreview,
          });
        }
        if (sample.reviewerPdf) {
          const { status, freePreview = false } = sample.reviewerPdf;
          records.reviewerPdfs.push({
            id: sampleContentId(id, "reviewer-pdf"),
            topicId: id,
            status,
            freePreview,
          });
        }
      });
    }
  }
  return records;
}
