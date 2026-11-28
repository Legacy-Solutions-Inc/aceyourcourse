import type { Order } from "@/lib/payments/order-ledger";
import {
  courseIdSchema,
  type CourseOwnershipInput,
  courseOwnershipInputSchema,
  invalidInput,
  memberIdSchema,
  roleRefusal,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminResult,
  CourseOwnershipChange,
  StaffActivity,
  StaffActor,
} from "@/services/admin.types";
import { activityRecord, formError, NOT_FOUND, refused } from "@/services/content-editor.core";
import type { Course, CourseOwnership } from "@/services/courses.types";
import { grantedTargetExam, type TargetExamRecord } from "@/services/member.rules";
import type { Member, MemberNotice, NoticeKind } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// Giving and removing a Course by hand (Phase 5, ticket 07; spec, Phase 5
// planning decisions → Giving a Course, Who does what; story 172), the Admin
// seam's calls, shared by both arms. Owners only, from a Member's detail
// page; each is refused for an Editor on the server.
//
// - "Give Course": a separately sold Course (Hidden, or not on sale, too).
//   The Member gets Course Ownership with no Order ("Given by Ace Your
//   Course"), an in-app notice ("You now own the PSAD Masterclass"), and the
//   Course's Exam in their Target Exams, added or brought back, as a grant
//   and a payment do. Refused for a Course they own already, however they
//   got it, and for one included in All-Access, or none.
// - "Remove Course": only a given Ownership, with a notice ("You no longer
//   own the PSAD Masterclass"). A paid one goes only by a full refund in
//   PayMongo: refused, and so is a given one a Paid Order for the Course
//   also holds (a late payment), since the Member paid for it.
//
// Each writes the Ownership, the Target Exam, the notice and Staff Activity
// (entity "course-ownership"), all or nothing. Nothing is emailed.
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN = "ONLY AN OWNER CAN GIVE OR REMOVE A COURSE";

export const NOT_SOLD_SEPARATELY = "That isn’t a Course sold separately. Pick one from the list.";
export const alreadyOwns = (course: string) =>
  `This Member already owns the ${course}. Nothing was changed.`;
export const notOwned = (course: string) =>
  `This Member doesn’t own the ${course}, so there’s nothing to remove. Nothing was changed.`;
export const paidFor = (course: string, reference: string) =>
  `This Member paid for the ${course} (${reference}), so only a full refund in PayMongo removes it. Nothing was changed.`;

/** Pure: a Course Ownership's id in Staff Activity: the Member's and the Course's (ticket 06). */
export const courseOwnershipEntityId = (userId: string, courseId: string) =>
  `${courseOwnershipEntityPrefix(userId)}${courseId}`;

/** Pure: how Staff Activity's ids for a Member's Course Ownerships begin: their User id. */
export const courseOwnershipEntityPrefix = (userId: string) => `${userId}:`;

/**
 * Pure: the notice a Course's change leaves the Member: given, removed, or
 * refunded (naming the Order). It ends nothing, so its `endsAt` is `now`.
 */
export const courseNoticeOf = (
  userId: string,
  examCode: string,
  kind: Extract<NoticeKind, `course-${string}`>,
  courseTitle: string,
  now: Date,
  reference: string | null = null,
): MemberNotice => ({
  id: crypto.randomUUID(),
  userId,
  examCode,
  kind,
  endsAt: now.toISOString(),
  createdAt: now.toISOString(),
  dismissedAt: null,
  reference,
  courseTitle,
});

/** A Member and one Course as giving or removing it finds them. */
export interface CourseGiftHolding {
  member: Member;
  /** The Course, or null for an id no Course has. */
  course: Course | null;
  /** The Member's Ownership of it, or null. */
  ownership: CourseOwnership | null;
  /** The Member's Paid Orders for it (not Refunded), oldest paid first. */
  paidOrders: Pick<Order, "id" | "reference">[];
  /** The Member's Target Exam records, removed ones too, in the order first added. */
  targetExams: TargetExamRecord[];
}

/** What giving or removing writes, all or nothing. */
export interface CourseGiftWrite {
  /**
   * The Ownership given, with the Target Exam record the gift added or
   * brought back (replacing any by its Exam; null when theirs already); or
   * the Ownership removed, by its Member and Course.
   */
  change:
    | { kind: "give"; ownership: CourseOwnership; targetExam: TargetExamRecord | null }
    | { kind: "remove"; userId: string; courseId: string };
  notice: MemberNotice;
  activity: StaffActivity;
}

/** How an arm reads and writes a Member's Course Ownerships by hand. */
export interface CourseGiftStore {
  /**
   * Runs `work` on the Member and the Course as they are now, then writes
   * what it gives, all as one step: two changes to the same Member never
   * interleave, and a write that fails partway leaves everything as it was.
   * Gives work's result, or null for a User id no Member has.
   */
  withMemberCourse<T>(
    userId: string,
    courseId: string,
    work: (holding: CourseGiftHolding) => { write: CourseGiftWrite | null; result: T },
  ): Promise<T | null>;
}

/** The refusal of a Course that isn't sold separately, or isn't there, on the Course field. */
const NOT_A_COURSE_TO_GIVE: AdminError = {
  kind: "invalid",
  fieldErrors: { courseId: [NOT_SOLD_SEPARATELY] },
};

const saved = (value: CourseOwnershipChange): AdminResult<CourseOwnershipChange> => ({
  ok: true,
  value,
  tags: [],
});

const refuse = (error: AdminError) => ({ write: null, result: refused(error) });

/** The Admin seam's "Give Course" and "Remove Course", over an arm's store. */
export function courseGiftCalls(store: CourseGiftStore) {
  /** The Owner check and the input; gives the refusal, or the Member and Course ids. */
  function checked(
    actor: StaffActor,
    sent: CourseOwnershipInput,
  ): { refusal: AdminResult<never> } | { userId: string; courseId: string } {
    const role = roleRefusal(actor, "owner", FORBIDDEN);
    if (role) return { refusal: refused(role) };
    const parsed = courseOwnershipInputSchema.safeParse(sent);
    if (!parsed.success) return { refusal: refused(invalidInput(parsed.error)) };
    const { userId, courseId } = parsed.data;
    if (!memberIdSchema.safeParse(userId).success) return { refusal: NOT_FOUND };
    // Any other id names no Course: refused on the field, as a Course not sold separately is.
    if (!courseIdSchema.safeParse(courseId).success) {
      return { refusal: refused(NOT_A_COURSE_TO_GIVE) };
    }
    return { userId, courseId };
  }

  async function giveCourse(
    actor: StaffActor,
    sent: CourseOwnershipInput,
  ): Promise<AdminResult<CourseOwnershipChange>> {
    const checks = checked(actor, sent);
    if ("refusal" in checks) return checks.refusal;
    const { userId, courseId } = checks;
    const now = new Date();
    const result = await store.withMemberCourse(userId, courseId, (holding) => {
      const { member, course, ownership } = holding;
      if (!course || course.access !== "sold-separately") return refuse(NOT_A_COURSE_TO_GIVE);
      if (ownership) return refuse(formError(alreadyOwns(course.title)));
      const added = grantedTargetExam(holding.targetExams, course.examCode, now);
      const targetExam = added?.change ?? null;
      const since = now.toISOString();
      const { email } = member;
      return {
        write: {
          change: {
            kind: "give",
            ownership: { userId, courseId, since, orderId: null },
            targetExam: added?.record ?? null,
          },
          notice: courseNoticeOf(userId, course.examCode, "course-given", course.title, now),
          activity: activityRecord(
            actor,
            now,
            "course-ownership",
            courseOwnershipEntityId(userId, courseId),
            "give-course",
            null,
            { email, courseId, course: course.title, since, targetExam },
          ),
        },
        result: saved({ userId, courseId, course: course.title, since, targetExam }),
      };
    });
    return result ?? NOT_FOUND;
  }

  async function removeCourse(
    actor: StaffActor,
    sent: CourseOwnershipInput,
  ): Promise<AdminResult<CourseOwnershipChange>> {
    const checks = checked(actor, sent);
    if ("refusal" in checks) return checks.refusal;
    const { userId, courseId } = checks;
    const now = new Date();
    const result = await store.withMemberCourse(userId, courseId, (holding) => {
      const { member, course, ownership, paidOrders } = holding;
      if (!course) return refuse(NOT_A_COURSE_TO_GIVE);
      if (!ownership) return refuse(formError(notOwned(course.title)));
      // A paid one is held by its Order; a given one by a payment that landed after the gift.
      const paid =
        ownership.orderId === null
          ? paidOrders[0]
          : (paidOrders.find((order) => order.id === ownership.orderId) ?? {
              reference: "its Order",
            });
      if (paid) return refuse(formError(paidFor(course.title, paid.reference)));
      const { email } = member;
      return {
        write: {
          change: { kind: "remove", userId, courseId },
          notice: courseNoticeOf(userId, course.examCode, "course-removed", course.title, now),
          activity: activityRecord(
            actor,
            now,
            "course-ownership",
            courseOwnershipEntityId(userId, courseId),
            "remove-course",
            { email, courseId, course: course.title, since: ownership.since },
            null,
          ),
        },
        result: saved({ userId, courseId, course: course.title, since: null, targetExam: null }),
      };
    });
    return result ?? NOT_FOUND;
  }

  return { giveCourse, removeCourse };
}
