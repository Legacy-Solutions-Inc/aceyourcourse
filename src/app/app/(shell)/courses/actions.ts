"use server";

import { requireMemberAccess, shownRefusal } from "@/lib/member-app/access-check";
import { paths } from "@/paths";
import { completeLesson, saveLessonPosition } from "@/services/member";
import {
  lessonCompleteInputSchema,
  lessonPositionInputSchema,
  lessonRefSchema,
} from "@/services/member.schema";
import type { LessonSaveResult } from "@/services/member.types";

// The Lesson screen's actions (Phase 5, ticket 04; spec, Phase 5 planning
// decisions → Watching a Lesson): saving where the Member is in the video,
// and "Mark complete". Each runs the Member App's server checks first (the
// gate, consent, then the Active Device), takes who the Member is from the
// session alone, and passes the access decision's inputs, gathered now, to
// the Member seam, which decides the Lesson before it stores anything. A
// save from a replaced device is refused like every Member App action: it
// redirects to "Session ended" (paths.memberApp.device), which takes the
// page, and so the video, away.

/** What the player hears back from a save. */
export type LessonActionState =
  | { status: "saved"; done: boolean }
  /** The access decision refused the Lesson: locked, expired, or no longer available. */
  | { status: "refused" }
  /** No such Lesson, or a position outside its length: nothing was saved. */
  | { status: "not-saved" };

/** The Lesson's page, which the checks' redirects come back to: the Courses screen when it's unclear. */
function lessonPath(input: unknown): string {
  const sent = lessonRefSchema.safeParse(input);
  return sent.success
    ? paths.memberApp.lesson(sent.data.courseId, sent.data.lessonId)
    : paths.memberApp.courses;
}

function stateOf(result: LessonSaveResult, from: string): LessonActionState {
  if (result.ok) return { status: "saved", done: result.value.doneAt !== null };
  const { refusal } = result;
  if (refusal.reason !== "refused") return { status: "not-saved" };
  // The gate's and the Active Device's refusals redirect to their own screens.
  shownRefusal(refusal.decision, from);
  return { status: "refused" };
}

/** Every 10 seconds while playing, and on pause, at the end and on leaving: where the Member is. */
export async function saveLessonPlace(input: unknown): Promise<LessonActionState> {
  const from = lessonPath(input);
  const { member, access } = await requireMemberAccess(from);
  const sent = lessonPositionInputSchema.safeParse(input);
  if (!sent.success) return { status: "not-saved" };
  return stateOf(await saveLessonPosition(member.userId, sent.data, access), from);
}

/** "Mark complete": the Lesson is done, for good. */
export async function markLessonComplete(input: unknown): Promise<LessonActionState> {
  const from = lessonPath(input);
  const { member, access } = await requireMemberAccess(from);
  const sent = lessonCompleteInputSchema.safeParse(input);
  if (!sent.success) return { status: "not-saved" };
  return stateOf(await completeLesson(member.userId, sent.data, access), from);
}
