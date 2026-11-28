import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContactNote } from "@/components/member-app/content-state";
import { CourseOutline } from "@/components/member-app/course-outline";
import { CourseAction, CourseCover } from "@/components/member-app/courses-shelf";
import { LessonRefusal } from "@/components/member-app/lesson-states";
import { MemberScreen } from "@/components/member-app/member-screen";
import { readMemberAccess, shownRefusal } from "@/lib/member-app/access-check";
import { courseCard, leadsToPlans } from "@/lib/member-app/courses-view";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { readUnlockRoutes } from "@/lib/member-app/unlock-read";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import { openCourse } from "@/services/member";

export const metadata: Metadata = { title: "Courses" };

interface CoursePageProps {
  params: Promise<{ course: string }>;
}

const BACK = { href: paths.memberApp.courses, label: "Back to Courses" };

/**
 * A Course's page (spec, Phase 5 planning decisions → The Courses screen;
 * story 159): its Modules and Lessons with their lengths, and its state and
 * way in, as on its card. A locked Course's list opens too, and only its
 * Free Preview Lessons play; every Lesson is decided by the access decision
 * on the server. A Hidden Course is no longer available to anyone but its
 * owners. The gate, consent, the Active Device and onboarding come first; an
 * address that names no Course is a 404.
 */
export default async function CoursePage({ params }: CoursePageProps) {
  const { course: courseId } = await params;
  const from = paths.memberApp.course(courseId);
  const { member } = await requireMemberWithExam(from);
  const [access, unlockOf] = await Promise.all([readMemberAccess(), readUnlockRoutes()]);
  // requireMemberWithExam just let a signed-in Member in.
  if (!access) throw new Error("The Course page lost its signed-in Member.");

  const opening = await openCourse(member.userId, courseId, access);
  if (opening.status === "not-found") notFound();
  const { course } = opening;
  const unlock = unlockOf(course.examCode);
  if (opening.status === "refused") {
    return (
      <MemberScreen eyebrow="03 · COURSES" title={course.title}>
        <LessonRefusal
          decision={shownRefusal(opening.decision, from)}
          course={course}
          unlock={unlock}
          back={BACK}
        />
      </MemberScreen>
    );
  }

  const card = courseCard(course, unlock);
  return (
    <MemberScreen
      eyebrow={`03 · COURSES · ${course.examCode} · ${course.subjectCode}`}
      title={course.title}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex min-w-0 flex-col gap-3">
          <p
            className={cn(
              "font-mono text-[11px] font-bold tracking-[0.06em]",
              card.locked ? "text-destructive" : "text-ayc-blue",
            )}
          >
            {card.locked ? `🔒 ${card.tag}` : card.tag} · {card.meta}
          </p>
          {course.description ? (
            <p className="max-w-prose text-[15px] leading-normal whitespace-pre-line">
              {course.description}
            </p>
          ) : null}
          <CourseAction card={card} />
          {card.locked ? (
            <p className="max-w-prose text-sm leading-normal text-muted-foreground">
              {card.free
                ? "Its Free Preview lessons play now. The rest open once you unlock it."
                : "Its lessons open once you unlock it."}
              {leadsToPlans(card.state) ? <ContactNote unlock={unlock} /> : null}
            </p>
          ) : null}
          <CourseOutline courseId={course.id} outline={opening.outline} />
        </div>
        <div className="order-first lg:order-last">
          <CourseCover coverSrc={course.coverSrc} subjectCode={course.subjectCode} />
        </div>
      </div>
      <Link href={BACK.href} className="self-start text-sm font-bold underline underline-offset-2">
        ← {BACK.label}
      </Link>
    </MemberScreen>
  );
}
