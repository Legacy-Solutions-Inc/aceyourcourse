"use server";

import { redirect } from "next/navigation";

import { askedExam, courseOfItem } from "@/components/member-app/plans-view";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { payForCourse, payForPlan } from "@/services/member";
import { COURSE_PAY_REFUSALS, PAY_REFUSALS, payFormSchema } from "@/services/member.schema";
import { paymentsClient } from "@/services/payments";

// Pay, on the Plans page (Phase 4, ticket 03; spec, Phase 4 planning
// decisions → Paying; stories 135 and 151n). The Member App's server checks
// run first (the gate, consent, the Active Device, onboarding), and the
// Order is made only for the signed-in Member: who they are comes from the
// session alone. The form names the Exam, the Plan and the method; the price,
// the Plan's name and days are read on the server. Staff buy like any Member.
// A One-time purchase (Phase 5, ticket 06) sends "course:" and the Course's
// id as the item, and buys that Course: its name and price read on the server.

/** What the Plans page shows after a refused Pay. */
export interface PayFormState {
  error: string | null;
}

/**
 * Pay: a new Pending Order for the Plan picked, then off to the checkout
 * (with the payments fake, straight to Confirming payment). Refused, making
 * nothing, where buying isn't set up, for a method that isn't one of the four,
 * a Plan that isn't on sale, or a Plan of another Exam than the one posted;
 * for a Course, also one that isn't on sale, a Hidden or an included one, or
 * one the Member owns already.
 */
export async function pay(_previous: PayFormState, formData: FormData): Promise<PayFormState> {
  const sent = payFormSchema.parse({
    examCode: formData.get("examCode"),
    plan: formData.get("plan"),
    method: formData.get("method"),
  });
  const asked = askedExam(sent.examCode);
  const { member } = await requireMemberWithExam(
    asked ? paths.memberApp.plansFor(asked) : paths.memberApp.plans,
  );

  const courseId = courseOfItem(sent.plan);
  const result = courseId
    ? await payForCourse(
        member.userId,
        { examCode: sent.examCode, courseId, method: sent.method },
        paymentsClient(),
      )
    : await payForPlan(
        member.userId,
        { examCode: sent.examCode, planId: sent.plan, method: sent.method },
        paymentsClient(),
      );
  if (!result.ok) {
    return {
      error: (courseId && COURSE_PAY_REFUSALS[result.reason]) || PAY_REFUSALS[result.reason],
    };
  }
  redirect(result.redirectTo);
}
