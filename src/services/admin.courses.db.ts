import "server-only";

import { asc, count, eq, inArray } from "drizzle-orm";

import { adminWriteLock } from "@/lib/db/admin-locks";
import { getDb } from "@/lib/db/client";
import type { Database } from "@/lib/db/connect";
import { asDatabaseError } from "@/lib/db/errors";
import { setStamp } from "@/lib/db/record-stamps";
import * as schema from "@/lib/db/schema";
import { fromExcluded } from "@/lib/db/upsert";
import { isStorageConfigured } from "@/lib/supabase/admin";
import { SEEDED_RECORD, staffActivityToRow, stampsFromRows } from "@/services/admin.rows";
import type { CourseExamChoice } from "@/services/admin.types";
import {
  type CourseEditorStore,
  courseEditorCalls,
  type CourseKey,
  type CourseState,
  courseRecordOf,
  lessonRecordOf,
  moduleRecordOf,
} from "@/services/course-editor.core";
import { courseFromRow, courseToRow } from "@/services/courses.rows";
import { sampleUploadAt } from "@/services/uploads.mock";
import { storageArm } from "@/services/uploads.storage";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Course builder on Postgres (Phase 5, ticket 01): the shared
// builder (src/services/course-editor.core.ts), reading one Course with its
// Modules and Lessons with Drizzle. A save runs in one transaction, which
// takes the content write lock (the one Exam and Subject deletes take after
// the catalogue's, so a Course can't be added to a Subject being deleted),
// reads the Exams and the Course again, and writes the Course, its Modules,
// its Lessons, their stamps and Staff Activity. A failure at any step rolls
// back every row. Deleting a Course deletes its Modules and their Lessons
// (the tables cascade). Covers are Storage's public catalogue uploads, or,
// without Storage (database tests with no secret key), the sample data's, as
// the rest of the database arm does; a replaced cover's file is deleted once
// the save commits. Drizzle bypasses RLS, so authorisation is the seam's
// role check and the Staff Guard (coding standards §3).
// ─────────────────────────────────────────────────────────────────────────────

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Database | Transaction;

/** The Course a key names: its own id, its Module's Course, or its Lesson's Module's Course. */
async function courseIdOf(db: Reader, key: CourseKey): Promise<string | null> {
  const { courseModules, lessons } = schema;
  if ("course" in key) return key.course;
  const [found] =
    "module" in key
      ? await db
          .select({ courseId: courseModules.courseId })
          .from(courseModules)
          .where(eq(courseModules.id, key.module))
      : await db
          .select({ courseId: courseModules.courseId })
          .from(lessons)
          .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
          .where(eq(lessons.id, key.lesson));
  return found?.courseId ?? null;
}

async function readExams(db: Reader): Promise<CourseExamChoice[]> {
  const { exams, subjects } = schema;
  const examRows = await db
    .select({ code: exams.code, name: exams.name })
    .from(exams)
    .orderBy(asc(exams.position));
  const subjectRows = await db
    .select()
    .from(subjects)
    .orderBy(asc(subjects.examCode), asc(subjects.position));
  return examRows.map((exam) => ({
    ...exam,
    subjects: subjectRows
      .filter((subject) => subject.examCode === exam.code)
      .map(({ code, name }) => ({ code, name })),
  }));
}

/** A Course with its Modules and Lessons, read on `db`, or null when the key names nothing. */
async function readCourse(db: Reader, key: CourseKey): Promise<CourseState | null> {
  const { courses, courseModules, lessons, recordStamps } = schema;
  const id = await courseIdOf(db, key);
  if (!id) return null;
  const [row] = await db.select().from(courses).where(eq(courses.id, id));
  if (!row) return null;
  const modules = await db
    .select()
    .from(courseModules)
    .where(eq(courseModules.courseId, id))
    .orderBy(asc(courseModules.position), asc(courseModules.id));
  const lessonRows = await db
    .select({ lesson: lessons })
    .from(lessons)
    .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
    .where(eq(courseModules.courseId, id))
    .orderBy(
      asc(courseModules.position),
      asc(courseModules.id),
      asc(lessons.position),
      asc(lessons.id),
    );
  const records = [
    SEEDED_RECORD,
    courseRecordOf(id),
    ...modules.map((module) => moduleRecordOf(module.id)),
    ...lessonRows.map(({ lesson }) => lessonRecordOf(lesson.id)),
  ];
  const stampRows = await db
    .select()
    .from(recordStamps)
    .where(inArray(recordStamps.record, records));
  const { seededAt, stamps } = stampsFromRows(stampRows);
  return {
    course: courseFromRow(row),
    modules: modules.map((module) => ({ ...module })),
    lessons: lessonRows.map(({ lesson }) => ({ ...lesson })),
    stamps,
    seededAt,
  };
}

/** Runs a read in a read-only snapshot. */
async function reading<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  try {
    return await getDb().transaction(work, {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
  } catch (error) {
    throw asDatabaseError(error);
  }
}

const databaseCourseStore: CourseEditorStore = {
  list: () =>
    reading(async (tx) => {
      const { courses, courseModules, lessons } = schema;
      const rows = await tx.select().from(courses);
      const counts = await tx
        .select({ courseId: courseModules.courseId, lessons: count(lessons.id) })
        .from(lessons)
        .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
        .groupBy(courseModules.courseId);
      return {
        courses: rows.map(courseFromRow),
        lessons: Object.fromEntries(counts.map((row) => [row.courseId, row.lessons])),
      };
    }),
  exams: () => reading((tx) => readExams(tx)),
  read: (key) => reading((tx) => readCourse(tx, key)),
  // Ticket 04 stores the Members' saved positions; until then there are none.
  savedPositions: async () => ({}),
  save: async (key, plan) => {
    try {
      return await getDb().transaction(async (tx) => {
        await tx.execute(adminWriteLock("content"));
        const current = key ? await readCourse(tx, key) : null;
        const planned = plan(current, await readExams(tx));
        if (!planned.ok || !planned.writes) return planned;
        const { course, removedCourse, modules, removedModules, lessons, removedLessons } =
          planned.writes;
        const { courses, courseModules, recordStamps } = schema;

        // Deletes first, children before parents; a Course's delete cascades to the rest.
        if (removedLessons.length > 0) {
          await tx.delete(schema.lessons).where(inArray(schema.lessons.id, removedLessons));
        }
        if (removedModules.length > 0) {
          await tx.delete(courseModules).where(inArray(courseModules.id, removedModules));
        }
        if (removedCourse) await tx.delete(courses).where(eq(courses.id, removedCourse));
        if (planned.writes.removedStamps.length > 0) {
          await tx
            .delete(recordStamps)
            .where(inArray(recordStamps.record, planned.writes.removedStamps));
        }

        if (course) {
          await tx
            .insert(courses)
            .values(courseToRow(course))
            .onConflictDoUpdate({
              target: courses.id,
              // Never how Members get it, its price or On sale: the builder doesn't write them.
              set: {
                examCode: fromExcluded("exam_code"),
                subjectCode: fromExcluded("subject_code"),
                title: fromExcluded("title"),
                description: fromExcluded("description"),
                coverSrc: fromExcluded("cover_src"),
                visibility: fromExcluded("visibility"),
              },
            });
        }
        if (modules.length > 0) {
          await tx
            .insert(courseModules)
            .values(modules)
            .onConflictDoUpdate({
              target: courseModules.id,
              set: { position: fromExcluded("position"), title: fromExcluded("title") },
            });
        }
        if (lessons.length > 0) {
          await tx
            .insert(schema.lessons)
            .values(lessons)
            .onConflictDoUpdate({
              target: schema.lessons.id,
              set: {
                moduleId: fromExcluded("module_id"),
                position: fromExcluded("position"),
                title: fromExcluded("title"),
                notes: fromExcluded("notes"),
                freePreview: fromExcluded("free_preview"),
                state: fromExcluded("state"),
                videoId: fromExcluded("video_id"),
                videoSeconds: fromExcluded("video_seconds"),
                replacementVideoId: fromExcluded("replacement_video_id"),
                replacementState: fromExcluded("replacement_state"),
              },
            });
        }
        for (const [record, stamp] of Object.entries(planned.writes.stamps)) {
          await setStamp(tx, record, stamp);
        }
        if (planned.writes.activity.length > 0) {
          await tx
            .insert(schema.staffActivity)
            .values(planned.writes.activity.map(staffActivityToRow));
        }
        return planned;
      });
    } catch (error) {
      throw asDatabaseError(error);
    }
  },
  coverAt: async (path) =>
    isStorageConfigured
      ? (await storageArm.lookupUploads([path]))(path, "course-cover")
      : sampleUploadAt(path, "course-cover"),
  removeCovers: async (srcs) => {
    if (isStorageConfigured) await storageArm.removeImages(srcs);
  },
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
  startLessonUpload,
  finishLessonUpload,
  checkLessonVideo,
  previewLessonVideo,
} = courseEditorCalls(databaseCourseStore);
