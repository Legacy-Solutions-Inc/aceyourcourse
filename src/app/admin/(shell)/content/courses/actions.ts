"use server";

import { adminAction } from "@/lib/admin/action";
import {
  checkLessonVideo,
  createCourse,
  createCourseModule,
  createLesson,
  deleteCourse,
  deleteCourseModule,
  deleteLesson,
  finishLessonUpload,
  moveCourseModule,
  moveLesson,
  moveLessonToModule,
  previewLessonVideo,
  renameCourseModule,
  setCourseVisibility,
  setLessonPublished,
  startLessonUpload,
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
  lessonIdInputSchema,
  lessonToModuleInputSchema,
  lessonUploadInputSchema,
  lessonUploadOutcomeInputSchema,
  newCourseFormSchema,
  newCourseModuleFormSchema,
  newLessonFormSchema,
} from "@/services/admin.schema";
import { createUpload } from "@/services/uploads";
import { uploadFileSchema, uploadOwnerSchema } from "@/services/uploads.types";
import { videoService } from "@/services/video";

// The Course builder's Server Actions (Phase 5, tickets 01 and 02): any Staff User,
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
  async (actor, { id }) => deleteCourse(actor, id, videoService()),
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
  async (actor, { id }) => deleteLesson(actor, id, videoService()),
);

// Lesson videos (Phase 5, ticket 02): only Staff get upload permission and a
// preview's playback pass; the file goes from the browser straight to the
// video service, never through here.

/**
 * "Upload video" or "Replace video": the file checked (MP4 or MOV, up to 4
 * GB), then one-time upload permission for this Lesson, recorded on it.
 */
export const createLessonUpload = adminAction(
  { role: "staff", schema: lessonUploadInputSchema },
  async (actor, file) => startLessonUpload(actor, file, videoService()),
);

/** The browser's word that the file was sent, or that sending it failed. */
export const saveLessonUploadOutcome = adminAction(
  { role: "staff", schema: lessonUploadOutcomeInputSchema },
  finishLessonUpload,
);

/** The editor's status poll while a video uploads or processes. */
export const checkLessonVideoStatus = adminAction(
  { role: "staff", schema: lessonIdInputSchema },
  async (actor, { id }) => checkLessonVideo(actor, id, videoService()),
);

/** The preview: a playback pass watermarked with the Staff member's email. */
export const previewLesson = adminAction(
  { role: "staff", schema: lessonIdInputSchema },
  async (actor, { id }) => previewLessonVideo(actor, id, videoService()),
);
