import Link from "next/link";

import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { AdminCourseSummary } from "@/services/admin.types";

interface CoursesListProps {
  courses: AdminCourseSummary[];
  /** The Course open in the builder, "new" for "+ New course", or null. */
  selected: string | null;
}

/**
 * The Course builder's list (Phase 5, ticket 01; BUILD-MAP §3.7): "COURSES ·
 * N", each with its Exam, Lesson count and HIDDEN or VISIBLE, then "+ New
 * course".
 */
export function CoursesList({ courses, selected }: CoursesListProps) {
  return (
    <nav
      aria-labelledby="courses-list"
      className="flex min-w-0 flex-col gap-2.5 border-[1.5px] bg-ayc-paper p-3.5"
    >
      <h2
        id="courses-list"
        className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
      >
        COURSES · {courses.length}
      </h2>
      {courses.length > 0 ? (
        <ul className="flex flex-col">
          {courses.map((course) => (
            <li key={course.id} className="border-b border-ayc-ruled last:border-b-0">
              <Link
                href={paths.admin.course(course.id)}
                aria-current={selected === course.id ? "page" : undefined}
                className={cn(
                  "flex flex-col gap-0.5 px-2 py-2.5 hover:bg-ayc-cream",
                  selected === course.id && "bg-ayc-cream",
                )}
              >
                <span className="text-sm font-bold wrap-anywhere">{course.title}</span>
                <span className="font-mono text-[10px] font-bold tracking-[0.04em] text-muted-foreground">
                  {course.examCode} · {course.lessons} {course.lessons === 1 ? "LESSON" : "LESSONS"}{" "}
                  · {course.visibility === "visible" ? "VISIBLE" : "HIDDEN"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">No Courses yet.</p>
      )}
      <Link
        href={paths.admin.newCourse}
        aria-current={selected === "new" ? "page" : undefined}
        className="flex min-h-9 w-fit items-center border-[1.5px] bg-primary px-3 text-[13px] font-bold text-primary-foreground"
      >
        + New course
      </Link>
    </nav>
  );
}
