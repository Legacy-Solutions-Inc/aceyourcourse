import {
  type AccessCourse,
  type AccessDecision,
  accessDecision,
  type MemberAccess,
} from "@/lib/member-app/access";
import { memberWatermark } from "@/lib/member-app/member-id";
import {
  courseLessons,
  type LessonRecord,
  lessonAfterCompleting,
  lessonAfterSaving,
  lessonResume,
  lessonStudyDay,
  type ProgressCourse,
} from "@/lib/member-app/progress";
import type { Course, CourseModule, Lesson } from "@/services/courses.types";
import {
  isRecordId,
  lessonCompleteInputSchema,
  lessonPositionInputSchema,
  lessonRefSchema,
  memberUserIdSchema,
} from "@/services/member.schema";
import type {
  CourseOpening,
  CourseShelf,
  LessonCompleteInput,
  LessonOpening,
  LessonPlayer,
  LessonPositionInput,
  LessonRef,
  LessonSaveResult,
  MemberCourse,
  MemberModule,
} from "@/services/member.types";
import type { VideoService } from "@/services/video.types";

// ─────────────────────────────────────────────────────────────────────────────
// Watching video Courses (Phase 5, ticket 03; spec, Phase 3 → Access decision
// seam as amended on 2026-11-28; Phase 5 planning decisions → Access and
// playback, The Courses screen): the Member seam's Course calls, written once
// over a small store port that each arm implements (member.mock.ts over the
// sample store, member.db.ts over Postgres), so both arms apply the same
// rules.
//
// Every Course and Lesson is decided by the access decision, from the Course
// as it is now and the Member's own Course Ownership, which the store reads
// for the User id given and nobody else. Members only ever see Published
// Lessons. A playback pass is asked of the video service only once the
// decision allows the Lesson, which also means the request came from the
// Member's Active Device, and it draws the Member's own email and short
// Member ID (from their record, never from the browser) across the video.
//
// Watching saves progress (ticket 04; spec, Phase 5 planning decisions →
// Watching a Lesson): each position save and "Mark complete" runs the access
// decision first (the Active Device included, so a save from a replaced
// device is refused and the player stops with "Session ended"), stores
// nothing when refused or for a position outside the Lesson's length, and
// otherwise makes the day a Study Day in Manila time. The pure rules (done at
// 90%, done stays done, where a Lesson resumes) are the progress
// calculator's (src/lib/member-app/progress.ts).
// ─────────────────────────────────────────────────────────────────────────────

/** A Course with its Modules and Lessons, in no particular order. */
export interface CourseTree {
  course: Course;
  modules: CourseModule[];
  lessons: Lesson[];
}

/** What each arm gives the Course calls. */
export interface CourseStudyStore {
  /** The Exam's Subjects in the Exam's order; none for an Exam that isn't one. */
  readExamSubjects(examCode: string): Promise<{ code: string; name: string }[]>;
  /** The Exam's Courses, Hidden ones too, each whole. */
  readExamCourses(examCode: string): Promise<CourseTree[]>;
  /** One Course, whole, or null. */
  readCourse(courseId: string): Promise<CourseTree | null>;
  /** The Course a Lesson is in, whole, or null when there's no such Lesson. */
  readCourseOfLesson(lessonId: string): Promise<CourseTree | null>;
  /** The ids of the Courses this Member owns: their own Course Ownerships only. */
  readOwnedCourseIds(userId: string): Promise<string[]>;
  /** The Member's email, as their record holds it, or null for a User with no Member record. */
  readMemberEmail(userId: string): Promise<string | null>;
  /** The Member's own progress in these Lessons: nobody else's. */
  readLessonProgress(userId: string, lessonIds: readonly string[]): Promise<LessonRecord[]>;
  /**
   * Saves the Member's progress in a Lesson, replacing their earlier record
   * (never moving its furthest point back or undoing done), and `day` as a
   * Study Day, together. False, saving nothing, when the Lesson has gone
   * meanwhile. Throws for a User with no Member record.
   */
  saveLessonProgress(userId: string, record: LessonRecord, day: string): Promise<boolean>;
}

const NOT_FOUND = { status: "not-found" } as const;
const SAVE_NOT_FOUND = { ok: false, refusal: { reason: "not-found" } } as const;
const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;
const isPublished = (lesson: Lesson) => lesson.state === "published";

/** Pure: the Course's facts the access decision reads, for a Member who owns it or not. */
export function accessCourseOf(course: Course, owned: boolean): AccessCourse {
  return {
    visible: course.visibility === "visible",
    soldSeparately: course.access === "sold-separately",
    owned,
  };
}

/** Pure: the Modules with a Published Lesson, in order, each with those Lessons in order. */
export function publishedModules(tree: CourseTree): { module: CourseModule; lessons: Lesson[] }[] {
  return [...tree.modules].sort(byPosition).flatMap((module) => {
    const lessons = tree.lessons
      .filter((lesson) => lesson.moduleId === module.id && isPublished(lesson))
      .sort(byPosition);
    return lessons.length > 0 ? [{ module, lessons }] : [];
  });
}

/** Pure: a Course with its Published Lessons in order, as the progress calculator counts it. */
export function progressCourseOf(tree: CourseTree): ProgressCourse {
  return {
    id: tree.course.id,
    subjectCode: tree.course.subjectCode,
    lessons: publishedModules(tree).flatMap(({ lessons }) =>
      lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        seconds: lesson.videoSeconds ?? 0,
      })),
    ),
  };
}

/** The Course calls over one arm's store (the Member seam's contract, in member.ts). */
export function courseStudyCalls(store: CourseStudyStore) {
  /** Everything the calls decide a Course with, for this Member now. */
  function deciderFor(tree: CourseTree, owned: boolean, access: MemberAccess) {
    const course = accessCourseOf(tree.course, owned);
    const decide = (lesson: { available: boolean; freePreview: boolean }): AccessDecision =>
      accessDecision({ ...access, content: { examCode: tree.course.examCode, ...lesson, course } });
    return {
      /** One Lesson as it is now. */
      lesson: (lesson: Lesson) =>
        decide({ available: isPublished(lesson), freePreview: lesson.freePreview }),
      /** Its Published Lessons that aren't Free Preview: the card's state. */
      fullLessons: () => decide({ available: true, freePreview: false }),
      /** Whether its Lesson list opens at all: as a Free Preview Lesson would. */
      lessonList: () => decide({ available: true, freePreview: true }),
    };
  }

  /** Pure: the Course as the Member sees it, with their progress in it. */
  function memberCourseOf(
    tree: CourseTree,
    owned: boolean,
    decision: AccessDecision,
    records: readonly LessonRecord[],
  ): MemberCourse {
    const progress = courseLessons(progressCourseOf(tree), records);
    const modules = publishedModules(tree);
    const lessons = modules.flatMap((module) => module.lessons);
    const free = lessons.filter((lesson) => lesson.freePreview);
    const { course } = tree;
    return {
      id: course.id,
      examCode: course.examCode,
      subjectCode: course.subjectCode,
      title: course.title,
      description: course.description,
      coverSrc: course.coverSrc,
      access: course.access,
      priceCentavos: course.priceCentavos,
      onSale: course.onSale,
      visible: course.visibility === "visible",
      owned,
      modules: modules.length,
      lessons: lessons.length,
      freePreviewLessons: free.length,
      firstLessonId: lessons[0]?.id ?? null,
      firstFreeLessonId: free[0]?.id ?? null,
      decision,
      lessonsDone: progress.done,
      continueLesson: progress.continueLesson,
    };
  }

  /** Pure: the outline the Member sees, each Lesson playable as the decision says, and done or not. */
  function outlineOf(
    tree: CourseTree,
    decided: (lesson: Lesson) => AccessDecision,
    records: readonly LessonRecord[],
  ): MemberModule[] {
    const done = new Set(
      records.filter((record) => record.doneAt).map((record) => record.lessonId),
    );
    return publishedModules(tree).map(({ module, lessons }, index) => ({
      id: module.id,
      number: index + 1,
      title: module.title,
      lessons: lessons.map((lesson, place) => ({
        id: lesson.id,
        number: place + 1,
        title: lesson.title,
        seconds: lesson.videoSeconds ?? 0,
        freePreview: lesson.freePreview,
        playable: decided(lesson).outcome === "allowed",
        done: done.has(lesson.id),
      })),
    }));
  }

  async function ownedBy(userId: string, courseId: string): Promise<boolean> {
    return (await store.readOwnedCourseIds(userId)).includes(courseId);
  }

  /** The Member's own progress in these Courses' Lessons. */
  function progressIn(member: string, trees: readonly CourseTree[]): Promise<LessonRecord[]> {
    const lessonIds = trees.flatMap((tree) => tree.lessons.map((lesson) => lesson.id));
    return lessonIds.length > 0 ? store.readLessonProgress(member, lessonIds) : Promise.resolve([]);
  }

  async function listCourses(
    userId: string,
    examCode: string,
    access: MemberAccess,
  ): Promise<CourseShelf> {
    const member = memberUserIdSchema.parse(userId);
    const exam = examCode.trim().toUpperCase();
    const [subjects, trees, ownedIds] = await Promise.all([
      store.readExamSubjects(exam),
      store.readExamCourses(exam),
      store.readOwnedCourseIds(member),
    ]);
    const owned = new Set(ownedIds);
    const shown = trees
      // A Hidden Course is gone from the shelf for everyone but its owners.
      .filter(({ course }) => course.visibility === "visible" || owned.has(course.id))
      .sort((a, b) => a.course.createdAt.localeCompare(b.course.createdAt));
    const records = await progressIn(member, shown);
    const courses = shown.map((tree) => {
      const mine = owned.has(tree.course.id);
      return memberCourseOf(tree, mine, deciderFor(tree, mine, access).fullLessons(), records);
    });
    return { subjects, courses };
  }

  async function openCourse(
    userId: string,
    courseId: string,
    access: MemberAccess,
  ): Promise<CourseOpening> {
    const member = memberUserIdSchema.parse(userId);
    // The address is the browser's: an id that isn't a Course's is not found.
    const tree = isRecordId(courseId) ? await store.readCourse(courseId) : null;
    if (!tree) return NOT_FOUND;
    const [owned, records] = await Promise.all([
      ownedBy(member, tree.course.id),
      progressIn(member, [tree]),
    ]);
    const decider = deciderFor(tree, owned, access);
    const course = memberCourseOf(tree, owned, decider.fullLessons(), records);

    const list = decider.lessonList();
    if (list.outcome !== "allowed") return { status: "refused", course, decision: list };
    return { status: "open", course, outline: outlineOf(tree, decider.lesson, records) };
  }

  /** The player for an allowed Lesson: a pass for the Member's own watermark, or why there's none. */
  async function playerFor(
    member: string,
    lesson: Lesson,
    video: VideoService | null,
  ): Promise<LessonPlayer> {
    if (!video) return { kind: "not-connected" };
    const { videoId, videoSeconds } = lesson;
    if (!videoId || videoSeconds === null) return { kind: "didnt-answer" };
    const email = await store.readMemberEmail(member);
    if (email === null) throw new Error("Only a Member watches Lessons.");
    const watermark = memberWatermark(email, member);
    const pass = await video.playbackPass(videoId, watermark);
    return pass
      ? { kind: "pass", pass, seconds: videoSeconds, watermark }
      : { kind: "didnt-answer" };
  }

  async function openLesson(
    userId: string,
    ref: LessonRef,
    access: MemberAccess,
    video: VideoService | null,
  ): Promise<LessonOpening> {
    const member = memberUserIdSchema.parse(userId);
    // The address is the browser's: a Lesson that isn't in the Course it names is not found.
    const sent = lessonRefSchema.safeParse(ref);
    if (!sent.success) return NOT_FOUND;
    const { courseId, lessonId } = sent.data;
    const tree = isRecordId(lessonId) ? await store.readCourseOfLesson(lessonId) : null;
    const lesson = tree?.lessons.find((candidate) => candidate.id === lessonId);
    if (!tree || !lesson || tree.course.id !== courseId) return NOT_FOUND;
    const [owned, records] = await Promise.all([
      ownedBy(member, tree.course.id),
      progressIn(member, [tree]),
    ]);
    const decider = deciderFor(tree, owned, access);
    const course = memberCourseOf(tree, owned, decider.fullLessons(), records);

    // The access decision first: a refused Lesson gets no pass, whatever its address.
    const decision = decider.lesson(lesson);
    if (decision.outcome !== "allowed") {
      return {
        status: "refused",
        course,
        lesson: { id: lesson.id, title: lesson.title },
        decision,
      };
    }

    const outline = outlineOf(tree, decider.lesson, records);
    const inModule = outline.find((candidate) =>
      candidate.lessons.some((each) => each.id === lesson.id),
    );
    const listed = inModule?.lessons.find((each) => each.id === lesson.id);
    // Allowed means Published, so it's in the outline.
    if (!inModule || !listed) throw new Error("An allowed Lesson is missing from its outline.");
    return {
      status: "allowed",
      course,
      outline,
      lesson: {
        ...listed,
        notes: lesson.notes,
        moduleNumber: inModule.number,
        resume: lessonResume(records.find((record) => record.lessonId === lesson.id) ?? null),
      },
      via: decision.via,
      player: await playerFor(member, lesson, video),
    };
  }

  /**
   * A Lesson decided for a save: it and its length when the access decision
   * allows it (which also means the request came from the Active Device), or
   * why nothing may be stored.
   */
  async function lessonForSave(
    member: string,
    lessonId: string,
    access: MemberAccess,
  ): Promise<{ lesson: Lesson; seconds: number } | { refusal: LessonSaveResult }> {
    // The id is the browser's: one that isn't a Lesson's is not found.
    const tree = isRecordId(lessonId) ? await store.readCourseOfLesson(lessonId) : null;
    const lesson = tree?.lessons.find((candidate) => candidate.id === lessonId);
    if (!tree || !lesson) return { refusal: SAVE_NOT_FOUND };
    const owned = await ownedBy(member, tree.course.id);
    const decision = deciderFor(tree, owned, access).lesson(lesson);
    if (decision.outcome !== "allowed") {
      return { refusal: { ok: false, refusal: { reason: "refused", decision } } };
    }
    // Allowed means Published, which means a ready video with its length.
    if (lesson.videoSeconds === null) throw new Error("A Published Lesson has no length.");
    return { lesson, seconds: lesson.videoSeconds };
  }

  /** Stores a Lesson's new record and the day, in Manila, as a Study Day. */
  async function storeRecord(member: string, record: LessonRecord, access: MemberAccess) {
    const saved = await store.saveLessonProgress(member, record, lessonStudyDay(access.now));
    return saved ? ({ ok: true, value: record } as const) : SAVE_NOT_FOUND;
  }

  async function earlierRecord(member: string, lessonId: string): Promise<LessonRecord | null> {
    const [record] = await store.readLessonProgress(member, [lessonId]);
    return record ?? null;
  }

  async function saveLessonPosition(
    userId: string,
    input: LessonPositionInput,
    access: MemberAccess,
  ): Promise<LessonSaveResult> {
    const member = memberUserIdSchema.parse(userId);
    const sent = lessonPositionInputSchema.safeParse(input);
    if (!sent.success) return SAVE_NOT_FOUND;
    const found = await lessonForSave(member, sent.data.lessonId, access);
    if ("refusal" in found) return found.refusal;
    const { lesson, seconds } = found;
    const position = Math.floor(sent.data.position);
    if (position < 0 || position > seconds) {
      return { ok: false, refusal: { reason: "out-of-range" } };
    }
    const before = await earlierRecord(member, lesson.id);
    const at = access.now.toISOString();
    return storeRecord(member, lessonAfterSaving(before, lesson.id, position, seconds, at), access);
  }

  async function completeLesson(
    userId: string,
    input: LessonCompleteInput,
    access: MemberAccess,
  ): Promise<LessonSaveResult> {
    const member = memberUserIdSchema.parse(userId);
    const sent = lessonCompleteInputSchema.safeParse(input);
    if (!sent.success) return SAVE_NOT_FOUND;
    const found = await lessonForSave(member, sent.data.lessonId, access);
    if ("refusal" in found) return found.refusal;
    const before = await earlierRecord(member, found.lesson.id);
    const at = access.now.toISOString();
    return storeRecord(member, lessonAfterCompleting(before, found.lesson.id, at), access);
  }

  return { listCourses, openCourse, openLesson, saveLessonPosition, completeLesson };
}
