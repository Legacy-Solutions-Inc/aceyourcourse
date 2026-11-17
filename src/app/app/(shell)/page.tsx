import type { Metadata } from "next";

import { ExamCountdown } from "@/components/member-app/exam-countdown";
import { firstName } from "@/components/member-app/member-menu";
import { MemberScreen } from "@/components/member-app/member-screen";
import { Onboarding } from "@/components/member-app/onboarding";
import { readTargetExams, requireMember } from "@/lib/member-app/guard";
import { manilaDate } from "@/lib/manila-time";
import { paths } from "@/paths";
import { listPickableExams } from "@/services/member";

import { addExam } from "./actions";

export const metadata: Metadata = { title: "Home" };

interface MemberHomePageProps {
  searchParams: Promise<{ restored?: string | string[] }>;
}

/**
 * Home. A Member with no Target Exam yet sees onboarding here (story 84).
 * Everyone else sees the countdown for their selected Target Exam (story 88);
 * the rest of the dashboard comes with its own ticket. `restored` comes back
 * from the add form when the Exam was one the Member had removed. The gate
 * and consent run here, on every load.
 */
export default async function MemberHomePage({ searchParams }: MemberHomePageProps) {
  const member = await requireMember(paths.memberApp.home);
  const targetExams = await readTargetExams(member.userId);
  const selected = targetExams.find((exam) => exam.selected);
  const now = new Date();

  if (!selected) {
    return (
      <Onboarding
        firstName={firstName(member)}
        exams={await listPickableExams()}
        today={manilaDate(now)}
        action={addExam}
      />
    );
  }

  const { restored } = await searchParams;
  const wasRestored = selected.examCode === restored;
  return (
    <MemberScreen
      eyebrow={`01 · HOME · ${selected.examCode} · ${selected.board}`}
      title={`Welcome, ${firstName(member)}`}
    >
      {wasRestored ? (
        <p
          role="status"
          className="max-w-xl border-[1.5px] border-ayc-blue bg-background p-3 text-sm"
        >
          {selected.examCode} is back in your exams, with the exam date it had. Change it in Account
          if you need to.
        </p>
      ) : null}
      <ExamCountdown exam={selected} now={now} />
      <p className="max-w-prose border border-dashed border-ayc-rule p-3.5 text-sm leading-[1.45] text-muted-foreground">
        You’re in the Member App beta. Your streak and progress will show here, and each screen in
        the menu opens as soon as it’s ready.
      </p>
    </MemberScreen>
  );
}
