import type { Metadata } from "next";
import Link from "next/link";

import { ExamForm } from "@/components/member-app/exam-form";
import { MemberScreen } from "@/components/member-app/member-screen";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { manilaDate } from "@/lib/manila-time";
import { paths } from "@/paths";
import { listPickableExams } from "@/services/member";

import { addExam } from "../actions";

export const metadata: Metadata = { title: "Add an exam" };

/**
 * The add form (story 85), opened from "+ Add an exam" in the exam switcher
 * and in Account: the Exams on the Website that aren't the Member's Target
 * Exams already. One they removed earlier is offered again, and comes back
 * with the date it had.
 */
export default async function AddExamPage() {
  const { targetExams } = await requireMemberWithExam(paths.memberApp.addExam);
  const mine = new Set(targetExams.map((exam) => exam.examCode));
  const exams = (await listPickableExams()).filter((exam) => !mine.has(exam.code));

  return (
    <MemberScreen eyebrow="ADD AN EXAM" title="Add an exam">
      <section
        aria-label="Add an exam"
        className="flex max-w-xl flex-col gap-3.5 border-[1.5px] bg-ayc-paper p-5.5 shadow-hard-md shadow-ayc-orange"
      >
        {exams.length > 0 ? (
          <>
            <p className="text-[15px] leading-normal">
              Pick another board exam you’re preparing for. It gets its own countdown, and you can
              switch between your exams any time.
            </p>
            <ExamForm
              exams={exams}
              today={manilaDate(new Date())}
              submitLabel="Add exam"
              action={addExam}
            />
          </>
        ) : (
          <p className="text-[15px] leading-normal">
            You’ve added every exam we have. New ones show here as soon as they open.
          </p>
        )}
      </section>
      <Link
        href={paths.memberApp.account}
        className="flex min-h-11 items-center self-start font-bold text-ayc-blue underline underline-offset-2"
      >
        Back to Account
      </Link>
    </MemberScreen>
  );
}
