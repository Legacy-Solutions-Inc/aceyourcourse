import type * as schema from "@/lib/db/schema";
import type { Course } from "@/services/courses.types";

// The video Courses' rows (Phase 5, ticket 01): a Course's row keeps its
// creation time as a timestamp, which the seams carry as an ISO time. Modules
// and Lessons need no mapping: their rows are their values.

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
