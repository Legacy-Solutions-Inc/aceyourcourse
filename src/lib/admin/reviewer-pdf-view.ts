import type { AdminReviewerPdf, PlacementTopic } from "@/services/admin.types";
import type { ReviewerPdfStatus } from "@/services/content.types";

// ─────────────────────────────────────────────────────────────────────────────
// What a Reviewer PDF's screen shows (Phase 3, ticket 13; BUILD-MAP §3.5:
// PLACEMENT, and the status line by Publish), pure: where its Exam → Subject
// → Topic pickers open, the Topics it can go under in a Subject (one another
// Reviewer PDF holds says so: one Reviewer PDF per Topic), which Reviewer PDF
// holds the Topic picked, for the link to it, and its library and status
// lines. The seam enforces every rule; these only show them.
// ─────────────────────────────────────────────────────────────────────────────

/** The Exams and Subjects the pickers offer, in the catalogue's order. */
export type PlacementExams = readonly {
  code: string;
  subjects: readonly { code: string; name: string }[];
}[];

/** What the pickers hold: an Exam's code, a Subject's code and a Topic's id ("" for none). */
export interface PickedPlacement {
  exam: string;
  subject: string;
  topic: string;
}

/** Pure: where the pickers open: where it's placed, or the first Exam's first Subject with no Topic. */
export function openingPlacement(
  pdf: {
    topicId: string | null;
    placement: Pick<NonNullable<AdminReviewerPdf["placement"]>, "examCode" | "subjectCode"> | null;
  },
  exams: PlacementExams,
): PickedPlacement {
  if (pdf.placement && pdf.topicId) {
    return { exam: pdf.placement.examCode, subject: pdf.placement.subjectCode, topic: pdf.topicId };
  }
  const exam = exams[0];
  return { exam: exam?.code ?? "", subject: exam?.subjects[0]?.code ?? "", topic: "" };
}

/** Pure: a Subject's Topics as TOPIC offers them, in order, after the prompt to choose one. */
export function topicOptions(
  topics: readonly PlacementTopic[],
  examCode: string,
  subjectCode: string,
  pdfId: string,
): { value: string; label: string }[] {
  const inSubject = topics
    .filter((topic) => topic.examCode === examCode && topic.subjectCode === subjectCode)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  return [
    { value: "", label: "Choose a topic" },
    ...inSubject.map((topic) => ({
      value: topic.id,
      label:
        topic.reviewerPdfId !== null && topic.reviewerPdfId !== pdfId
          ? `${topic.name} · has a Reviewer PDF`
          : topic.name,
    })),
  ];
}

/** Pure: the other Reviewer PDF on the Topic picked, or null when it's free (or this one's). */
export function pickedTopicHolder(
  topics: readonly PlacementTopic[],
  topicId: string,
  pdfId: string,
): string | null {
  const holder = topics.find((topic) => topic.id === topicId)?.reviewerPdfId ?? null;
  return holder === pdfId ? null : holder;
}

/** Pure: where Members find it, or what it needs first (mockup: "Shows in the member Library under …"). */
export function libraryLine(
  status: ReviewerPdfStatus,
  placement: AdminReviewerPdf["placement"],
): string {
  if (!placement) return "Not in the member Library: choose a topic, save, then publish.";
  const where = `${placement.examCode} › ${placement.subjectCode} › ${placement.topicName}`;
  return status === "published"
    ? `Shows in the member Library under ${where}.`
    : `Shows in the member Library under ${where} once it’s published.`;
}

/** Pure: the status line by Publish (mockup 1269). */
export const statusLine = (status: ReviewerPdfStatus): string =>
  status === "published" ? "LIVE IN THE LIBRARY" : "NOT VISIBLE TO MEMBERS";
