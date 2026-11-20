"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMember } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import {
  addTargetExam,
  dismissNotice,
  removeTargetExam,
  selectTargetExam,
  setExamDate,
} from "@/services/member";
import {
  noticeIdSchema,
  TARGET_EXAM_REFUSALS,
  targetExamFormSchema,
} from "@/services/member.schema";

// The Member App's Target Exam actions (spec, Phase 3 → Target Exams). Each
// one runs the Member App's server checks first (the gate, then consent), and
// changes only the signed-in Member's own Target Exams: who they are comes
// from the session alone, never from the form. The seam decides what's
// allowed (member.rules.ts); the forms' own checks are a convenience.

/** What a Target Exam form shows after a refused send. */
export interface ExamFormState {
  error: string | null;
}

/** What "Save date" shows: why it was refused, or that it saved. */
export interface ExamDateState extends ExamFormState {
  saved: boolean;
}

/** The shell shows the selected Target Exam on every screen, so a change redraws all of it. */
/** The form's Exam and date, as text: the seam decides whether they're allowed. */
function sent(formData: FormData) {
  return targetExamFormSchema.parse({
    examCode: formData.get("examCode"),
    examDate: formData.get("examDate"),
  });
}

function redrawShell(): void {
  revalidatePath(paths.memberApp.home, "layout");
}

/**
 * "Start my countdown" in onboarding, and "Add exam" in the add form: adds
 * the Exam to the Member's Target Exams, selects it and goes to Home. An Exam
 * they removed earlier comes back with the date it had, and Home says so.
 */
export async function addExam(
  _previous: ExamFormState,
  formData: FormData,
): Promise<ExamFormState> {
  const member = await requireMember(paths.memberApp.home);
  const result = await addTargetExam(member.userId, sent(formData));
  if (!result.ok) return { error: TARGET_EXAM_REFUSALS[result.error] };

  redrawShell();
  const { targetExam, restored } = result.value;
  redirect(restored ? paths.memberApp.examRestored(targetExam.examCode) : paths.memberApp.home);
}

/** "Save date" in Account: sets the Member's own Exam Date for one of their Target Exams. */
export async function changeExamDate(
  _previous: ExamDateState,
  formData: FormData,
): Promise<ExamDateState> {
  const member = await requireMember(paths.memberApp.account);
  const { examCode, examDate } = sent(formData);
  const result = await setExamDate(member.userId, examCode, examDate);
  if (!result.ok) return { error: TARGET_EXAM_REFUSALS[result.error], saved: false };

  redrawShell();
  return { error: null, saved: true };
}

/** "Remove" in Account, once confirmed: refused for the Member's last Target Exam. */
export async function removeExam(
  _previous: ExamFormState,
  formData: FormData,
): Promise<ExamFormState> {
  const member = await requireMember(paths.memberApp.account);
  const result = await removeTargetExam(member.userId, sent(formData).examCode);
  if (!result.ok) return { error: TARGET_EXAM_REFUSALS[result.error] };

  redrawShell();
  return { error: null };
}

/**
 * The exam switcher: makes one of the Member's Target Exams the selected one.
 * An Exam that isn't theirs changes nothing; the screen redraws either way,
 * showing what is selected now.
 */
export async function switchExam(formData: FormData): Promise<void> {
  const member = await requireMember(paths.memberApp.home);
  await selectTargetExam(member.userId, sent(formData).examCode);
  redrawShell();
}

/**
 * "Dismiss" on an in-app notice (ticket 17): dismisses it for good, on every
 * device. Only the signed-in Member's own notice is dismissed: who they are
 * comes from the session, and the seam changes nothing for another's. The
 * shell redraws without it.
 */
export async function dismissMemberNotice(noticeId: unknown): Promise<{ ok: boolean }> {
  const member = await requireMember(paths.memberApp.home);
  const sent = noticeIdSchema.safeParse(noticeId);
  if (!sent.success) return { ok: false };
  const ok = await dismissNotice(member.userId, sent.data);
  if (ok) redrawShell();
  return { ok };
}
