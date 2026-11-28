import { formatPeso } from "@/lib/money";
import type { ContentVisibility } from "@/services/content.types";
import type { CourseAccess, LessonState } from "@/services/courses.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Course builder's rules (Phase 5, ticket 01; spec, Phase 5 planning
// decisions → A Course, The Course builder, Hiding, unpublishing and
// deleting). Pure, and shared by the Admin seam, which enforces them, and the
// builder's screens, which show the same words.
// ─────────────────────────────────────────────────────────────────────────────

export const COURSE_TITLE_MAX = 120;
export const MODULE_TITLE_MAX = 120;
export const LESSON_TITLE_MAX = 120;
export const COURSE_DESCRIPTION_MAX = 2000;
export const LESSON_NOTES_MAX = 5000;

export const NEEDS_PUBLISHED_LESSON = "Needs at least one published lesson";
export const ADD_A_VIDEO = "ADD A VIDEO BEFORE PUBLISHING";
export const WAIT_FOR_VIDEO = "WAIT FOR THE VIDEO TO FINISH UPLOADING";

/** Pure: why a Course can't take this Subject (one of its Exam's, picked from the list), or null. */
export function subjectRefusal(
  exam: { code: string; subjects: readonly { code: string }[] } | undefined,
  subject: string,
): string | null {
  if (!exam) return "PICK AN EXAM";
  return exam.subjects.some((candidate) => candidate.code === subject)
    ? null
    : `PICK ONE OF ${exam.code}’S SUBJECTS`;
}

/** Pure: why a Course can't take this visibility, or null: Visible needs a Published Lesson. */
export function visibilityRefusal(
  visibility: ContentVisibility,
  publishedLessons: number,
): string | null {
  return visibility === "visible" && publishedLessons === 0 ? NEEDS_PUBLISHED_LESSON : null;
}

/** Pure: why a Lesson in this state can't be published, or null: it needs a ready video. */
export function publishRefusal(state: LessonState): string | null {
  switch (state) {
    case "no-video":
    case "upload-failed":
      return ADD_A_VIDEO;
    case "uploading":
    case "processing":
      return WAIT_FOR_VIDEO;
    case "draft":
    case "published":
      return null;
  }
}

/** Pure: why a Module holding this many Lessons can't be deleted, or null when it's empty. */
export function moduleDeleteRefusal(lessons: number): string | null {
  if (lessons === 0) return null;
  return `MOVE OR DELETE ITS ${lessons} ${lessons === 1 ? "LESSON" : "LESSONS"} FIRST`;
}

/**
 * Pure: a Course's Lessons after "Move to Module…": the Lesson goes last in
 * the other Module, and the Lessons after it in its old Module close the gap.
 * The list keeps its order otherwise, with the moved Lesson last.
 */
export function lessonsAfterMoveToModule<
  Item extends { id: string; moduleId: string; position: number },
>(lessons: readonly Item[], lessonId: string, moduleId: string): Item[] {
  const moving = lessons.find((lesson) => lesson.id === lessonId);
  if (!moving || moving.moduleId === moduleId) return [...lessons];
  const last = Math.max(
    0,
    ...lessons.filter((lesson) => lesson.moduleId === moduleId).map((lesson) => lesson.position),
  );
  const rest = lessons
    .filter((lesson) => lesson.id !== lessonId)
    .map((lesson) =>
      lesson.moduleId === moving.moduleId && lesson.position > moving.position
        ? { ...lesson, position: lesson.position - 1 }
        : lesson,
    );
  return [...rest, { ...moving, moduleId, position: last + 1 }];
}

/**
 * Pure: "How members get it", as Course settings shows it: "Included in CE
 * All-Access", or "Sold separately · ₱1,499" ("No price yet" until an Owner
 * sets one).
 */
export function howMembersGetIt(
  course: { access: CourseAccess; priceCentavos: number | null },
  examCode: string,
): string {
  if (course.access === "included") return `Included in ${examCode} All-Access`;
  const price = course.priceCentavos === null ? "No price yet" : formatPeso(course.priceCentavos);
  return `Sold separately · ${price}`;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Pure: a Course's header line: "CE · PSAD · 3 MODULES · 9 LESSONS · 7 PUBLISHED". */
export function courseMeta(
  course: { examCode: string; subjectCode: string },
  modules: readonly { lessons: readonly { state: LessonState }[] }[],
): string {
  const lessons = modules.flatMap((module) => module.lessons);
  const published = lessons.filter((lesson) => lesson.state === "published").length;
  return [
    course.examCode,
    course.subjectCode,
    count(modules.length, "MODULE", "MODULES"),
    count(lessons.length, "LESSON", "LESSONS"),
    `${published} PUBLISHED`,
  ].join(" · ");
}

const STATE_LABELS: Record<LessonState, string> = {
  "no-video": "NO VIDEO",
  uploading: "UPLOADING",
  processing: "PROCESSING",
  draft: "DRAFT",
  published: "PUBLISHED",
  "upload-failed": "UPLOAD FAILED",
};

/** Pure: a Lesson's state tag. */
export const lessonStateLabel = (state: LessonState): string => STATE_LABELS[state];
