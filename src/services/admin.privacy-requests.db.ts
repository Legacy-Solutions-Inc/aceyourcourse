import "server-only";

import { and, asc, eq, like, or } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { adminWriteLock } from "@/lib/db/admin-locks";
import { getDb } from "@/lib/db/client";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { isReaderZoom } from "@/lib/reviewer-pdfs/reader";
import { passEntityPrefix } from "@/services/access-passes.core";
import { staffActivityFromRow, staffActivityToRow } from "@/services/admin.rows";
import {
  accessPassFromRow,
  accessPassGrantFromRow,
  quizAttemptAnswerFromRow,
  quizAttemptFromRow,
} from "@/services/content.rows";
import {
  consentFromRow,
  deviceSwitchFromRow,
  memberFromRow,
  noticeFromRow,
  privacyRequestFieldsFromRow,
  targetExamFromRow,
} from "@/services/member.db";
import {
  type PrivacyRequestRecord,
  type PrivacyRequestsStore,
  privacyRequestCalls,
  type StoredPrivacyRequest,
  withoutDeletedMember,
} from "@/services/privacy-requests.core";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Privacy Requests on Postgres (Phase 3, tickets 18 and 19):
// the shared calls (src/services/privacy-requests.core.ts) over
// privacy_requests, each with its Member, or none once their account is
// deleted (the request's user_id is emptied then).
//
// Carrying a request out runs in one transaction that takes the staff list's
// write lock (so an Invite or a role change can't slip in between the staff
// check and the deletion) and locks the request and its Member's row. Deleting
// a Member deletes their Access Passes (the grants cascade) and their members
// row, whose foreign keys cascade to every other Member App record and empty
// their requests' user_id. The earlier Staff Activity about the account loses
// the Member's email in the same transaction, and the call's own record is
// written last, so a failure anywhere rolls every row back. Drizzle bypasses
// RLS, so authorisation is the seam's role check and the Staff Guard (coding
// standards §3).
// ─────────────────────────────────────────────────────────────────────────────

const { accessPasses, accessPassGrants, betaTesters, members, privacyRequests } = schema;
const { staff, staffActivity } = schema;
const { memberTargetExams, memberActiveDevices, memberConsents, memberDeviceSwitches } = schema;
const { cardMarks, quizAttempts, quizAttemptAnswers, reviewerPageViews, studyDays } = schema;
const { deckPositions, readerPositions, memberNotices } = schema;

type PrivacyRequestRow = typeof privacyRequests.$inferSelect;
type MemberRow = typeof members.$inferSelect;

/** A request row with its Member's row (or none), as the list reads it. */
const storedRequestOf = (
  row: PrivacyRequestRow,
  member: MemberRow | null,
): StoredPrivacyRequest => ({
  ...privacyRequestFieldsFromRow(row),
  member: member ? { userId: member.userId, email: member.email, name: member.name } : null,
  doneAt: row.doneAt?.toISOString() ?? null,
  doneBy:
    row.doneByEmail !== null && row.doneByName !== null
      ? { email: row.doneByEmail, name: row.doneByName }
      : null,
});

const databasePrivacyRequestsStore: PrivacyRequestsStore = {
  async readRequests() {
    try {
      const rows = await getDb()
        .select({ request: privacyRequests, member: members })
        .from(privacyRequests)
        .leftJoin(members, eq(members.userId, privacyRequests.userId));
      return rows.map(({ request, member }) => storedRequestOf(request, member));
    } catch (error) {
      throw asDatabaseError(error);
    }
  },

  async withRequest(id, work) {
    try {
      return await getDb().transaction(async (tx) => {
        await tx.execute(adminWriteLock("staff"));
        const [row] = await tx
          .select()
          .from(privacyRequests)
          .where(eq(privacyRequests.id, id))
          .for("update");
        if (!row) return null;
        const [member] = row.userId
          ? await tx.select().from(members).where(eq(members.userId, row.userId)).for("update")
          : [];
        const listed = await tx
          .select({ email: staff.email, role: staff.role, status: staff.status })
          .from(staff);
        const [tester] = member
          ? await tx
              .select({ email: betaTesters.email })
              .from(betaTesters)
              .where(eq(betaTesters.email, member.email))
          : [];

        const record: PrivacyRequestRecord = {
          ...storedRequestOf(row, member ?? null),
          deletedUserId: row.deletedUserId,
          staff: listed
            .filter(({ status }) => status === "active")
            .map(({ email, role }) => ({ email, role })),
          invites: listed
            .filter(({ status }) => status === "invited")
            .map(({ email }) => ({ email })),
          betaTester: tester !== undefined,
        };
        const { write, result } = work(record);
        if (!write) return result;

        const userId = write.deleteMemberOf;
        if (userId) {
          const earlier = await tx
            .select()
            .from(staffActivity)
            .where(
              or(
                and(eq(staffActivity.entity, "member"), eq(staffActivity.entityId, userId)),
                and(
                  eq(staffActivity.entity, "access-pass"),
                  like(staffActivity.entityId, `${passEntityPrefix(userId)}%`),
                ),
              ),
            );
          for (const entry of earlier) {
            const scrubbed = withoutDeletedMember(staffActivityFromRow(entry), userId);
            if (!scrubbed) continue;
            await tx
              .update(staffActivity)
              .set({ before: scrubbed.before, after: scrubbed.after })
              .where(eq(staffActivity.id, entry.id));
          }
          // The grants go with their passes; every other record with the Member's row.
          await tx.delete(accessPasses).where(eq(accessPasses.userId, userId));
          await tx.delete(members).where(eq(members.userId, userId));
          await tx
            .update(privacyRequests)
            .set({ deletedUserId: userId })
            .where(eq(privacyRequests.id, id));
        }
        if (write.done) {
          await tx
            .update(privacyRequests)
            .set({
              status: "done",
              doneAt: new Date(write.done.at),
              doneByEmail: write.done.by.email,
              doneByName: write.done.by.name,
            })
            .where(eq(privacyRequests.id, id));
        }
        if (write.activity)
          await tx.insert(staffActivity).values(staffActivityToRow(write.activity));
        return result;
      });
    } catch (error) {
      throw asDatabaseError(error);
    }
  },

  async readMemberData(userId) {
    const db = getDb();
    const theirs = (table: { userId: AnyPgColumn }) => eq(table.userId, userId);
    try {
      const [member] = await db.select().from(members).where(eq(members.userId, userId));
      if (!member) return null;
      const [
        targetExams,
        [device],
        consents,
        passes,
        grants,
        marks,
        attempts,
        answers,
        views,
        days,
        deckSpots,
        readerSpots,
        switches,
        notices,
      ] = await Promise.all([
        db
          .select()
          .from(memberTargetExams)
          .where(theirs(memberTargetExams))
          .orderBy(asc(memberTargetExams.seq)),
        db.select().from(memberActiveDevices).where(theirs(memberActiveDevices)),
        db.select().from(memberConsents).where(theirs(memberConsents)),
        db.select().from(accessPasses).where(theirs(accessPasses)),
        db
          .select()
          .from(accessPassGrants)
          .where(theirs(accessPassGrants))
          .orderBy(asc(accessPassGrants.seq)),
        db.select().from(cardMarks).where(theirs(cardMarks)),
        db.select().from(quizAttempts).where(theirs(quizAttempts)),
        db
          .select({ answer: quizAttemptAnswers })
          .from(quizAttemptAnswers)
          .innerJoin(quizAttempts, eq(quizAttempts.id, quizAttemptAnswers.attemptId))
          .where(theirs(quizAttempts))
          .orderBy(asc(quizAttemptAnswers.position)),
        db.select().from(reviewerPageViews).where(theirs(reviewerPageViews)),
        db.select().from(studyDays).where(theirs(studyDays)),
        db.select().from(deckPositions).where(theirs(deckPositions)),
        db.select().from(readerPositions).where(theirs(readerPositions)),
        db.select().from(memberDeviceSwitches).where(theirs(memberDeviceSwitches)),
        db.select().from(memberNotices).where(theirs(memberNotices)),
      ]);
      return {
        member: memberFromRow(member),
        selectedExamCode: member.selectedExamCode,
        targetExams: targetExams.map(targetExamFromRow),
        activeDevice: device
          ? { deviceLabel: device.deviceLabel, claimedAt: device.claimedAt.toISOString() }
          : null,
        consents: consents.map(consentFromRow),
        accessPasses: passes.map(accessPassFromRow),
        accessPassGrants: grants.map(accessPassGrantFromRow),
        cardMarks: marks.map(({ markedAt, ...mark }) => ({
          ...mark,
          markedAt: markedAt.toISOString(),
        })),
        quizAttempts: attempts.map((attempt) => ({
          ...quizAttemptFromRow(attempt),
          answers: answers
            .filter(({ answer }) => answer.attemptId === attempt.id)
            .map(({ answer }) => quizAttemptAnswerFromRow(answer)),
        })),
        reviewerPageViews: views.map(({ viewedAt, ...view }) => ({
          ...view,
          viewedAt: viewedAt.toISOString(),
        })),
        studyDays: days,
        deckPositions: deckSpots.map(({ savedAt, ...position }) => ({
          ...position,
          savedAt: savedAt.toISOString(),
        })),
        readerPositions: readerSpots.map(({ savedAt, zoom, ...position }) => {
          // The table's check keeps the zoom one of the reader's.
          if (!isReaderZoom(zoom)) throw new Error(`A reader position has zoom ${zoom}.`);
          return { ...position, zoom, savedAt: savedAt.toISOString() };
        }),
        deviceSwitches: switches.map(deviceSwitchFromRow),
        notices: notices.map(noticeFromRow),
      };
    } catch (error) {
      throw asDatabaseError(error);
    }
  },
};

export const {
  listPrivacyRequests,
  getPrivacyRequestForAdmin,
  exportMemberData,
  deleteMemberAccount,
  markPrivacyRequestDone,
} = privacyRequestCalls(databasePrivacyRequestsStore);
