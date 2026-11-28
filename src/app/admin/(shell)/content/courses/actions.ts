"use server";

import { adminAction } from "@/lib/admin/action";
import {
  createCourse,
  createCourseModule,
  createLesson,
  deleteCourse,
  deleteCourseModule,
  deleteLesson,
  moveCourseModule,
  moveLesson,
  moveLessonToModule,
  renameCourseModule,
  setCourseVisibility,
  setLessonPublished,
  updateCourse,
  updateLesson,
} from "@/services/admin";
import {
  courseFormSchema,
  courseIdInputSchema,
  courseModuleFormSchema,
  courseModuleIdInputSchema,
  courseModuleMoveInputSchema,
  courseVisibilityInputSchema,
  lessonDeleteInputSchema,
  lessonFormSchema,
  lessonMoveInputSchema,
  lessonPublishInputSchema,
  lessonToModuleInputSchema,
  newCourseFormSchema,
  newCourseModuleFormSchema,
  newLessonFormSchema,
} from "@/services/admin.schema";
import { createUpload } from "@/services/uploads";
import { uploadFileSchema, uploadOwnerSchema } from "@/services/uploads.types";

// The Course builder's Server Actions (Phase 5, ticket 01): any Staff User,
// Editor or Owner, makes Courses, their Modules and their Lessons. Like every
// Admin action, each runs the Staff Guard first, so a Member or someone signed
// out never reaches the seam, which checks every rule again. None writes how
// Members get a Course, its price or On sale (an Owner's, from ticket 06).

/** A one-time upload URL for a Course's 16:9 cover: a JPEG, PNG or WebP of up to 10 MB. */
export const createCourseCoverUpload = adminAction(
  { role: "staff", schema: uploadFileSchema.extend({ owner: uploadOwnerSchema.optional() }) },
  async (actor, file) => createUpload(actor, { purpose: "course-cover", ...file }),
);

/** "+ New course": Hidden, Included in its Exam's All-Access. */
export const addCourse = adminAction({ role: "staff", schema: newCourseFormSchema }, createCourse);

/** Course settings' "Save": it sends the stamp the settings had when they opened. */
export const saveCourse = adminAction(
  { role: "staff", schema: courseFormSchema, requiresStamp: true },
  updateCourse,
);

/** "Course visible to members": refused without a Published Lesson. */
export const saveCourseVisibility = adminAction(
  { role: "staff", schema: courseVisibilityInputSchema },
  async (actor, { course, visible }) => setCourseVisibility(actor, course, visible),
);

/** Delete course, after the confirmation: its Modules and Lessons go with it. */
export const removeCourse = adminAction(
  { role: "staff", schema: courseIdInputSchema },
  async (actor, { id }) => deleteCourse(actor, id),
);

/** "+ Module": last in its Course. */
export const addCourseModule = adminAction(
  { role: "staff", schema: newCourseModuleFormSchema },
  createCourseModule,
);

/** A Module's title, edited in place: it sends the stamp the title had. */
export const saveCourseModuleTitle = adminAction(
  { role: "staff", schema: courseModuleFormSchema, requiresStamp: true },
  renameCourseModule,
);

/** ▲▼ on a Module. */
export const moveCourseModuleInCourse = adminAction(
  { role: "staff", schema: courseModuleMoveInputSchema },
  async (actor, { id, direction }) => moveCourseModule(actor, id, direction),
);

/** Delete on an empty Module. */
export const removeCourseModule = adminAction(
  { role: "staff", schema: courseModuleIdInputSchema },
  async (actor, { id }) => deleteCourseModule(actor, id),
);

/** "+ Lesson": last in its Module. */
export const addLesson = adminAction({ role: "staff", schema: newLessonFormSchema }, createLesson);

/** The Lesson editor's "Save": it sends the stamp the Lesson had when it opened. */
export const saveLesson = adminAction(
  { role: "staff", schema: lessonFormSchema, requiresStamp: true },
  updateLesson,
);

/** ▲▼ on a Lesson, within its Module. */
export const moveLessonInModule = adminAction(
  { role: "staff", schema: lessonMoveInputSchema },
  async (actor, { id, direction }) => moveLesson(actor, id, direction),
);

/** "Move to Module…": last in another Module of its Course. */
export const moveLessonToOtherModule = adminAction(
  { role: "staff", schema: lessonToModuleInputSchema },
  moveLessonToModule,
);

/** Publish or Unpublish: publishing needs a ready video. */
export const saveLessonPublished = adminAction(
  { role: "staff", schema: lessonPublishInputSchema },
  async (actor, { id, published }) => setLessonPublished(actor, id, published),
);

/** Delete lesson, only with DELETE typed to confirm. */
export const removeLesson = adminAction(
  { role: "staff", schema: lessonDeleteInputSchema },
  async (actor, { id }) => deleteLesson(actor, id),
);
