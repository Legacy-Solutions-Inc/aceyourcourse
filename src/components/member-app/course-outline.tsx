import Link from "next/link";

import { videoLength } from "@/lib/courses/course-rules";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { MemberLesson, MemberModule } from "@/services/member.types";

/** Pure: a playable Lesson's mark: ▶ the one open now, ✓ done, ○ to do; none for a locked one. */
export function lessonMark(
  lesson: Pick<MemberLesson, "playable" | "done">,
  current: boolean,
): { symbol: string; said: string } | null {
  if (!lesson.playable) return null;
  if (current) return { symbol: "▶", said: "Now" };
  return lesson.done ? { symbol: "✓", said: "Done" } : { symbol: "○", said: "To do" };
}

interface CourseOutlineProps {
  courseId: string;
  outline: readonly MemberModule[];
  /** The Lesson open now, on the Lesson screen. */
  currentLessonId?: string;
}

/**
 * A Course's Modules and Lessons with their lengths (spec, Phase 5 planning
 * decisions → The Courses screen, Watching a Lesson): each Lesson the
 * Member can play is a link, in any order; one they can't (a locked
 * Course's, but for its Free Preview Lessons) shows locked. The Course's
 * page and the Lesson screen's side panel both list it, each Lesson the
 * Member can play marked ▶ now, ✓ done or ○ to do (ticket 04).
 */
export function CourseOutline({ courseId, outline, currentLessonId }: CourseOutlineProps) {
  return (
    <ol aria-label="Modules and lessons" className="flex flex-col gap-4">
      {outline.map((module) => (
        <li key={module.id} className="flex flex-col gap-1.5">
          <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
            MODULE {module.number} · {module.title}
          </p>
          <ol className="flex flex-col border-[1.5px] bg-ayc-paper">
            {module.lessons.map((lesson) => {
              const current = lesson.id === currentLessonId;
              const mark = lessonMark(lesson, current);
              const label = (
                <>
                  {mark ? (
                    <span aria-hidden="true" className="w-4 flex-none text-center font-mono">
                      {mark.symbol}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    {lesson.playable ? null : <span aria-hidden="true">🔒 </span>}
                    {mark ? <span className="sr-only">{mark.said}: </span> : null}
                    {lesson.title}
                    {lesson.freePreview ? (
                      <span
                        className={cn(
                          "font-mono text-[10px] font-bold tracking-[0.06em] whitespace-pre",
                          !current && "text-ayc-blue",
                        )}
                      >
                        {" · FREE PREVIEW"}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-xs tabular-nums",
                      !current && "text-muted-foreground",
                    )}
                  >
                    {videoLength(lesson.seconds)}
                  </span>
                </>
              );
              const row =
                "flex min-h-11 items-center gap-3 border-b border-ayc-ruled px-3 py-2 text-sm last:border-b-0";
              return (
                <li key={lesson.id}>
                  {lesson.playable ? (
                    <Link
                      href={paths.memberApp.lesson(courseId, lesson.id)}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        row,
                        "font-semibold",
                        current && "bg-primary text-primary-foreground",
                      )}
                    >
                      {label}
                    </Link>
                  ) : (
                    <p className={cn(row, "text-ayc-slate")}>
                      <span className="sr-only">Locked: </span>
                      {label}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
