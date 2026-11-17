import type { ExamFormState } from "@/app/app/(shell)/actions";
import type { PickableExam } from "@/services/member.types";

import { ExamForm } from "./exam-form";
import { MemberScreen } from "./member-screen";

interface OnboardingProps {
  /** What to call the Member: their first name. */
  firstName: string;
  /** The Exams on the Website, which are the ones a Member can pick. */
  exams: readonly PickableExam[];
  /** Today in Asia/Manila (YYYY-MM-DD). */
  today: string;
  /** The add Server Action. */
  action: (previous: ExamFormState, formData: FormData) => Promise<ExamFormState>;
}

/**
 * Onboarding (mockup `newUser`, L503–511; story 84): what Home shows a Member
 * with no Target Exam yet. They pick their Exam, keep its Official Exam Date
 * or enter their own, and "Start my countdown" makes it their first Target
 * Exam. The mockup's "Step 2 · Access" comes with Plans, in Phase 4.
 */
export function Onboarding({ firstName, exams, today, action }: OnboardingProps) {
  return (
    <MemberScreen eyebrow="WELCOME" title={`Hi, ${firstName}. Let’s set you up.`}>
      <section
        aria-labelledby="onboarding-step-1"
        className="flex max-w-xl flex-col gap-3.5 border-[1.5px] bg-ayc-paper p-5.5 shadow-hard-md shadow-ayc-orange"
      >
        <p className="font-mono text-xs font-bold tracking-[0.06em] text-ayc-blue">
          STEP 1 · YOUR EXAM
        </p>
        <h2 id="onboarding-step-1" className="text-[22px] leading-[1.2] font-extrabold">
          When is your board exam?
        </h2>
        {exams.length > 0 ? (
          <ExamForm exams={exams} today={today} submitLabel="Start my countdown" action={action} />
        ) : (
          <p className="text-[15px] leading-normal">No exams are open yet. Check back soon.</p>
        )}
      </section>
    </MemberScreen>
  );
}
