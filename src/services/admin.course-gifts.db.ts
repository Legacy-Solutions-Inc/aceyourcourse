import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { staffActivityToRow } from "@/services/admin.rows";
import { type CourseGiftStore, courseGiftCalls } from "@/services/course-ownership.core";
import { courseFromRow, courseOwnershipFromRow } from "@/services/courses.rows";
import {
  memberFromRow,
  noticeToRow,
  readPaidCourseOrders,
  targetExamFromRow,
  writeTargetExam,
} from "@/services/member.db";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's "Give Course" and "Remove Course" on Postgres (Phase 5,
// ticket 07): the shared calls (src/services/course-ownership.core.ts) over
// course_ownerships and the records a change writes with it. Each change
// runs in one transaction that first locks the Member's row, as a grant and
// a payment's outcome do (admin.access-passes.db.ts, member.db.ts), so a
// gift, a refund and a Paid Order for the same Member take turns; then the
// Ownership, the Target Exam, the notice and the Staff Activity are written
// together, or none of them.
// Drizzle bypasses RLS, so authorisation is the seam's role check and the
// Staff Guard (coding standards §3).
// ─────────────────────────────────────────────────────────────────────────────

const { courseOwnerships, courses, members, memberTargetExams } = schema;

const databaseCourseGiftStore: CourseGiftStore = {
  async withMemberCourse(userId, courseId, work) {
    try {
      return await getDb().transaction(async (tx) => {
        const [member] = await tx
          .select()
          .from(members)
          .where(eq(members.userId, userId))
          .for("update");
        if (!member) return null;
        const theirs = and(
          eq(courseOwnerships.userId, userId),
          eq(courseOwnerships.courseId, courseId),
        );
        const [course] = await tx.select().from(courses).where(eq(courses.id, courseId));
        const [ownership] = await tx.select().from(courseOwnerships).where(theirs);
        const paidOrders = await readPaidCourseOrders(tx, userId, courseId);
        const targetExams = await tx
          .select()
          .from(memberTargetExams)
          .where(eq(memberTargetExams.userId, userId))
          .orderBy(asc(memberTargetExams.seq));

        const { write, result } = work({
          member: memberFromRow(member),
          course: course ? courseFromRow(course) : null,
          ownership: ownership ? courseOwnershipFromRow(ownership) : null,
          paidOrders,
          targetExams: targetExams.map(targetExamFromRow),
        });
        if (!write) return result;

        const { change } = write;
        if (change.kind === "give") {
          const { ownership } = change;
          await tx
            .insert(courseOwnerships)
            .values({ ...ownership, since: new Date(ownership.since) });
          if (change.targetExam) await writeTargetExam(tx, userId, change.targetExam);
        } else {
          await tx.delete(courseOwnerships).where(theirs);
        }
        await tx.insert(schema.memberNotices).values(noticeToRow(write.notice));
        await tx.insert(schema.staffActivity).values(staffActivityToRow(write.activity));
        return result;
      });
    } catch (error) {
      throw asDatabaseError(error);
    }
  },
};

export const { giveCourse, removeCourse } = courseGiftCalls(databaseCourseGiftStore);
