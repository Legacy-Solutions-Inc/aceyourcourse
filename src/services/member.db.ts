import "server-only";

import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import type { MemberService } from "@/services/member";
import {
  agreedVersionsSchema,
  memberEmailSchema,
  memberUserIdSchema,
  memberUserSchema,
} from "@/services/member.schema";
import type { ConsentRecord, Member } from "@/services/member.types";

// The Member seam on Postgres, selected by src/services/member.ts when
// DATABASE_URL is set. Drizzle bypasses RLS, so each call is scoped here, in
// the app layer, to the User the Member App gate passes it (coding standards
// §3): a Member's records are only ever read or made by their own User id.

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

export const databaseArm: MemberService = {
  isBetaTester,
  getOrCreateMember,
  latestConsent,
  recordConsent,
};
