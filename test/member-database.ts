import { asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { databaseArm as adminDatabaseArm } from "@/services/admin.db";
import {
  accessPassToRow,
  quizAttemptAnswerFromRow,
  quizAttemptFromRow,
} from "@/services/content.rows";
import {
  consentFromRow,
  databaseArm,
  deviceSwitchFromRow,
  memberFromRow,
  privacyRequestFieldsFromRow,
} from "@/services/member.db";

import { byMemberAndPage } from "./admin-arms";
import { DATABASE_ARM as ADMIN_DATABASE_ARM } from "./admin-database";
import { sampleActor } from "./admin-inputs";
import type { MemberArm } from "./member-arms";

/** Who marks a Privacy Request done behind the seam's back: the sample Owner, as they are. */
const OWNER = { email: sampleActor("owner").email, name: sampleActor("owner").name };

/**
 * The Member seam's database arm in the database project (`pnpm test:db`),
 * where vitest.config.ts points DATABASE_URL at TEST_DATABASE_URL. Each reset
 * loads the seed, the sample staff list and the sample Beta Tester list, and
 * clears the Members with their consent records, Target Exams and Active
 * Devices, as `pnpm db:reset` does.
 */
export const MEMBER_DATABASE_ARM: MemberArm = {
  name: "database",
  seam: databaseArm,
  admin: adminDatabaseArm,
  reset: (edit) => ADMIN_DATABASE_ARM.reset(edit),
  members: async () =>
    (
      await getDb()
        .select()
        .from(schema.members)
        .orderBy(asc(schema.members.joinedAt), asc(schema.members.userId))
    ).map(memberFromRow),
  consents: async () =>
    (
      await getDb().select().from(schema.memberConsents).orderBy(asc(schema.memberConsents.seq))
    ).map(consentFromRow),
  activeDevices: async () =>
    (
      await getDb()
        .select()
        .from(schema.memberActiveDevices)
        .orderBy(asc(schema.memberActiveDevices.claimedAt))
    ).map((row) => ({ ...row, claimedAt: row.claimedAt.toISOString() })),
  deviceSwitches: async () =>
    (
      await getDb()
        .select()
        .from(schema.memberDeviceSwitches)
        .orderBy(asc(schema.memberDeviceSwitches.seq))
    ).map(deviceSwitchFromRow),
  putAccessPass: async (pass) => {
    await getDb().insert(schema.accessPasses).values(accessPassToRow(pass));
  },
  // The Admin's database arm uploads and reads them as the Member seam's does.
  uploadCardImage: (bytes, options) => ADMIN_DATABASE_ARM.uploadCardImage(bytes, options),
  uploadReviewerPdf: (bytes) => ADMIN_DATABASE_ARM.uploadReviewerPdf(bytes),
  cardMarks: () => ADMIN_DATABASE_ARM.cardMarks(),
  pageViews: async () =>
    byMemberAndPage(
      (await getDb().select().from(schema.reviewerPageViews)).map((row) => ({
        ...row,
        viewedAt: row.viewedAt.toISOString(),
      })),
    ),
  quizAttempts: async () => {
    const db = getDb();
    const [attempts, answers] = await Promise.all([
      db
        .select()
        .from(schema.quizAttempts)
        .orderBy(asc(schema.quizAttempts.submittedAt), asc(schema.quizAttempts.id)),
      db.select().from(schema.quizAttemptAnswers).orderBy(asc(schema.quizAttemptAnswers.position)),
    ]);
    return attempts.map((row) => ({
      ...quizAttemptFromRow(row),
      answers: answers
        .filter((answer) => answer.attemptId === row.id)
        .map(quizAttemptAnswerFromRow),
    }));
  },
  privacyRequests: async () =>
    (
      await getDb()
        .select()
        .from(schema.privacyRequests)
        .orderBy(asc(schema.privacyRequests.requestedAt), asc(schema.privacyRequests.id))
    ).map((row) => ({ ...privacyRequestFieldsFromRow(row), userId: row.userId })),
  finishPrivacyRequest: async (id) => {
    await getDb()
      .update(schema.privacyRequests)
      .set({
        status: "done",
        doneAt: new Date(),
        doneByEmail: OWNER.email,
        doneByName: OWNER.name,
      })
      .where(eq(schema.privacyRequests.id, id));
  },
  orders: () => ADMIN_DATABASE_ARM.orders(),
  adminArm: ADMIN_DATABASE_ARM,
};
