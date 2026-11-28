import type { Metadata } from "next";

import { MemberScreen } from "@/components/member-app/member-screen";
import { Plans } from "@/components/member-app/plans";
import {
  askedExam,
  courseRows,
  openPlansExam,
  orderPlansExams,
  pickedItem,
  planRows,
} from "@/components/member-app/plans-view";
import { readMemberAccess } from "@/lib/member-app/access-check";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { getWebsiteSettings } from "@/services/catalogue";
import { listMemberPlans } from "@/services/member";
import { paymentsClient } from "@/services/payments";

import { pay } from "./actions";

export const metadata: Metadata = { title: "Plans" };

interface PlansPageProps {
  /**
   * `exam`: the Exam whose Plans to open on, by its code. `course`: the
   * One-time purchase to pick (Phase 5, ticket 06). `payment=cancelled`: back
   * from Cancel on PayMongo's page (ticket 04).
   */
  searchParams: Promise<{
    exam?: string | string[];
    course?: string | string[];
    payment?: string | string[];
  }>;
}

/**
 * Plans (04; mockup L412–450; Phase 4, ticket 02; stories 134, 151c, 151e and
 * 151m): a pill per Exam with a Plan on sale, the Member's Target Exams first,
 * open on the Exam `?exam=` asks for, or on their current Exam when it asks
 * for none, one that isn't an Exam, or one with nothing on sale. Each Plan
 * row says when the Member's access would end, counting the days left on
 * their own pass, and whether that covers their Exam Date. The address only
 * picks a pill: what's on sale, the pass and the date are read on the server
 * for the signed-in Member. Pay (ticket 03) makes a Pending Order and goes to
 * the checkout wherever this server has a payments client (the fake in
 * sample mode, PayMongo's with a key); elsewhere the button reads "Buying
 * opens soon", disabled. An Exam's One-time purchases (Phase 5, ticket 06)
 * are listed under its Plans, an Exam with only a Course on sale gets its
 * pill too, and `?course=` picks one. Back from Cancel on PayMongo's page it says nothing
 * was charged (ticket 04). The
 * gate, consent, the Active Device and onboarding come first, coming back
 * here with the Exam asked for.
 */
export default async function PlansPage({ searchParams }: PlansPageProps) {
  const { exam: examParam, course: courseParam, payment } = await searchParams;
  const askedCourse = (Array.isArray(courseParam) ? courseParam[0] : courseParam) ?? null;
  const asked = askedExam(examParam);
  const from = asked ? paths.memberApp.plansFor(asked) : paths.memberApp.plans;
  const { member, targetExams, selected } = await requireMemberWithExam(from);
  const [exams, access, { contactEmail }] = await Promise.all([
    listMemberPlans(member.userId),
    readMemberAccess(),
    getWebsiteSettings(),
  ]);
  // requireMemberWithExam just let a signed-in Member in.
  if (!access) throw new Error("The Plans page lost its signed-in Member.");

  const ordered = orderPlansExams(exams, targetExams);
  const open = openPlansExam(ordered, asked, selected.examCode);
  const rows = open ? planRows(open, access.now) : [];
  const courses = open ? courseRows(open) : [];

  return (
    <MemberScreen eyebrow="04 · PLANS" title="Choose your access">
      <Plans
        pills={ordered.map((exam) => ({
          code: exam.examCode,
          name: exam.name,
          href: paths.memberApp.plansFor(exam.examCode),
          current: exam.examCode === open?.examCode,
        }))}
        exam={
          open
            ? {
                code: open.examCode,
                rows,
                courses,
                initial: pickedItem(rows, courses, askedCourse),
              }
            : null
        }
        staff={access.activeStaff}
        contactEmail={contactEmail}
        pay={paymentsClient() ? pay : null}
        cancelled={payment === "cancelled"}
      />
    </MemberScreen>
  );
}
