import type { CourseExamChoice } from "@/services/admin.types";
import {
  type CourseEditorStore,
  courseEditorCalls,
  type CourseKey,
  type CourseState,
  type CourseWrites,
} from "@/services/course-editor.core";
import type { CourseModule } from "@/services/courses.types";
import { getSampleStore } from "@/services/mock/sample-store";
import { sampleUploadAt } from "@/services/uploads.mock";

// ─────────────────────────────────────────────────────────────────────────────
// The sample arm of the Admin seam's Course builder (Phase 5, ticket 01): the
// shared builder (src/services/course-editor.core.ts) over the in-memory
// sample store. A save reads the Course and applies its writes with no await
// in between, so no other request can come between them; should any part of
// it fail, the parts already applied are put back. Deleting a Course deletes
// its Modules and Lessons, as the database's cascade does. Covers are the
// sample uploads; a replaced one stays until the next reset (orphans are
// fine in the sample data).
// ─────────────────────────────────────────────────────────────────────────────

/** The Course a key names: its own id, its Module's Course, or its Lesson's Module's Course. */
function courseIdOf(key: CourseKey): string | undefined {
  const { courseModules, lessons } = getSampleStore();
  if ("course" in key) return key.course;
  const moduleId =
    "module" in key ? key.module : lessons.find((lesson) => lesson.id === key.lesson)?.moduleId;
  return courseModules.find((module) => module.id === moduleId)?.courseId;
}

function readExams(): CourseExamChoice[] {
  return structuredClone(
    getSampleStore().catalogue.exams.map(({ code, name, subjects }) => ({
      code,
      name,
      subjects: subjects.map((subject) => ({ code: subject.code, name: subject.name })),
    })),
  );
}

/** A Course, its Modules and Lessons, as the store holds them now, or null when the key names nothing. */
function readCourse(key: CourseKey): CourseState | null {
  const store = getSampleStore();
  const id = courseIdOf(key);
  const course = store.courses.find((candidate) => candidate.id === id);
  if (!course) return null;
  const modules = store.courseModules
    .filter((module) => module.courseId === course.id)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const order = new Map(modules.map((module, index) => [module.id, index]));
  const lessons = store.lessons
    .filter((lesson) => order.has(lesson.moduleId))
    .sort(
      (a, b) =>
        (order.get(a.moduleId) ?? 0) - (order.get(b.moduleId) ?? 0) ||
        a.position - b.position ||
        a.id.localeCompare(b.id),
    );
  return structuredClone({
    course,
    modules,
    lessons,
    stamps: store.stamps,
    seededAt: store.bootedAt,
  });
}

/** Pure: the list with the changed items replaced or added, and the removed ones dropped. */
function merged<Item extends { id: string }>(
  items: readonly Item[],
  changed: readonly Item[],
  removed: ReadonlySet<string>,
): Item[] {
  const byId = new Map(changed.map((item) => [item.id, structuredClone(item)]));
  const kept = items
    .filter((item) => !removed.has(item.id))
    .map((item) => byId.get(item.id) ?? item);
  const added = [...byId.values()].filter((item) => !items.some((old) => old.id === item.id));
  return [...kept, ...added];
}

/** Applies a save's writes to the store, all or none. */
function apply(writes: CourseWrites): void {
  const store = getSampleStore();
  const { courses, courseModules, lessons, stamps, staffActivity } = store;
  try {
    const removedCourses = new Set(writes.removedCourse ? [writes.removedCourse] : []);
    store.courses = merged(courses, writes.course ? [writes.course] : [], removedCourses);
    // A deleted Course's Modules and Lessons go with it.
    const removedModules = new Set([
      ...writes.removedModules,
      ...courseModules
        .filter((module: CourseModule) => removedCourses.has(module.courseId))
        .map((module) => module.id),
    ]);
    store.courseModules = merged(courseModules, writes.modules, removedModules);
    const removedLessons = new Set([
      ...writes.removedLessons,
      ...lessons.filter((lesson) => removedModules.has(lesson.moduleId)).map((lesson) => lesson.id),
    ]);
    store.lessons = merged(lessons, writes.lessons, removedLessons);
    const next = { ...stamps };
    for (const record of writes.removedStamps) delete next[record];
    Object.assign(next, writes.stamps);
    store.stamps = next;
    store.staffActivity = [...staffActivity, ...structuredClone(writes.activity)];
  } catch (error) {
    store.courses = courses;
    store.courseModules = courseModules;
    store.lessons = lessons;
    store.stamps = stamps;
    throw error;
  }
}

const sampleCourseStore: CourseEditorStore = {
  list: async () => {
    const { courses, courseModules, lessons } = getSampleStore();
    const courseOf = new Map(courseModules.map((module) => [module.id, module.courseId]));
    const counts: Record<string, number> = {};
    for (const lesson of lessons) {
      const course = courseOf.get(lesson.moduleId);
      if (course) counts[course] = (counts[course] ?? 0) + 1;
    }
    return { courses: structuredClone(courses), lessons: counts };
  },
  exams: async () => readExams(),
  read: async (key) => readCourse(key),
  // Ticket 04 stores the Members' saved positions; until then there are none.
  savedPositions: async () => ({}),
  save: async (key, plan) => {
    const planned = plan(key ? readCourse(key) : null, readExams());
    if (planned.ok && planned.writes) apply(planned.writes);
    return planned;
  },
  coverAt: async (path) => sampleUploadAt(path, "course-cover"),
  removeCovers: async () => {},
};

export const {
  listCoursesForAdmin,
  getCourseForAdmin,
  createCourse,
  updateCourse,
  setCourseVisibility,
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
} = courseEditorCalls(sampleCourseStore);
