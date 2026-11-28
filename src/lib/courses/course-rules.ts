import { formatPeso } from "@/lib/money";
import type { ContentVisibility } from "@/services/content.types";
import type { CourseAccess, LessonReplacementState, LessonState } from "@/services/courses.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Course builder's rules (Phase 5, tickets 01 and 02; spec, Phase 5 planning
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
export const ADD_A_TITLE = "ADD A TITLE BEFORE PUBLISHING";
export const NEEDS_PUBLISHED_LESSON_TO_STAY =
  "A visible course needs a published lesson. Hide the course first.";
export const PICK_A_VIDEO_FILE = "PICK AN MP4 OR MOV VIDEO";
export const VIDEO_TOO_BIG = "KEEP THE VIDEO TO 4 GB OR LESS";
export const CONNECT_VIDEO_SERVICE = "Connect the video service to upload";
export const CONNECT_VIDEO_SERVICE_REFUSAL = CONNECT_VIDEO_SERVICE.toUpperCase();

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

/** Pure: why a Lesson can't be published, or null: it needs a title and a ready video. */
export function publishRefusal(lesson: { state: LessonState; title: string }): string | null {
  if (!lesson.title.trim()) return ADD_A_TITLE;
  switch (lesson.state) {
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

/**
 * Pure: why a Published Lesson can't be unpublished, or null: a Visible
 * Course must keep a Published Lesson, so its last one is refused until the
 * Course is hidden. `publishedAfter` counts the Course's Published Lessons
 * once this one is unpublished.
 */
export function unpublishRefusal(
  visibility: ContentVisibility,
  publishedAfter: number,
): string | null {
  return visibility === "visible" && publishedAfter === 0 ? NEEDS_PUBLISHED_LESSON_TO_STAY : null;
}

/** Pure: whether a Lesson's video is ready to play (a draft or Published Lesson). */
export const hasReadyVideo = (state: LessonState): boolean =>
  state === "draft" || state === "published";

/** Pure: whether a video (a Lesson's, or its replacement's) is still uploading or processing. */
export const videoInFlight = (state: LessonState | LessonReplacementState | null): boolean =>
  state === "uploading" || state === "processing";

/** The largest Lesson video an upload takes: 4 GB. */
export const VIDEO_MAX_BYTES = 4 * 1024 ** 3;

const VIDEO_KINDS: Record<string, readonly string[]> = {
  mp4: ["video/mp4"],
  mov: ["video/quicktime"],
};

/**
 * Pure: why a file can't be a Lesson's video, checked before upload
 * permission is asked: an MP4 or MOV (by its name, and its type when the
 * browser gives one) of up to 4 GB.
 */
export function videoFileRefusal(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? "";
  const types = VIDEO_KINDS[extension];
  if (!types || (file.type !== "" && !types.includes(file.type))) return PICK_A_VIDEO_FILE;
  if (!Number.isFinite(file.size) || file.size <= 0) return PICK_A_VIDEO_FILE;
  if (file.size > VIDEO_MAX_BYTES) return VIDEO_TOO_BIG;
  return null;
}

/**
 * Pure: an upload's progress line, "41% · about 6 min left · keep this page
 * open", from how much is sent (0 to 1) and the seconds left, if known yet.
 */
export function uploadProgressLine(sent: number, secondsLeft: number | null): string {
  const percent = `${Math.floor(Math.min(Math.max(sent, 0), 1) * 100)}%`;
  if (secondsLeft === null || !Number.isFinite(secondsLeft)) {
    return `${percent} · keep this page open`;
  }
  const left =
    secondsLeft < 60 ? "less than a minute left" : `about ${Math.round(secondsLeft / 60)} min left`;
  return `${percent} · ${left} · keep this page open`;
}

/** Pure: a video's length, "12:34", or "1:02:03" from an hour on. */
export function videoLength(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
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

/** Why a Course can't be deleted, and what to do instead (Phase 5, ticket 06). */
export const DELETE_BLOCKED = {
  owned:
    "Members own this course, so it can’t be deleted. Hide it instead: it leaves the Courses screen and sale, and its owners keep watching it.",
  ordered:
    "Orders name this course, so it can’t be deleted. Hide it instead: it leaves the Courses screen and sale.",
} as const;

/** Pure: what switching how Members get a Course does now, for its confirmation (ticket 06). */
export function accessSwitchText(
  to: CourseAccess,
  examCode: string,
  { losing, gaining }: { losing: number; gaining: number },
): string {
  const members = (n: number) => `${n} ${n === 1 ? "member" : "members"}`;
  const verb = (n: number, one: string, many: string) => (n === 1 ? one : many);
  return to === "sold-separately"
    ? `${members(losing)} who watched it through ${examCode} All-Access ${verb(losing, "loses it now, and keeps", "lose it now, and keep")} their progress. It isn’t on sale until you set a price and turn it on in Plans & prices.`
    : `${members(gaining)} with active ${examCode} All-Access ${verb(gaining, "gains", "gain")} it now. Everyone who owns it keeps it.`;
}

/**
 * Pure: whether Members can buy a Course now (Phase 5, ticket 06): sold
 * separately, Visible, on sale and priced. Pay checks it on the server, and
 * the Plans page's One-time purchases lists only these.
 */
export function isCourseForSale<
  T extends {
    access: CourseAccess;
    visibility: ContentVisibility;
    onSale: boolean;
    priceCentavos: number | null;
  },
>(course: T): course is T & { priceCentavos: number } {
  return (
    course.access === "sold-separately" &&
    course.visibility === "visible" &&
    course.onSale &&
    course.priceCentavos !== null
  );
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
