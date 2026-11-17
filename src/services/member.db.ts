import "server-only";

import { asc, count, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { deviceStatusFor } from "@/lib/member-app/device-token";
import type { MemberService } from "@/services/member";
import {
  agreedVersionsSchema,
  deviceClaimSchema,
  memberEmailSchema,
  memberUserIdSchema,
  memberUserSchema,
} from "@/services/member.schema";
import {
  examsForMembers,
  pickableExams,
  targetExamOperations,
  targetExams,
  type MemberExam,
  type TargetExamRecord,
  type WithMemberExams,
} from "@/services/member.rules";
import type { ConsentRecord, DeviceSwitch, Member } from "@/services/member.types";

// The Member seam on Postgres, selected by src/services/member.ts when
// DATABASE_URL is set. Drizzle bypasses RLS, so each call is scoped here, in
// the app layer, to the User the Member App gate passes it (coding standards
// §3): a Member's records are only ever read or made by their own User id.
// The Target Exam rules are shared with the sample arm (member.rules.ts), and
// the Active Device's comparison with it (device-token.ts).

type MemberRow = typeof schema.members.$inferSelect;
type ConsentRow = typeof schema.memberConsents.$inferSelect;

export const memberFromRow = (row: MemberRow): Member => ({
  userId: row.userId,
  email: row.email,
  name: row.name,
  joinedAt: row.joinedAt.toISOString(),
});

export const consentFromRow = (row: ConsentRow): ConsentRecord => ({
  userId: row.userId,
  termsVersion: row.termsVersion,
  privacyVersion: row.privacyVersion,
  agreedAt: row.agreedAt.toISOString(),
});

const isBetaTester: MemberService["isBetaTester"] = async (email) => {
  const wanted = memberEmailSchema.safeParse(email);
  if (!wanted.success) return false;
  const { betaTesters } = schema;
  try {
    const [row] = await getDb()
      .select({ email: betaTesters.email })
      .from(betaTesters)
      .where(eq(betaTesters.email, wanted.data))
      .limit(1);
    return row !== undefined;
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const getOrCreateMember: MemberService["getOrCreateMember"] = async (user) => {
  const { userId, email, name } = memberUserSchema.parse(user);
  const { members } = schema;
  try {
    // The first request makes the row; one arriving alongside it finds the
    // primary key taken, adds nothing, and reads the row that won.
    const [made] = await getDb()
      .insert(members)
      .values({ userId, email, name, joinedAt: new Date() })
      .onConflictDoNothing({ target: members.userId })
      .returning();
    if (made) return memberFromRow(made);
    const [existing] = await getDb().select().from(members).where(eq(members.userId, userId));
    if (!existing) throw new Error("The Member record was neither made nor found.");
    return memberFromRow(existing);
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const latestConsent: MemberService["latestConsent"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { memberConsents } = schema;
  try {
    const [row] = await getDb()
      .select()
      .from(memberConsents)
      .where(eq(memberConsents.userId, wanted))
      .orderBy(desc(memberConsents.seq))
      .limit(1);
    return row ? consentFromRow(row) : null;
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const recordConsent: MemberService["recordConsent"] = async (userId, versions) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { termsVersion, privacyVersion } = agreedVersionsSchema.parse(versions);
  try {
    // The foreign key to members refuses a User the gate never let in.
    const [made] = await getDb()
      .insert(schema.memberConsents)
      .values({ userId: wanted, termsVersion, privacyVersion, agreedAt: new Date() })
      .returning();
    if (!made) throw new Error("The consent record wasn't made.");
    return consentFromRow(made);
  } catch (error) {
    throw asDatabaseError(error);
  }
};

type TargetExamRow = typeof schema.memberTargetExams.$inferSelect;

const targetExamFromRow = (row: TargetExamRow): TargetExamRecord => ({
  examCode: row.examCode,
  memberExamDate: row.memberExamDate,
  addedAt: row.addedAt.toISOString(),
  removedAt: row.removedAt?.toISOString() ?? null,
});

type Reader = Pick<ReturnType<typeof getDb>, "select">;

/**
 * Every Exam as the Member App needs it, read fresh: only the columns the
 * rules use, so a Staff change to an Official Exam Date shows on the next
 * request.
 */
async function readExams(db: Reader): Promise<MemberExam[]> {
  const { exams, products, examPages } = schema;
  return examsForMembers({
    exams: await db
      .select({ code: exams.code, board: exams.board, name: exams.name })
      .from(exams)
      .orderBy(asc(exams.position)),
    products: await db
      .select({ examCode: products.examCode, showOnWebsite: products.showOnWebsite })
      .from(products),
    examPages: await db
      .select({ examCode: examPages.examCode, officialExamDate: examPages.officialExamDate })
      .from(examPages),
  });
}

/** One Member's Target Exam records, removed ones too, in the order first added. */
async function readRecords(db: Reader, userId: string): Promise<TargetExamRecord[]> {
  const { memberTargetExams } = schema;
  const rows = await db
    .select()
    .from(memberTargetExams)
    .where(eq(memberTargetExams.userId, userId))
    .orderBy(asc(memberTargetExams.seq));
  return rows.map(targetExamFromRow);
}

const listPickableExams: MemberService["listPickableExams"] = async () => {
  try {
    return pickableExams(await readExams(getDb()));
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const listTargetExams: MemberService["listTargetExams"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { members } = schema;
  try {
    const db = getDb();
    const [member] = await db
      .select({ selectedExamCode: members.selectedExamCode })
      .from(members)
      .where(eq(members.userId, wanted));
    return targetExams({
      records: await readRecords(db, wanted),
      selectedExamCode: member?.selectedExamCode ?? null,
      exams: await readExams(db),
    });
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const withMemberExams: WithMemberExams = async (userId, work) => {
  const { members, memberTargetExams } = schema;
  try {
    return await getDb().transaction(async (tx) => {
      // Locking the Member's row makes their changes take turns, so two
      // removals arriving together can't both leave them with no Target Exam.
      const [member] = await tx
        .select({ selectedExamCode: members.selectedExamCode })
        .from(members)
        .where(eq(members.userId, userId))
        .for("update");
      if (!member) throw new Error("Only a Member has Target Exams.");

      const { change, result } = work({
        records: await readRecords(tx, userId),
        selectedExamCode: member.selectedExamCode,
        exams: await readExams(tx),
      });
      if (change?.record) {
        const { examCode, memberExamDate, addedAt, removedAt } = change.record;
        const removed = removedAt === null ? null : new Date(removedAt);
        await tx
          .insert(memberTargetExams)
          .values({
            userId,
            examCode,
            memberExamDate,
            addedAt: new Date(addedAt),
            removedAt: removed,
          })
          .onConflictDoUpdate({
            target: [memberTargetExams.userId, memberTargetExams.examCode],
            set: { memberExamDate, removedAt: removed },
          });
      }
      if (change && change.selectedExamCode !== undefined) {
        await tx
          .update(members)
          .set({ selectedExamCode: change.selectedExamCode })
          .where(eq(members.userId, userId));
      }
      return result;
    });
  } catch (error) {
    throw asDatabaseError(error);
  }
};

// ── The Active Device ───────────────────────────────────────────────────────

type DeviceSwitchRow = typeof schema.memberDeviceSwitches.$inferSelect;

export const deviceSwitchFromRow = (row: DeviceSwitchRow): DeviceSwitch => ({
  userId: row.userId,
  deviceLabel: row.deviceLabel,
  switchedAt: row.switchedAt.toISOString(),
});

const claimDevice: MemberService["claimDevice"] = async (userId, claim) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { tokenHash, deviceLabel } = deviceClaimSchema.parse(claim);
  const { memberActiveDevices, memberDeviceSwitches } = schema;
  const claimedAt = new Date();
  try {
    // One transaction: the record is never replaced without its log row. The
    // foreign keys to members refuse a User the gate never let in.
    await getDb().transaction(async (tx) => {
      await tx
        .insert(memberActiveDevices)
        .values({ userId: wanted, tokenHash, deviceLabel, claimedAt })
        .onConflictDoUpdate({
          target: memberActiveDevices.userId,
          set: { tokenHash, deviceLabel, claimedAt },
        });
      await tx
        .insert(memberDeviceSwitches)
        .values({ userId: wanted, deviceLabel, switchedAt: claimedAt });
    });
    return { deviceLabel, claimedAt: claimedAt.toISOString() };
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const deviceStatus: MemberService["deviceStatus"] = async (userId, tokenHash) => {
  const wanted = memberUserIdSchema.parse(userId);
  if (tokenHash === null) return "no-token";
  const { memberActiveDevices } = schema;
  try {
    const [row] = await getDb()
      .select({ tokenHash: memberActiveDevices.tokenHash })
      .from(memberActiveDevices)
      .where(eq(memberActiveDevices.userId, wanted));
    return deviceStatusFor(row?.tokenHash ?? null, tokenHash);
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const getActiveDevice: MemberService["getActiveDevice"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { memberActiveDevices } = schema;
  try {
    const [row] = await getDb()
      .select({
        deviceLabel: memberActiveDevices.deviceLabel,
        claimedAt: memberActiveDevices.claimedAt,
      })
      .from(memberActiveDevices)
      .where(eq(memberActiveDevices.userId, wanted));
    return row ? { deviceLabel: row.deviceLabel, claimedAt: row.claimedAt.toISOString() } : null;
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const listDeviceSwitches: MemberService["listDeviceSwitches"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { memberDeviceSwitches } = schema;
  try {
    const rows = await getDb()
      .select()
      .from(memberDeviceSwitches)
      .where(eq(memberDeviceSwitches.userId, wanted))
      .orderBy(asc(memberDeviceSwitches.seq));
    return rows.map(deviceSwitchFromRow);
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const deviceSwitchCount: MemberService["deviceSwitchCount"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { memberDeviceSwitches } = schema;
  try {
    const [row] = await getDb()
      .select({ switches: count() })
      .from(memberDeviceSwitches)
      .where(eq(memberDeviceSwitches.userId, wanted));
    return row?.switches ?? 0;
  } catch (error) {
    throw asDatabaseError(error);
  }
};

export const databaseArm: MemberService = {
  isBetaTester,
  getOrCreateMember,
  latestConsent,
  recordConsent,
  listPickableExams,
  listTargetExams,
  ...targetExamOperations(withMemberExams),
  claimDevice,
  deviceStatus,
  getActiveDevice,
  listDeviceSwitches,
  deviceSwitchCount,
};
