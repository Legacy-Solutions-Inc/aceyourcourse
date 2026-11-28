import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CourseOutline } from "@/components/member-app/course-outline";
import { LessonRefusal, LessonVideo } from "@/components/member-app/lesson-states";
import { markLessonComplete, saveLessonPlace } from "@/app/app/(shell)/courses/actions";
import { LessonWatch } from "@/components/member-app/lesson-watch";
import { MemberScreen } from "@/components/member-app/member-screen";
import { readMemberAccess, shownRefusal } from "@/lib/member-app/access-check";
import {
  completeLabel,
  lessonCrumb,
  lessonNeighbours,
  resumeNote,
} from "@/lib/member-app/courses-view";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { readUnlockRoutes } from "@/lib/member-app/unlock-read";
import { paths } from "@/paths";
import { openLesson } from "@/services/member";
import { videoService } from "@/services/video";

export const metadata: Metadata = { title: "Courses" };

interface LessonPageProps {
  params: Promise<{ course: string; lesson: string }>;
}

/**
 * The Lesson screen (mockup `player`; spec, Phase 5 planning decisions →
 * Access and playback, Watching a Lesson, The VdoCipher key decides; stories
 * 164, 165 and 167): the player, the crumb "PSAD MASTERCLASS · MODULE 2 ·
 * LESSON 3", the title and the notes, the Lessons before and after, and a
 * side panel with the Course's Modules and Lessons, any of which can be
 * opened in any order.
 *
 * The Member seam runs the access decision before it asks the video service
 * for a playback pass, which then carries the Member's own email and short
 * Member ID drifting across the video: a refused Lesson, even opened by its
 * address, shows the unlock prompt, renew or "no longer available" and gets
 * no pass. With no video service (no key), "This video isn't available yet"
 * stands in for the player. The gate, consent, the Active Device and
 * onboarding come first; an address whose Lesson isn't in its Course is a
 * 404.
 *
 * Ticket 04: the video picks up where the Member left off ("You stopped
 * here 2 days ago…"; a done Lesson from the beginning) and saves where they
 * are as they watch; "Mark complete · next lesson →" (or "· finish course"
 * on the last, back to Courses) replaces "Next lesson →"; the side panel
 * marks each Lesson ▶ now, ✓ done or ○ to do.
 */
export default async function LessonPage({ params }: LessonPageProps) {
  const { course: courseId, lesson: lessonId } = await params;
  const from = paths.memberApp.lesson(courseId, lessonId);
  const { member } = await requireMemberWithExam(from);
  const [access, unlockOf] = await Promise.all([readMemberAccess(), readUnlockRoutes()]);
  // requireMemberWithExam just let a signed-in Member in.
  if (!access) throw new Error("The Lesson screen lost its signed-in Member.");

  const opening = await openLesson(member.userId, { courseId, lessonId }, access, videoService());
  if (opening.status === "not-found") notFound();
  const { course } = opening;
  const back = { href: paths.memberApp.course(course.id), label: `Back to ${course.title}` };

  if (opening.status === "refused") {
    return (
      <MemberScreen
        eyebrow={`03 · COURSES · ${course.title.toUpperCase()}`}
        title={opening.lesson.title}
      >
        <LessonRefusal
          decision={shownRefusal(opening.decision, from)}
          course={course}
          unlock={unlockOf(course.examCode)}
          back={back}
        />
      </MemberScreen>
    );
  }

  const { lesson, outline, player } = opening;
  const { previous, next } = lessonNeighbours(outline, lesson.id);
  return (
    <MemberScreen
      eyebrow={lessonCrumb(course.title, lesson.moduleNumber, lesson.number)}
      title={lesson.title}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* A fresh player and save schedule for each Lesson, even between two of the same Course. */}
          <LessonWatch
            key={lesson.id}
            courseId={course.id}
            lessonId={lesson.id}
            title={lesson.title}
            pass={player.kind === "pass" ? player.pass : null}
            fallback={<LessonVideo player={player} title={lesson.title} />}
            seconds={lesson.seconds}
            watermark={player.kind === "pass" ? player.watermark : ""}
            startAt={lesson.resume.from}
            note={resumeNote(lesson.resume, new Date())}
            complete={{
              label: completeLabel(next !== null),
              href: next ? paths.memberApp.lesson(course.id, next.id) : paths.memberApp.courses,
            }}
            done={lesson.done}
            actions={{ save: saveLessonPlace, complete: markLessonComplete }}
          />
          {lesson.notes ? (
            <p className="max-w-prose text-[15px] leading-normal whitespace-pre-line">
              {lesson.notes}
            </p>
          ) : null}
          {previous ? (
            <div className="flex flex-wrap gap-2.5">
              <Link
                href={paths.memberApp.lesson(course.id, previous.id)}
                className="flex min-h-11 items-center border-[1.5px] px-4 text-sm font-bold"
              >
                ← {previous.title}
              </Link>
            </div>
          ) : null}
        </div>
        <nav aria-labelledby="lesson-course" className="flex min-w-0 flex-col gap-3">
          <h2 id="lesson-course" className="text-[17px] font-extrabold">
            <Link href={back.href} className="underline-offset-2 hover:underline">
              {course.title}
            </Link>
          </h2>
          <p className="font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground">
            {course.lessonsDone} / {course.lessons} DONE
          </p>
          <CourseOutline courseId={course.id} outline={outline} currentLessonId={lesson.id} />
        </nav>
      </div>
    </MemberScreen>
  );
}
