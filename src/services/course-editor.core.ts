import { z } from "zod";

import {
  CONNECT_VIDEO_SERVICE_REFUSAL,
  DELETE_BLOCKED,
  hasReadyVideo,
  lessonsAfterMoveToModule,
  moduleDeleteRefusal,
  publishRefusal,
  subjectRefusal,
  unpublishRefusal,
  videoInFlight,
  visibilityRefusal,
} from "@/lib/courses/course-rules";
import {
  courseAccessInputSchema,
  type CourseForm,
  courseFormSchema,
  courseIdInputSchema,
  courseOnSaleInputSchema,
  coursePriceFormSchema,
  type CourseModuleForm,
  courseModuleFormSchema,
  courseModuleIdInputSchema,
  courseModuleMoveInputSchema,
  courseVisibilityInputSchema,
  type LessonForm,
  lessonFormSchema,
  lessonIdInputSchema,
  lessonMoveInputSchema,
  lessonPublishInputSchema,
  type LessonToModuleInput,
  lessonToModuleInputSchema,
  type LessonUploadInput,
  lessonUploadInputSchema,
  type LessonUploadOutcomeInput,
  lessonUploadOutcomeInputSchema,
  type NewCourseForm,
  newCourseFormSchema,
  type NewCourseModuleForm,
  newCourseModuleFormSchema,
  type NewLessonForm,
  newLessonFormSchema,
  type ReviewMove,
  roleRefusal,
} from "@/services/admin.schema";
import type {
  AdminCourse,
  AdminCourseList,
  AdminCourseModule,
  AdminCourseSummary,
  AdminError,
  AdminLesson,
  AdminLessonPreview,
  AdminLessonUpload,
  AdminResult,
  CourseAccessChange,
  CourseExamChoice,
  OneTimePurchase,
  RecordStamp,
  StaffActivity,
  StaffActor,
} from "@/services/admin.types";
import {
  activityRecord,
  formError,
  NOT_FOUND,
  refused,
  renumbered,
  staffInput,
  swapped,
} from "@/services/content-editor.core";
import { visibilityAfterRemoval } from "@/services/content.rules";
import type { ContentVisibility } from "@/services/content.types";
import type { Course, CourseModule, Lesson } from "@/services/courses.types";
import { nextStamp } from "@/services/mock/sample-store";
import type { UploadLookup } from "@/services/uploads.types";
import type { VideoService } from "@/services/video.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Course builder (Phase 5, ticket 01; spec, Phase 5 planning
// decisions → A Course, Who does what, The Course builder, Hiding,
// unpublishing and deleting; stories 156, 174, 175, 177, 179), shared by both
// arms: each arm gives a CourseEditorStore (how it lists the Courses, reads
// one Course with its Modules and Lessons, and saves a change to it all or
// nothing), and this module does the rest the same way for both. Any Staff
// User, Editor or Owner, may use it; nothing here writes how Members get a
// Course, its price or On sale (an Owner's, from ticket 06).
//
// Each write, in order (the steps the content editors share are in
// content-editor.core.ts):
//   1. checks the actor's Staff Role, and validates its input with zod,
//   2. for an edit, reads the record and runs the conflict check against the
//      stamp the form opened with,
//   3. for a cover, finds the finished "course-cover" upload's public URL,
//   4. saves under the content write lock, where the Course is read again
//      and every rule runs on it as it is then (the conflict check again,
//      the Subject one of the Exam's, Visible needing a Published Lesson,
//      Publish needing a ready video, a Module deleted only when empty), with
//      one Staff Activity record per entity it changes, and
//   5. once saved, deletes a replaced cover's file (a failure is logged).
// Nothing cached reads Courses yet, so no write returns a cache tag.
//
// Lesson videos (ticket 02; spec, Phase 5 planning decisions → Uploads,
// Hiding, unpublishing and deleting, Access and playback): each call that
// needs VdoCipher is given this server's video service (video.ts), or null
// when it isn't connected.
// - Upload permission is asked only for a Lesson that's there, after the file
//   checks, and the new video is recorded on the Lesson (uploading) before the
//   browser sends anything. On a Lesson with a ready video it's "Replace
//   video": the ready one keeps playing while the new one uploads and
//   processes, and takes over only once the new one is ready. Trying again
//   after a failure starts over, deleting the video it replaces.
// - The browser says when it has sent the file, or that it failed; while the
//   editor is open it asks for the status every few seconds, which makes the
//   Lesson a draft with the video's length once VdoCipher has it ready.
// - Deleting a Lesson or a Course deletes its videos once the delete is
//   saved. A video VdoCipher won't delete never blocks it: it's logged in
//   Staff Activity ("video-delete-failed") to be deleted by hand.
// Video changes leave the Lesson's save stamp alone, as Publish does, so an
// open form's Save doesn't turn into a conflict.
//
// Selling a Course (ticket 06; spec, Phase 5 planning decisions → Who does
// what, Hiding, unpublishing and deleting): only Owners switch how Members get
// a Course, and set its price and On sale (Plans & prices → One-time
// purchases); an Editor is refused on the server. Each takes effect at once,
// is logged in Staff Activity, and leaves the Course's save stamp alone, as
// Plans' On sale switch does. Switching to Sold separately leaves it not on
// sale until an Owner sets a price and turns it on; switching back to
// Included takes it off sale and keeps every Course Ownership. Who can open
// it follows from the access decision, so nothing else is written: progress
// is kept. A Course can't be deleted while anyone owns it or any Order names
// it: it can be hidden instead.
// ─────────────────────────────────────────────────────────────────────────────

/** Which Course: its own id, a Module's, or a Lesson's. */
export type CourseKey = { course: string } | { module: string } | { lesson: string };

/** One Course as an arm reads it: its Modules and Lessons, and their saves. */
export interface CourseState {
  course: Course;
  /** The Course's Modules, in order. */
  modules: CourseModule[];
  /** The Course's Lessons, by Module then position. */
  lessons: Lesson[];
  /** Each saved record's stamp, by record key (courseRecordOf and the rest). */
  stamps: Record<string, RecordStamp>;
  /** When the data was made: the stamp of a record nobody has saved. */
  seededAt: string;
  /** How many Members own the Course, and how many Orders name it (ticket 06). */
  owners: number;
  orders: number;
}

/** Everything a write changes, worked out on the Course as it is under the lock. */
export interface CourseWrites {
  /** The Course as it now is, when the write made it or changed its settings. */
  course?: Course;
  /**
   * How Members get the Course, its price and On sale, when an Owner changed
   * them (ticket 06): the builder's other writes never touch them.
   */
  sale?: CourseSale;
  /** The Course it deletes, with its Modules and Lessons (the database cascades). */
  removedCourse?: string;
  /** The Modules it adds or changes. */
  modules: CourseModule[];
  removedModules: string[];
  /** The Lessons it adds or changes. */
  lessons: Lesson[];
  removedLessons: string[];
  /** The stamps it sets, by record key. */
  stamps: Record<string, RecordStamp>;
  /** The stamps it drops, by record key: those of the records it deletes. */
  removedStamps: string[];
  activity: StaffActivity[];
}

/** A write's answer: refused, or its value and what it changes (null: nothing). */
export type CoursePlan<T> =
  { ok: false; error: AdminError } | { ok: true; value: T; writes: CourseWrites | null };

/** The Courses, for the list: each with its Lesson count. */
export interface CourseListing {
  courses: Course[];
  /** Each Course's Lessons, by Course id. */
  lessons: Record<string, number>;
}

/** How an arm reads and saves Courses. */
export interface CourseEditorStore {
  /** Every Course, with its Lesson count. */
  list(): Promise<CourseListing>;
  /** The Exams, each with its Subjects in order, as a Course can pick them. */
  exams(): Promise<CourseExamChoice[]>;
  /** The Course a key names, or null when it isn't there. */
  read(key: CourseKey): Promise<CourseState | null>;
  /**
   * How many Members have progress saved in each of these Lessons, by
   * Lesson id (a Lesson with none may be left out): their Lesson progress
   * records (ticket 04), which deleting the Lesson deletes.
   */
  savedPositions(lessonIds: readonly string[]): Promise<Record<string, number>>;
  /**
   * How many Members switching how they get the Course would affect at
   * `now` (ticket 06): `losing`, those with Lesson progress in it, an Access
   * Pass for its Exam ending after `now` and no Course Ownership of it;
   * `gaining`, those with such a pass and no Course Ownership of it.
   */
  accessChange(course: Pick<Course, "id" | "examCode">, now: Date): Promise<CourseAccessChange>;
  /**
   * Holds off every other content write, reads the Exams and the Course the
   * key names (none for a new Course) again, and saves the writes `plan`
   * works out on them, all or nothing. Gives plan's answer. Throws when the
   * save fails.
   */
  save<T>(
    key: CourseKey | null,
    plan: (current: CourseState | null, exams: CourseExamChoice[]) => CoursePlan<T>,
  ): Promise<CoursePlan<T>>;
  /** What a save finds at a cover upload's path (UploadLookup, for "course-cover"). */
  coverAt(path: string): Promise<ReturnType<UploadLookup>>;
  /** Deletes covers nothing uses any more, by public URL. Logs a failure, and never throws. */
  removeCovers(srcs: readonly string[]): Promise<void>;
}

/** The records' keys in the save stamps. */
export const courseRecordOf = (id: string) => `course:${id}`;
export const moduleRecordOf = (id: string) => `course-module:${id}`;
export const lessonRecordOf = (id: string) => `lesson:${id}`;

// ── Pure helpers ────────────────────────────────────────────────────────────

const ALREADY_FIRST_MODULE = "IT’S ALREADY THE FIRST MODULE";
const ALREADY_LAST_MODULE = "IT’S ALREADY THE LAST MODULE";
const ALREADY_FIRST_LESSON = "IT’S ALREADY THE FIRST LESSON IN ITS MODULE";
const ALREADY_LAST_LESSON = "IT’S ALREADY THE LAST LESSON IN ITS MODULE";
const UPLOAD_COVER_AGAIN = "UPLOAD THE COVER AGAIN";
const VIDEO_SERVICE_DIDNT_ANSWER = "THE VIDEO SERVICE DIDN’T ANSWER · TRY AGAIN";
const VIDEO_NOT_READY = "THE VIDEO ISN’T READY YET";
const WAIT_FOR_COVER = "WAIT FOR THE COVER TO FINISH UPLOADING";

const NO_WRITES: Omit<CourseWrites, "activity"> = {
  modules: [],
  removedModules: [],
  lessons: [],
  removedLessons: [],
  stamps: {},
  removedStamps: [],
};

const stampOf = (state: Pick<CourseState, "stamps" | "seededAt">, record: string): RecordStamp =>
  state.stamps[record] ?? { savedAt: state.seededAt, savedBy: null };

/** Pure: one Module's Lessons, in order. */
const lessonsIn = (lessons: readonly Lesson[], moduleId: string) =>
  lessons.filter((lesson) => lesson.moduleId === moduleId).sort((a, b) => a.position - b.position);

/** Pure: the Course's Lessons that are Published. */
const publishedIn = (lessons: readonly Lesson[]) =>
  lessons.filter((lesson) => lesson.state === "published").length;

/**
 * Pure: what deleting a Lesson does to a Visible Course: its last Published
 * Lesson deleted makes it Hidden, since a Course is Visible only with one (as
 * a deck's last card hides it). Unpublishing that last one is refused
 * instead (ticket 02: "Hide the course first").
 */
function hiddenAfter(
  current: CourseState,
  lessons: readonly Lesson[],
  actor: StaffActor,
  now: Date,
): Pick<CourseWrites, "course" | "activity"> {
  const after = visibilityAfterRemoval(current.course.visibility, publishedIn(lessons));
  if (!after.hidden) return { activity: [] };
  return {
    course: { ...current.course, visibility: after.visibility },
    activity: [
      activity(
        actor,
        now,
        "course",
        current.course.id,
        "hide",
        { visibility: current.course.visibility },
        { visibility: after.visibility },
      ),
    ],
  };
}

/** Pure: the Lesson's video still uploading or processing (its own, or its replacement), if any. */
function inFlight(lesson: Lesson): { videoId: string; replacing: boolean } | null {
  if (videoInFlight(lesson.state) && lesson.videoId) {
    return { videoId: lesson.videoId, replacing: false };
  }
  if (lesson.replacementVideoId && videoInFlight(lesson.replacementState)) {
    return { videoId: lesson.replacementVideoId, replacing: true };
  }
  return null;
}

/** A Lesson's video, as Staff Activity keeps it. */
const videoOf = ({
  state,
  videoId,
  videoSeconds,
  replacementVideoId,
  replacementState,
}: Lesson) => ({ state, videoId, videoSeconds, replacementVideoId, replacementState });

/** Pure: the videos a deleted Lesson leaves at the video service. */
const videosOf = (lesson: Lesson) =>
  [lesson.videoId, lesson.replacementVideoId]
    .filter((videoId): videoId is string => videoId !== null)
    .map((videoId) => ({ lesson: lesson.id, videoId }));

/** A video to delete at the service, and the Lesson it was on. */
interface VideoToDelete {
  lesson: string;
  videoId: string;
}

/** A Course's settings, as Staff Activity keeps them. */
const settingsOf = ({ title, description, examCode, subjectCode, coverSrc }: Course) => ({
  title,
  description,
  examCode,
  subjectCode,
  coverSrc,
});

/** A Lesson's fields, as Staff Activity keeps them. */
const lessonFieldsOf = ({ title, notes, freePreview }: Lesson) => ({ title, notes, freePreview });

const summaryOf = (course: Course, lessons: number): AdminCourseSummary => ({
  id: course.id,
  title: course.title,
  examCode: course.examCode,
  subjectCode: course.subjectCode,
  lessons,
  visibility: course.visibility,
});

const adminLessonOf = (lesson: Lesson, stamp: RecordStamp, savedPositions = 0): AdminLesson => ({
  ...lesson,
  stamp,
  savedPositions,
});

const adminModuleOf = (
  module: CourseModule,
  state: Pick<CourseState, "stamps" | "seededAt">,
  lessons: AdminLesson[],
): AdminCourseModule => ({
  id: module.id,
  position: module.position,
  title: module.title,
  stamp: stampOf(state, moduleRecordOf(module.id)),
  lessons,
});

const uuid = z.string().uuid();

/** A Staff Activity record of a change to a Course, a Module or a Lesson. */
const activity = (
  actor: StaffActor,
  now: Date,
  entity: "course" | "course-module" | "lesson",
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
) => activityRecord(actor, now, entity, entityId, action, before, after);

/** Pure: why a Course can't take this Exam and Subject, on the Subject field, or null. */
function placeRefusal(exams: readonly CourseExamChoice[], exam: string, subject: string) {
  const reason = subjectRefusal(
    exams.find((candidate) => candidate.code === exam),
    subject,
  );
  if (!reason) return null;
  const field = reason === "PICK AN EXAM" ? "exam" : "subject";
  return refused({ kind: "invalid", fieldErrors: { [field]: [reason] } });
}

const coverProblem = (message: string) =>
  refused({ kind: "invalid", fieldErrors: { cover: [message] } });

/** Pure: why a Course can't be deleted: someone owns it, or an Order names it; null when it can. */
const deleteBlockOf = ({ owners, orders }: Pick<CourseState, "owners" | "orders">) =>
  owners > 0 ? ("owned" as const) : orders > 0 ? ("ordered" as const) : null;

const OWNERS_ONLY = "ONLY AN OWNER CAN CHANGE HOW MEMBERS GET A COURSE OR ITS PRICE";
const SOLD_SEPARATELY_FIRST = "SWITCH IT TO SOLD SEPARATELY FIRST";
const SET_A_PRICE_FIRST = "SET A PRICE BEFORE PUTTING IT ON SALE";

/** How Members get a Course, its price and On sale: what only an Owner changes. */
type CourseSale = Pick<Course, "access" | "priceCentavos" | "onSale">;

/** Pure: a separately sold Course as One-time purchases lists it. */
const oneTimePurchaseOf = (course: Course): OneTimePurchase => ({
  id: course.id,
  title: course.title,
  examCode: course.examCode,
  subjectCode: course.subjectCode,
  priceCentavos: course.priceCentavos,
  onSale: course.onSale,
  visible: course.visibility === "visible",
});

// ── The seam's calls ────────────────────────────────────────────────────────

/** The Course builder's calls, on an arm's store. */
export function courseEditorCalls(store: CourseEditorStore) {
  /** Step 3: the cover a form sends: none, the Course's own, or a finished upload's URL. */
  async function coverSrcOf(
    wanted: string | null,
    current: string | null,
  ): Promise<{ ok: true; src: string | null } | { ok: false; error: AdminError }> {
    if (wanted === null || wanted === current) return { ok: true, src: wanted };
    const found = await store.coverAt(wanted);
    if (found === "waiting") return coverProblem(WAIT_FOR_COVER);
    if (!found) return coverProblem(UPLOAD_COVER_AGAIN);
    return { ok: true, src: found.publicUrl };
  }

  /** Steps 4 and 5: saves under the lock, then deletes the covers nothing uses. */
  async function saveThen<T>(
    key: CourseKey | null,
    plan: (current: CourseState | null, exams: CourseExamChoice[]) => CoursePlan<T>,
    unusedCovers: (value: T) => (string | null)[] = () => [],
  ): Promise<AdminResult<T>> {
    const saved = await store.save(key, plan);
    if (!saved.ok) return saved;
    const unused = unusedCovers(saved.value).filter((src): src is string => src !== null);
    if (unused.length > 0) await store.removeCovers(unused);
    return { ok: true, value: saved.value, tags: [] };
  }

  /**
   * Deletes videos at the video service once nothing uses them. Each one it
   * can't delete (refused, unreachable, or no service connected) is logged
   * in Staff Activity instead; never throws.
   */
  async function deleteVideos(
    actor: StaffActor,
    video: VideoService | null,
    videos: readonly VideoToDelete[],
  ): Promise<void> {
    const failed: VideoToDelete[] = [];
    for (const item of videos) {
      if (!(await video?.deleteVideo(item.videoId))) failed.push(item);
    }
    if (failed.length === 0) return;
    const now = new Date();
    try {
      await store.save(null, () => ({
        ok: true,
        value: null,
        writes: {
          ...NO_WRITES,
          activity: failed.map((item) =>
            activity(actor, now, "lesson", item.lesson, "video-delete-failed", item, null),
          ),
        },
      }));
    } catch (error) {
      console.error("A failed video delete couldn't be logged in Staff Activity.", error);
    }
  }

  async function listCoursesForAdmin(_actor: StaffActor): Promise<AdminCourseList> {
    const [{ courses, lessons }, exams] = await Promise.all([store.list(), store.exams()]);
    return {
      courses: [...courses]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
        .map((course) => summaryOf(course, lessons[course.id] ?? 0)),
      exams,
    };
  }

  async function getCourseForAdmin(actor: StaffActor, id: string): Promise<AdminCourse | null> {
    if (!uuid.safeParse(id).success) return null;
    const state = await store.read({ course: id });
    if (!state) return null;
    const exams = await store.exams();
    const [positions, accessChange] = await Promise.all([
      store.savedPositions(state.lessons.map((lesson) => lesson.id)),
      // Only an Owner switches how Members get it, so only an Owner's confirmation needs the counts.
      actor.role === "owner"
        ? store.accessChange(state.course, new Date())
        : Promise.resolve({ losing: 0, gaining: 0 }),
    ]);
    const exam = exams.find((candidate) => candidate.code === state.course.examCode);
    const subject = exam?.subjects.find((candidate) => candidate.code === state.course.subjectCode);
    return {
      course: state.course,
      exam: { code: state.course.examCode, name: exam?.name ?? state.course.examCode },
      subject: { code: state.course.subjectCode, name: subject?.name ?? state.course.subjectCode },
      stamp: stampOf(state, courseRecordOf(id)),
      modules: state.modules.map((module) =>
        adminModuleOf(
          module,
          state,
          lessonsIn(state.lessons, module.id).map((lesson) =>
            adminLessonOf(
              lesson,
              stampOf(state, lessonRecordOf(lesson.id)),
              positions[lesson.id] ?? 0,
            ),
          ),
        ),
      ),
      exams,
      accessChange,
      deleteBlocked: deleteBlockOf(state),
    };
  }

  async function createCourse(
    actor: StaffActor,
    input: NewCourseForm,
  ): Promise<AdminResult<AdminCourseSummary>> {
    const form = staffInput(actor, newCourseFormSchema, input);
    if (!form.ok) return form;
    const { title, description, exam, subject, cover } = form.value;
    const src = await coverSrcOf(cover, null);
    if (!src.ok) return src;
    const now = new Date();
    const id = crypto.randomUUID();
    return saveThen(null, (_current, exams): CoursePlan<AdminCourseSummary> => {
      const place = placeRefusal(exams, exam, subject);
      if (place) return place;
      // A new Course starts Hidden, Included in its Exam's All-Access, with no price.
      const course: Course = {
        id,
        examCode: exam,
        subjectCode: subject,
        title,
        description,
        coverSrc: src.src,
        visibility: "hidden",
        access: "included",
        priceCentavos: null,
        onSale: false,
        createdAt: now.toISOString(),
      };
      return {
        ok: true,
        value: summaryOf(course, 0),
        writes: {
          ...NO_WRITES,
          course,
          stamps: {
            [courseRecordOf(id)]: nextStamp(
              { savedAt: now.toISOString(), savedBy: null },
              actor.name,
              now,
            ),
          },
          activity: [activity(actor, now, "course", id, "add", null, course)],
        },
      };
    });
  }

  async function updateCourse(
    actor: StaffActor,
    input: CourseForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminCourseSummary>> {
    const form = staffInput(actor, courseFormSchema, input);
    if (!form.ok) return form;
    const { id, title, description, exam, subject, cover } = form.value;
    const before = await store.read({ course: id });
    if (!before) return NOT_FOUND;
    const opened = stampOf(before, courseRecordOf(id));
    if (expected && expected.savedAt !== opened.savedAt) {
      return refused({ kind: "conflict", ...opened });
    }
    const src = await coverSrcOf(cover, before.course.coverSrc);
    if (!src.ok) return src;
    const now = new Date();
    return saveThen(
      { course: id },
      (current, exams): CoursePlan<AdminCourseSummary> => {
        if (!current) return NOT_FOUND;
        // Again under the lock: a save since the read is a conflict too.
        const stamp = stampOf(current, courseRecordOf(id));
        if (stamp.savedAt !== opened.savedAt) return refused({ kind: "conflict", ...stamp });
        const place = placeRefusal(exams, exam, subject);
        if (place) return place;
        const course: Course = {
          ...current.course,
          title,
          description,
          examCode: exam,
          subjectCode: subject,
          coverSrc: src.src,
        };
        const moved = course.examCode !== current.course.examCode;
        return {
          ok: true,
          value: summaryOf(course, current.lessons.length),
          writes: {
            ...NO_WRITES,
            course,
            stamps: { [courseRecordOf(id)]: nextStamp(stamp, actor.name, now) },
            activity: [
              activity(
                actor,
                now,
                "course",
                id,
                moved ? "move-exam" : "edit",
                settingsOf(current.course),
                settingsOf(course),
              ),
            ],
          },
        };
      },
      // The replaced cover, once nothing uses it.
      () => [before.course.coverSrc !== src.src ? before.course.coverSrc : null],
    );
  }

  async function setCourseVisibility(
    actor: StaffActor,
    id: string,
    visible: boolean,
  ): Promise<AdminResult<{ visibility: ContentVisibility }>> {
    const form = staffInput(actor, courseVisibilityInputSchema, { course: id, visible });
    if (!form.ok) return form;
    const visibility: ContentVisibility = form.value.visible ? "visible" : "hidden";
    const now = new Date();
    return saveThen({ course: form.value.course }, (current) => {
      if (!current) return NOT_FOUND;
      const reason = visibilityRefusal(visibility, publishedIn(current.lessons));
      if (reason) return refused(formError(reason));
      if (current.course.visibility === visibility) {
        return { ok: true, value: { visibility }, writes: null };
      }
      return {
        ok: true,
        value: { visibility },
        writes: {
          ...NO_WRITES,
          course: { ...current.course, visibility },
          activity: [
            activity(
              actor,
              now,
              "course",
              current.course.id,
              visibility === "visible" ? "show" : "hide",
              { visibility: current.course.visibility },
              { visibility },
            ),
          ],
        },
      };
    });
  }

  async function deleteCourse(
    actor: StaffActor,
    id: string,
    video: VideoService | null,
  ): Promise<AdminResult<Course>> {
    const form = staffInput(actor, courseIdInputSchema, { id });
    if (!form.ok) return form;
    const now = new Date();
    const saved = await store.save(
      { course: form.value.id },
      (current): CoursePlan<{ course: Course; videos: VideoToDelete[] }> => {
        if (!current) return NOT_FOUND;
        const blocked = deleteBlockOf(current);
        if (blocked) return refused(formError(DELETE_BLOCKED[blocked]));
        const { course, modules, lessons } = current;
        return {
          ok: true,
          value: { course: structuredClone(course), videos: lessons.flatMap(videosOf) },
          writes: {
            ...NO_WRITES,
            removedCourse: course.id,
            removedModules: modules.map((module) => module.id),
            removedLessons: lessons.map((lesson) => lesson.id),
            removedStamps: [
              courseRecordOf(course.id),
              ...modules.map((module) => moduleRecordOf(module.id)),
              ...lessons.map((lesson) => lessonRecordOf(lesson.id)),
            ],
            // Staff Activity keeps every value the delete removes (spec, Phase 2 → Deleting).
            activity: [
              activity(
                actor,
                now,
                "course",
                course.id,
                "delete",
                { course, modules, lessons },
                null,
              ),
            ],
          },
        };
      },
    );
    if (!saved.ok) return saved;
    const { course, videos } = saved.value;
    if (course.coverSrc) await store.removeCovers([course.coverSrc]);
    await deleteVideos(actor, video, videos);
    return { ok: true, value: course, tags: [] };
  }

  /**
   * Owners only: a change to how Members get a Course, its price or On sale,
   * worked out on the Course as it is under the lock (`change` gives the new
   * sale, a refusal, or null for no change), saved with its Staff Activity,
   * which keeps the `logged` fields before and after.
   */
  async function saveSale<T>(
    actor: StaffActor,
    id: string,
    action: "set-access" | "set-price" | "set-on-sale",
    logged: readonly (keyof CourseSale)[],
    change: (course: Course) => { error: AdminError } | CourseSale | null,
    value: (course: Course) => T,
  ): Promise<AdminResult<T>> {
    const now = new Date();
    const fields = (course: Course) =>
      Object.fromEntries(logged.map((field) => [field, course[field]]));
    return saveThen({ course: id }, (current): CoursePlan<T> => {
      if (!current) return NOT_FOUND;
      const changed = change(current.course);
      if (changed && "error" in changed) return refused(changed.error);
      if (!changed) return { ok: true, value: value(current.course), writes: null };
      const course: Course = { ...current.course, ...changed };
      return {
        ok: true,
        value: value(course),
        writes: {
          ...NO_WRITES,
          course,
          sale: changed,
          activity: [
            activity(actor, now, "course", id, action, fields(current.course), fields(course)),
          ],
        },
      };
    });
  }

  /** Owners only: the role check, then the input's shape. */
  function ownerInput<Schema extends z.ZodTypeAny>(
    actor: StaffActor,
    schema: Schema,
    input: unknown,
  ): { ok: true; value: z.output<Schema> } | { ok: false; error: AdminError } {
    const role = roleRefusal(actor, "owner", OWNERS_ONLY);
    if (role) return refused(role);
    return staffInput(actor, schema, input);
  }

  /**
   * "How members get it" (ticket 06): Included in its Exam's All-Access, or
   * Sold separately. Either way it's off sale after; the price is kept.
   */
  async function setCourseAccess(
    actor: StaffActor,
    input: { id: string; access: Course["access"] },
  ): Promise<AdminResult<Course>> {
    const form = ownerInput(actor, courseAccessInputSchema, input);
    if (!form.ok) return form;
    const { id, access } = form.value;
    return saveSale(
      actor,
      id,
      "set-access",
      ["access", "onSale"],
      (course) =>
        course.access === access
          ? null
          : { access, priceCentavos: course.priceCentavos, onSale: false },
      (course) => course,
    );
  }

  /** Plans & prices → One-time purchases (ticket 06): every separately sold Course, oldest first. */
  async function listOneTimePurchases(actor: StaffActor): Promise<AdminResult<OneTimePurchase[]>> {
    const role = roleRefusal(actor, "owner", OWNERS_ONLY);
    if (role) return refused(role);
    const { courses } = await store.list();
    return {
      ok: true,
      value: courses
        .filter((course) => course.access === "sold-separately")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
        .map(oneTimePurchaseOf),
      tags: [],
    };
  }

  /** A One-time purchase's price (ticket 06): whole pesos within a Plan's limits; only a separately sold Course has one. */
  async function setCoursePrice(
    actor: StaffActor,
    input: { id: string; price: string | number },
  ): Promise<AdminResult<OneTimePurchase>> {
    const form = ownerInput(actor, coursePriceFormSchema, input);
    if (!form.ok) return form;
    const { id, priceCentavos } = form.value;
    return saveSale(
      actor,
      id,
      "set-price",
      ["priceCentavos"],
      (course) => {
        if (course.access !== "sold-separately") return { error: formError(SOLD_SEPARATELY_FIRST) };
        return course.priceCentavos === priceCentavos
          ? null
          : { access: course.access, priceCentavos, onSale: course.onSale };
      },
      oneTimePurchaseOf,
    );
  }

  /** A One-time purchase's On sale (ticket 06): only a separately sold Course with a price goes on sale. */
  async function setCourseOnSale(
    actor: StaffActor,
    input: { id: string; onSale: boolean },
  ): Promise<AdminResult<OneTimePurchase>> {
    const form = ownerInput(actor, courseOnSaleInputSchema, input);
    if (!form.ok) return form;
    const { id, onSale } = form.value;
    return saveSale(
      actor,
      id,
      "set-on-sale",
      ["onSale"],
      (course) => {
        if (course.onSale === onSale) return null;
        if (onSale && course.access !== "sold-separately") {
          return { error: formError(SOLD_SEPARATELY_FIRST) };
        }
        if (onSale && course.priceCentavos === null) return { error: formError(SET_A_PRICE_FIRST) };
        return { access: course.access, priceCentavos: course.priceCentavos, onSale };
      },
      oneTimePurchaseOf,
    );
  }

  async function createCourseModule(
    actor: StaffActor,
    input: NewCourseModuleForm,
  ): Promise<AdminResult<AdminCourseModule>> {
    const form = staffInput(actor, newCourseModuleFormSchema, input);
    if (!form.ok) return form;
    const { course: courseId, title } = form.value;
    const now = new Date();
    const id = crypto.randomUUID();
    return saveThen({ course: courseId }, (current): CoursePlan<AdminCourseModule> => {
      if (!current) return NOT_FOUND;
      const last = current.modules.at(-1)?.position ?? 0;
      const made: CourseModule = { id, courseId, position: last + 1, title };
      const stamp = nextStamp({ savedAt: current.seededAt, savedBy: null }, actor.name, now);
      return {
        ok: true,
        value: { id, position: made.position, title, stamp, lessons: [] },
        writes: {
          ...NO_WRITES,
          modules: [made],
          stamps: { [moduleRecordOf(id)]: stamp },
          activity: [
            activity(actor, now, "course-module", id, "add", null, {
              course: courseId,
              position: made.position,
              title,
            }),
          ],
        },
      };
    });
  }

  async function renameCourseModule(
    actor: StaffActor,
    input: CourseModuleForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<{ id: string; title: string; stamp: RecordStamp }>> {
    const form = staffInput(actor, courseModuleFormSchema, input);
    if (!form.ok) return form;
    const { id, title } = form.value;
    const before = await store.read({ module: id });
    if (!before) return NOT_FOUND;
    const opened = stampOf(before, moduleRecordOf(id));
    if (expected && expected.savedAt !== opened.savedAt) {
      return refused({ kind: "conflict", ...opened });
    }
    const now = new Date();
    return saveThen({ module: id }, (current) => {
      const found = current?.modules.find((candidate) => candidate.id === id);
      if (!current || !found) return NOT_FOUND;
      const stamp = stampOf(current, moduleRecordOf(id));
      if (stamp.savedAt !== opened.savedAt) return refused({ kind: "conflict", ...stamp });
      const next = nextStamp(stamp, actor.name, now);
      return {
        ok: true,
        value: { id, title, stamp: next },
        writes: {
          ...NO_WRITES,
          modules: [{ ...found, title }],
          stamps: { [moduleRecordOf(id)]: next },
          activity: [
            activity(actor, now, "course-module", id, "rename", { title: found.title }, { title }),
          ],
        },
      };
    });
  }

  async function moveCourseModule(
    actor: StaffActor,
    id: string,
    direction: ReviewMove,
  ): Promise<AdminResult<string[]>> {
    // Like ▲▼ everywhere, it always saves: there's no form to go stale.
    const form = staffInput(actor, courseModuleMoveInputSchema, { id, direction });
    if (!form.ok) return form;
    const now = new Date();
    return saveThen({ module: id }, (current): CoursePlan<string[]> => {
      const order = current?.modules ?? [];
      const index = order.findIndex((module) => module.id === id);
      if (!current || index < 0) return NOT_FOUND;
      const moved = swapped(order, index, form.value.direction);
      if (!moved) {
        return refused(
          formError(form.value.direction === "up" ? ALREADY_FIRST_MODULE : ALREADY_LAST_MODULE),
        );
      }
      const before = order.map((module) => module.id);
      const after = moved.map((module) => module.id);
      return {
        ok: true,
        value: after,
        writes: {
          ...NO_WRITES,
          modules: renumbered(moved),
          activity: [activity(actor, now, "course-module", id, "move", before, after)],
        },
      };
    });
  }

  async function deleteCourseModule(
    actor: StaffActor,
    id: string,
  ): Promise<AdminResult<CourseModule>> {
    const form = staffInput(actor, courseModuleIdInputSchema, { id });
    if (!form.ok) return form;
    const now = new Date();
    return saveThen({ module: id }, (current): CoursePlan<CourseModule> => {
      const found = current?.modules.find((candidate) => candidate.id === id);
      if (!current || !found) return NOT_FOUND;
      const reason = moduleDeleteRefusal(lessonsIn(current.lessons, id).length);
      if (reason) return refused(formError(reason));
      const rest = current.modules.filter((candidate) => candidate.id !== id);
      return {
        ok: true,
        value: structuredClone(found),
        writes: {
          ...NO_WRITES,
          modules: renumbered(rest),
          removedModules: [id],
          removedStamps: [moduleRecordOf(id)],
          activity: [activity(actor, now, "course-module", id, "delete", found, null)],
        },
      };
    });
  }

  async function createLesson(
    actor: StaffActor,
    input: NewLessonForm,
  ): Promise<AdminResult<AdminLesson>> {
    const form = staffInput(actor, newLessonFormSchema, input);
    if (!form.ok) return form;
    const { module: moduleId, title } = form.value;
    const now = new Date();
    const id = crypto.randomUUID();
    return saveThen({ module: moduleId }, (current): CoursePlan<AdminLesson> => {
      if (!current?.modules.some((module) => module.id === moduleId)) return NOT_FOUND;
      const last = lessonsIn(current.lessons, moduleId).at(-1)?.position ?? 0;
      // A new Lesson has no video yet, and isn't Free Preview.
      const lesson: Lesson = {
        id,
        moduleId,
        position: last + 1,
        title,
        notes: "",
        freePreview: false,
        state: "no-video",
        videoId: null,
        videoSeconds: null,
        replacementVideoId: null,
        replacementState: null,
      };
      const stamp = nextStamp({ savedAt: current.seededAt, savedBy: null }, actor.name, now);
      return {
        ok: true,
        value: adminLessonOf(lesson, stamp),
        writes: {
          ...NO_WRITES,
          lessons: [lesson],
          stamps: { [lessonRecordOf(id)]: stamp },
          activity: [activity(actor, now, "lesson", id, "add", null, lesson)],
        },
      };
    });
  }

  async function updateLesson(
    actor: StaffActor,
    input: LessonForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminLesson>> {
    const form = staffInput(actor, lessonFormSchema, input);
    if (!form.ok) return form;
    const { id, title, notes, freePreview } = form.value;
    const before = await store.read({ lesson: id });
    if (!before) return NOT_FOUND;
    const opened = stampOf(before, lessonRecordOf(id));
    if (expected && expected.savedAt !== opened.savedAt) {
      return refused({ kind: "conflict", ...opened });
    }
    const now = new Date();
    return saveThen({ lesson: id }, (current): CoursePlan<AdminLesson> => {
      const lesson = current?.lessons.find((candidate) => candidate.id === id);
      if (!current || !lesson) return NOT_FOUND;
      const stamp = stampOf(current, lessonRecordOf(id));
      if (stamp.savedAt !== opened.savedAt) return refused({ kind: "conflict", ...stamp });
      const edited: Lesson = { ...lesson, title, notes, freePreview };
      const next = nextStamp(stamp, actor.name, now);
      return {
        ok: true,
        value: adminLessonOf(edited, next),
        writes: {
          ...NO_WRITES,
          lessons: [edited],
          stamps: { [lessonRecordOf(id)]: next },
          activity: [
            activity(
              actor,
              now,
              "lesson",
              id,
              "edit",
              lessonFieldsOf(lesson),
              lessonFieldsOf(edited),
            ),
          ],
        },
      };
    });
  }

  async function moveLesson(
    actor: StaffActor,
    id: string,
    direction: ReviewMove,
  ): Promise<AdminResult<string[]>> {
    const form = staffInput(actor, lessonMoveInputSchema, { id, direction });
    if (!form.ok) return form;
    const now = new Date();
    return saveThen({ lesson: id }, (current): CoursePlan<string[]> => {
      const lesson = current?.lessons.find((candidate) => candidate.id === id);
      if (!current || !lesson) return NOT_FOUND;
      const order = lessonsIn(current.lessons, lesson.moduleId);
      const moved = swapped(
        order,
        order.findIndex((candidate) => candidate.id === id),
        form.value.direction,
      );
      if (!moved) {
        return refused(
          formError(form.value.direction === "up" ? ALREADY_FIRST_LESSON : ALREADY_LAST_LESSON),
        );
      }
      const before = order.map((candidate) => candidate.id);
      const after = moved.map((candidate) => candidate.id);
      return {
        ok: true,
        value: after,
        writes: {
          ...NO_WRITES,
          lessons: renumbered(moved),
          activity: [activity(actor, now, "lesson", id, "move", before, after)],
        },
      };
    });
  }

  async function moveLessonToModule(
    actor: StaffActor,
    input: LessonToModuleInput,
  ): Promise<AdminResult<string[]>> {
    const form = staffInput(actor, lessonToModuleInputSchema, input);
    if (!form.ok) return form;
    const { id, module: target } = form.value;
    const now = new Date();
    return saveThen({ lesson: id }, (current): CoursePlan<string[]> => {
      const lesson = current?.lessons.find((candidate) => candidate.id === id);
      if (!current || !lesson) return NOT_FOUND;
      // Only to another Module of the same Course.
      if (!current.modules.some((module) => module.id === target)) return NOT_FOUND;
      const order = lessonsIn(current.lessons, target).map((candidate) => candidate.id);
      if (lesson.moduleId === target) return { ok: true, value: order, writes: null };
      const after = lessonsAfterMoveToModule(current.lessons, id, target);
      const changed = after.filter((candidate) => {
        const was = current.lessons.find((old) => old.id === candidate.id);
        return was?.moduleId !== candidate.moduleId || was.position !== candidate.position;
      });
      return {
        ok: true,
        value: lessonsIn(after, target).map((candidate) => candidate.id),
        writes: {
          ...NO_WRITES,
          lessons: changed,
          activity: [
            activity(
              actor,
              now,
              "lesson",
              id,
              "move-to-module",
              { module: lesson.moduleId, position: lesson.position },
              { module: target, position: order.length + 1 },
            ),
          ],
        },
      };
    });
  }

  async function setLessonPublished(
    actor: StaffActor,
    id: string,
    published: boolean,
  ): Promise<AdminResult<AdminLesson>> {
    const form = staffInput(actor, lessonPublishInputSchema, { id, published });
    if (!form.ok) return form;
    const now = new Date();
    return saveThen({ lesson: id }, (current): CoursePlan<AdminLesson> => {
      const lesson = current?.lessons.find((candidate) => candidate.id === id);
      if (!current || !lesson) return NOT_FOUND;
      const stamp = stampOf(current, lessonRecordOf(id));
      const state = form.value.published ? "published" : "draft";
      if (form.value.published) {
        const reason = publishRefusal(lesson);
        if (reason) return refused(formError(reason));
      } else if (lesson.state === "published") {
        const after = publishedIn(current.lessons) - 1;
        const reason = unpublishRefusal(current.course.visibility, after);
        if (reason) return refused(formError(reason));
      }
      if (lesson.state === state || (!form.value.published && lesson.state !== "published")) {
        return { ok: true, value: adminLessonOf(lesson, stamp), writes: null };
      }
      const changed: Lesson = { ...lesson, state };
      return {
        ok: true,
        value: adminLessonOf(changed, stamp),
        writes: {
          ...NO_WRITES,
          lessons: [changed],
          activity: [
            activity(
              actor,
              now,
              "lesson",
              id,
              form.value.published ? "publish" : "unpublish",
              { state: lesson.state },
              { state },
            ),
          ],
        },
      };
    });
  }

  async function deleteLesson(
    actor: StaffActor,
    id: string,
    video: VideoService | null,
  ): Promise<AdminResult<Lesson>> {
    const form = staffInput(actor, lessonIdInputSchema, { id });
    if (!form.ok) return form;
    const now = new Date();
    const saved = await store.save({ lesson: id }, (current): CoursePlan<Lesson> => {
      const lesson = current?.lessons.find((candidate) => candidate.id === id);
      if (!current || !lesson) return NOT_FOUND;
      const rest = lessonsIn(current.lessons, lesson.moduleId).filter(
        (candidate) => candidate.id !== id,
      );
      const hidden = hiddenAfter(
        current,
        current.lessons.filter((candidate) => candidate.id !== id),
        actor,
        now,
      );
      return {
        ok: true,
        value: structuredClone(lesson),
        writes: {
          ...NO_WRITES,
          ...(hidden.course ? { course: hidden.course } : {}),
          lessons: renumbered(rest),
          removedLessons: [id],
          removedStamps: [lessonRecordOf(id)],
          activity: [
            // Staff Activity keeps every value the delete removes (spec, Phase 2 → Deleting).
            activity(actor, now, "lesson", id, "delete", lesson, null),
            ...hidden.activity,
          ],
        },
      };
    });
    if (!saved.ok) return saved;
    await deleteVideos(actor, video, videosOf(saved.value));
    return { ok: true, value: saved.value, tags: [] };
  }

  /** The Lesson a key names in a Course read, with its stamp, or null. */
  const lessonIn = (current: CourseState | null, id: string) => {
    const lesson = current?.lessons.find((candidate) => candidate.id === id);
    return current && lesson ? { lesson, stamp: stampOf(current, lessonRecordOf(id)) } : null;
  };

  async function startLessonUpload(
    actor: StaffActor,
    input: LessonUploadInput,
    video: VideoService | null,
  ): Promise<AdminResult<AdminLessonUpload>> {
    const form = staffInput(actor, lessonUploadInputSchema, input);
    if (!form.ok) return form;
    if (!video) return refused(formError(CONNECT_VIDEO_SERVICE_REFUSAL));
    const { id } = form.value;
    const before = lessonIn(await store.read({ lesson: id }), id);
    if (!before) return NOT_FOUND;
    const permission = await video.uploadPermission(before.lesson.title);
    if (!permission) return refused(formError(VIDEO_SERVICE_DIDNT_ANSWER));
    const { videoId, target } = permission;
    const now = new Date();
    const saved = await store.save(
      { lesson: id },
      (current): CoursePlan<{ upload: AdminLessonUpload; dropped: string | null }> => {
        const found = lessonIn(current, id);
        if (!found) return NOT_FOUND;
        const { lesson, stamp } = found;
        // With a ready video it's a replacement: the ready one plays until the new one is ready.
        const replacing = hasReadyVideo(lesson.state);
        const changed: Lesson = replacing
          ? { ...lesson, replacementVideoId: videoId, replacementState: "uploading" }
          : { ...lesson, state: "uploading", videoId, videoSeconds: null };
        return {
          ok: true,
          value: {
            upload: { lesson: adminLessonOf(changed, stamp), videoId, target },
            dropped: replacing ? lesson.replacementVideoId : lesson.videoId,
          },
          writes: {
            ...NO_WRITES,
            lessons: [changed],
            activity: [
              activity(
                actor,
                now,
                "lesson",
                id,
                replacing ? "replace-video" : "upload-video",
                videoOf(lesson),
                videoOf(changed),
              ),
            ],
          },
        };
      },
    );
    if (!saved.ok) {
      // The Lesson went while permission was asked: nothing will use the new video.
      await deleteVideos(actor, video, [{ lesson: id, videoId }]);
      return saved;
    }
    const { upload, dropped } = saved.value;
    if (dropped) await deleteVideos(actor, video, [{ lesson: id, videoId: dropped }]);
    return { ok: true, value: upload, tags: [] };
  }

  async function finishLessonUpload(
    actor: StaffActor,
    input: LessonUploadOutcomeInput,
  ): Promise<AdminResult<AdminLesson>> {
    const form = staffInput(actor, lessonUploadOutcomeInputSchema, input);
    if (!form.ok) return form;
    const { id, video: videoId, outcome } = form.value;
    const now = new Date();
    return saveThen({ lesson: id }, (current): CoursePlan<AdminLesson> => {
      const found = lessonIn(current, id);
      if (!found) return NOT_FOUND;
      const { lesson, stamp } = found;
      let changed: Lesson | null = null;
      if (lesson.videoId === videoId && lesson.state === "uploading") {
        changed = { ...lesson, state: outcome === "sent" ? "processing" : "upload-failed" };
      } else if (lesson.replacementVideoId === videoId && lesson.replacementState === "uploading") {
        changed = {
          ...lesson,
          replacementState: outcome === "sent" ? "processing" : "upload-failed",
        };
      }
      // A word about a video the Lesson has moved on from changes nothing.
      if (!changed) return { ok: true, value: adminLessonOf(lesson, stamp), writes: null };
      return {
        ok: true,
        value: adminLessonOf(changed, stamp),
        writes: {
          ...NO_WRITES,
          lessons: [changed],
          activity: [
            activity(
              actor,
              now,
              "lesson",
              id,
              outcome === "sent" ? "video-uploaded" : "upload-failed",
              videoOf(lesson),
              videoOf(changed),
            ),
          ],
        },
      };
    });
  }

  async function checkLessonVideo(
    actor: StaffActor,
    id: string,
    video: VideoService | null,
  ): Promise<AdminResult<AdminLesson>> {
    const form = staffInput(actor, lessonIdInputSchema, { id });
    if (!form.ok) return form;
    const before = lessonIn(await store.read({ lesson: id }), id);
    if (!before) return NOT_FOUND;
    const asked = inFlight(before.lesson);
    if (!asked || !video) {
      return { ok: true, value: adminLessonOf(before.lesson, before.stamp), tags: [] };
    }
    const status = await video.videoStatus(asked.videoId);
    const now = new Date();
    const saved = await store.save(
      { lesson: id },
      (current): CoursePlan<{ lesson: AdminLesson; dropped: string | null }> => {
        const found = lessonIn(current, id);
        if (!found) return NOT_FOUND;
        const { lesson, stamp } = found;
        const unchanged = {
          ok: true as const,
          value: { lesson: adminLessonOf(lesson, stamp), dropped: null },
          writes: null,
        };
        // The Lesson moved on while the service was asked (another upload, a delete of it).
        const still = inFlight(lesson);
        if (still?.videoId !== asked.videoId) return unchanged;
        let changed: Lesson | null = null;
        let action = "";
        let dropped: string | null = null;
        if (status.status === "ready") {
          action = "video-ready";
          if (still.replacing) {
            // The new video takes over; the old one goes once this is saved.
            dropped = lesson.videoId;
            changed = {
              ...lesson,
              videoId: still.videoId,
              videoSeconds: status.seconds,
              replacementVideoId: null,
              replacementState: null,
            };
          } else {
            changed = { ...lesson, state: "draft", videoSeconds: status.seconds };
          }
        } else if (status.status === "failed") {
          action = "video-failed";
          changed = still.replacing
            ? { ...lesson, replacementState: "upload-failed" }
            : { ...lesson, state: "upload-failed" };
        } else if (status.status === "processing") {
          // The file arrived though the browser never said so (closed mid-way, say).
          action = "video-uploaded";
          if (still.replacing && lesson.replacementState === "uploading") {
            changed = { ...lesson, replacementState: "processing" };
          } else if (!still.replacing && lesson.state === "uploading") {
            changed = { ...lesson, state: "processing" };
          }
        }
        if (!changed) return unchanged;
        return {
          ok: true,
          value: { lesson: adminLessonOf(changed, stamp), dropped },
          writes: {
            ...NO_WRITES,
            lessons: [changed],
            activity: [
              activity(actor, now, "lesson", id, action, videoOf(lesson), videoOf(changed)),
            ],
          },
        };
      },
    );
    if (!saved.ok) return saved;
    const { lesson, dropped } = saved.value;
    if (dropped) await deleteVideos(actor, video, [{ lesson: id, videoId: dropped }]);
    return { ok: true, value: lesson, tags: [] };
  }

  async function previewLessonVideo(
    actor: StaffActor,
    id: string,
    video: VideoService | null,
  ): Promise<AdminResult<AdminLessonPreview>> {
    const form = staffInput(actor, lessonIdInputSchema, { id });
    if (!form.ok) return form;
    if (!video) return refused(formError(CONNECT_VIDEO_SERVICE_REFUSAL));
    const found = lessonIn(await store.read({ lesson: id }), id);
    if (!found) return NOT_FOUND;
    const { videoId, videoSeconds } = found.lesson;
    if (!hasReadyVideo(found.lesson.state) || !videoId || videoSeconds === null) {
      return refused(formError(VIDEO_NOT_READY));
    }
    // Staff watch with their own email drawn across the video, and no device check.
    const pass = await video.playbackPass(videoId, actor.email);
    if (!pass) return refused(formError(VIDEO_SERVICE_DIDNT_ANSWER));
    return { ok: true, value: { pass, seconds: videoSeconds }, tags: [] };
  }

  return {
    listCoursesForAdmin,
    getCourseForAdmin,
    createCourse,
    updateCourse,
    setCourseVisibility,
    setCourseAccess,
    listOneTimePurchases,
    setCoursePrice,
    setCourseOnSale,
    deleteCourse,
    createCourseModule,
    renameCourseModule,
    moveCourseModule,
    deleteCourseModule,
    createLesson,
    updateLesson,
    moveLesson,
    moveLessonToModule,
    setLessonPublished,
    deleteLesson,
    startLessonUpload,
    finishLessonUpload,
    checkLessonVideo,
    previewLessonVideo,
  };
}
