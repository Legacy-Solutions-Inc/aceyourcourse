import type { Metadata } from "next";

import { MemberScreen } from "@/components/member-app/member-screen";
import { yourExams } from "@/components/member-app/target-exam-view";
import { YourExams } from "@/components/member-app/your-exams";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { manilaDate } from "@/lib/manila-time";
import { paths } from "@/paths";

import { changeExamDate, removeExam } from "../actions";

export const metadata: Metadata = { title: "Account" };

/**
 * Account, with its first section: "Your exams" (stories 85, 86, 133g), where
 * a Member edits each Target Exam's Exam Date, removes one they no longer
 * need, and adds another. The rest of Account (profile, what they agreed to,
 * privacy) comes with its own ticket, each as a section like this one.
 */
export default async function AccountPage() {
  const { targetExams } = await requireMemberWithExam(paths.memberApp.account);
  const now = new Date();
  const exams = yourExams(targetExams, now);

  return (
    <MemberScreen eyebrow="06 · ACCOUNT" title="Account">
      <section aria-labelledby="your-exams" className="flex max-w-2xl flex-col gap-3.5">
        <h2 id="your-exams" className="text-[22px] leading-[1.2] font-extrabold">
          Your exams
        </h2>
        <p className="max-w-prose text-[15px] leading-normal">
          Each exam has its own countdown. It follows the official exam date until you set your own.
        </p>
        <YourExams
          exams={exams}
          today={manilaDate(now)}
          changeDateAction={changeExamDate}
          removeAction={removeExam}
        />
      </section>
    </MemberScreen>
  );
}
