import type * as schema from "@/lib/db/schema";
import type { Course, CourseOwnership, LessonProgress } from "@/services/courses.types";

// The video Courses' rows (Phase 5, ticket 01): a Course's row keeps its
// creation time as a timestamp, which the seams carry as an ISO time, as a
// Course Ownership's row keeps when it began, and Lesson progress when it was
// done and last watched (ticket 07). Modules and Lessons need no mapping:
// their rows are their values.

export type CourseRow = typeof schema.courses.$inferSelect;

/** Pure: a Course from its row. */
export const courseFromRow = ({ createdAt, ...row }: CourseRow): Course => ({
  ...row,
  createdAt: createdAt.toISOString(),
});

/** Pure: a Course's row. */
export const courseToRow = ({ createdAt, ...course }: Course): CourseRow => ({
  ...course,
  createdAt: new Date(createdAt),
});

export type CourseOwnershipRow = typeof schema.courseOwnerships.$inferSelect;

/** Pure: a Course Ownership from its row (ticket 07). */
export const courseOwnershipFromRow = ({ since, ...row }: CourseOwnershipRow): CourseOwnership => ({
  ...row,
  since: since.toISOString(),
});

export type LessonProgressRow = typeof schema.lessonProgress.$inferSelect;

/** Pure: a Member's progress in a Lesson from its row (ticket 07: the data copy reads it). */
export const lessonProgressFromRow = ({
  doneAt,
  watchedAt,
  ...row
}: LessonProgressRow): LessonProgress => ({
  ...row,
  doneAt: doneAt?.toISOString() ?? null,
  watchedAt: watchedAt.toISOString(),
});
