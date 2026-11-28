import type { Metadata } from "next";

import { CoursesShelf } from "@/components/member-app/courses-shelf";
import { MemberScreen } from "@/components/member-app/member-screen";
import { readMemberAccess, shownRefusal } from "@/lib/member-app/access-check";
import { courseGroups } from "@/lib/member-app/courses-view";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { readUnlockRoutes } from "@/lib/member-app/unlock-read";
import { paths } from "@/paths";
import { listCourses } from "@/services/member";

export const metadata: Metadata = { title: "Courses" };

/**
 * The Courses screen (03; mockup `courses`; spec, Phase 5 planning decisions
 * → The Courses screen; stories 157 and 163): the selected Target Exam's
 * Visible Courses, plus any Hidden ones the Member owns, grouped by Subject.
 * Each card's state comes from the access decision, asked on the server for
 * every Course with the Member's own Course Ownership: owned, in their plan,
 * or locked with its way in (the Exam's Plans, or "Not on sale right now").
 * The gate, consent, the Active Device and onboarding come first.
 */
export default async function CoursesPage() {
  const { member, selected } = await requireMemberWithExam(paths.memberApp.courses);
  const [access, unlockOf] = await Promise.all([readMemberAccess(), readUnlockRoutes()]);
  // requireMemberWithExam just let a signed-in Member in.
  if (!access) throw new Error("The Courses screen lost its signed-in Member.");
  const shelf = await listCourses(member.userId, selected.examCode, access);
  // Should the gate or the Active Device stop them meanwhile, their screens take over.
  for (const { decision } of shelf.courses) {
    if (decision.outcome !== "allowed") shownRefusal(decision, paths.memberApp.courses);
  }
  const unlock = unlockOf(selected.examCode);

  return (
    <MemberScreen
      eyebrow={`03 · COURSES · ${selected.examCode} · ${selected.board}`}
      title={`Your ${selected.examCode} courses`}
    >
      <CoursesShelf
        examCode={selected.examCode}
        groups={courseGroups(shelf, unlock)}
        unlock={unlock}
      />
    </MemberScreen>
  );
}
