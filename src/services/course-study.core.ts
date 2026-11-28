import {
  type AccessCourse,
  type AccessDecision,
  accessDecision,
  type MemberAccess,
} from "@/lib/member-app/access";
import { memberWatermark } from "@/lib/member-app/member-id";
import type { Course, CourseModule, Lesson } from "@/services/courses.types";
import { isRecordId, lessonRefSchema, memberUserIdSchema } from "@/services/member.schema";
import type {
  CourseOpening,
  CourseShelf,
  LessonOpening,
  LessonPlayer,
  LessonRef,
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
}

const NOT_FOUND = { status: "not-found" } as const;
const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;
const isPublished = (lesson: Lesson) => lesson.state === "published";

/** Pure: the Course's facts the access decision reads, for a Member who owns it or not. */
function accessCourseOf(course: Course, owned: boolean): AccessCourse {
  return {
    visible: course.visibility === "visible",
    soldSeparately: course.access === "sold-separately",
    owned,
  };
}

/** Pure: the Modules with a Published Lesson, in order, each with those Lessons in order. */
function publishedModules(tree: CourseTree): { module: CourseModule; lessons: Lesson[] }[] {
  return [...tree.modules].sort(byPosition).flatMap((module) => {
    const lessons = tree.lessons
      .filter((lesson) => lesson.moduleId === module.id && isPublished(lesson))
      .sort(byPosition);
    return lessons.length > 0 ? [{ module, lessons }] : [];
  });
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

  /** Pure: the Course as the Member sees it. */
  function memberCourseOf(
    tree: CourseTree,
    owned: boolean,
    decision: AccessDecision,
  ): MemberCourse {
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
    };
  }

  /** Pure: the outline the Member sees, each Lesson playable as the decision says. */
  function outlineOf(
    tree: CourseTree,
    decided: (lesson: Lesson) => AccessDecision,
  ): MemberModule[] {
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
      })),
    }));
  }

  async function ownedBy(userId: string, courseId: string): Promise<boolean> {
    return (await store.readOwnedCourseIds(userId)).includes(courseId);
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
    const courses = trees
      // A Hidden Course is gone from the shelf for everyone but its owners.
      .filter(({ course }) => course.visibility === "visible" || owned.has(course.id))
      .sort((a, b) => a.course.createdAt.localeCompare(b.course.createdAt))
      .map((tree) => {
        const mine = owned.has(tree.course.id);
        return memberCourseOf(tree, mine, deciderFor(tree, mine, access).fullLessons());
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
    const owned = await ownedBy(member, tree.course.id);
    const decider = deciderFor(tree, owned, access);
    const course = memberCourseOf(tree, owned, decider.fullLessons());

    const list = decider.lessonList();
    if (list.outcome !== "allowed") return { status: "refused", course, decision: list };
    return { status: "open", course, outline: outlineOf(tree, decider.lesson) };
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
    const owned = await ownedBy(member, tree.course.id);
    const decider = deciderFor(tree, owned, access);
    const course = memberCourseOf(tree, owned, decider.fullLessons());

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

    const outline = outlineOf(tree, decider.lesson);
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
      },
      via: decision.via,
      player: await playerFor(member, lesson, video),
    };
  }

  return { listCourses, openCourse, openLesson };
}
