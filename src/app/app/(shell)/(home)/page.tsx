import type { Metadata } from "next";

import { Dashboard } from "@/components/member-app/dashboard";
import { firstName } from "@/components/member-app/member-menu";
import { MemberScreen } from "@/components/member-app/member-screen";
import { Onboarding } from "@/components/member-app/onboarding";
import { RenewalBanners } from "@/components/member-app/renewal-banners";
import { readTargetExams, requireMember } from "@/lib/member-app/guard";
import { manilaDate } from "@/lib/manila-time";
import { readRenewalBanners } from "@/lib/member-app/renewal-read";
import { paths } from "@/paths";
import { getProgress, listPickableExams } from "@/services/member";

import { addExam, dismissRenewalBanner } from "../actions";

export const metadata: Metadata = { title: "Home" };

interface MemberHomePageProps {
  searchParams: Promise<{ restored?: string | string[] }>;
}

/**
 * Home. A Member with no Target Exam yet sees onboarding here (story 84).
 * Everyone else sees the dashboard for their selected Target Exam (stories
 * 88–92): the countdown, the streak, where they left off, progress by
 * Subject and weak Topics, from their own progress, read after the gate,
 * consent and the Active Device let them in, on every load. Home has its own
 * route group so its loading skeleton (loading.tsx) shows on Home alone.
 * `restored` comes back from the add form when the Exam was one the Member
 * had removed.
 *
 * Above the dashboard, a banner for each Exam whose Access Pass ends within 7
 * days (Phase 4, ticket 12), never for Staff.
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

  const [{ restored }, progress, renewals] = await Promise.all([
    searchParams,
    getProgress(member.userId, selected.examCode),
    readRenewalBanners(member.userId),
  ]);
  const wasRestored = selected.examCode === restored;
  return (
    <MemberScreen
      eyebrow={`01 · HOME · ${selected.examCode} · ${selected.board}`}
      title={`Welcome, ${firstName(member)}`}
    >
      <RenewalBanners banners={renewals} dismiss={dismissRenewalBanner} />
      {wasRestored ? (
        <p
          role="status"
          className="max-w-xl border-[1.5px] border-ayc-blue bg-background p-3 text-sm"
        >
          {selected.examCode} is back in your exams, with the exam date it had. Change it in Account
          if you need to.
        </p>
      ) : null}
      <Dashboard exam={selected} now={now} progress={progress} />
    </MemberScreen>
  );
}
