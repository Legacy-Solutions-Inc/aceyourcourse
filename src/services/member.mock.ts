import {
  agreedVersionsSchema,
  memberEmailSchema,
  memberUserIdSchema,
  memberUserSchema,
} from "@/services/member.schema";
import type { AgreedVersions, ConsentRecord, Member, MemberUser } from "@/services/member.types";
import { getSampleStore } from "@/services/mock/sample-store";

// The Member seam's sample arm: over the in-memory sample store
// (src/services/mock/sample-store.ts), which holds the Beta Tester list the
// Admin's sample arm edits, the Members, and their consent records.

export async function isBetaTester(email: string): Promise<boolean> {
  const wanted = memberEmailSchema.safeParse(email);
  if (!wanted.success) return false;
  return getSampleStore().betaTesters.some((tester) => tester.email === wanted.data);
}

export async function getOrCreateMember(user: MemberUser): Promise<Member> {
  const { userId, email, name } = memberUserSchema.parse(user);
  const store = getSampleStore();
  const existing = store.members.find((member) => member.userId === userId);
  if (existing) return structuredClone(existing);

  const member: Member = { userId, email, name, joinedAt: new Date().toISOString() };
  store.members = [...store.members, member];
  return structuredClone(member);
}

export async function latestConsent(userId: string): Promise<ConsentRecord | null> {
  const wanted = memberUserIdSchema.parse(userId);
  const latest = getSampleStore().memberConsents.findLast((record) => record.userId === wanted);
  return latest ? structuredClone(latest) : null;
}

export async function recordConsent(
  userId: string,
  versions: AgreedVersions,
): Promise<ConsentRecord> {
  const wanted = memberUserIdSchema.parse(userId);
  const { termsVersion, privacyVersion } = agreedVersionsSchema.parse(versions);
  const store = getSampleStore();
  // Like the database's foreign key: only a Member, someone the gate let in, agrees.
  if (!store.members.some((member) => member.userId === wanted)) {
    throw new Error("Only a Member can agree to the Terms and Privacy Policy.");
  }
  const record: ConsentRecord = {
    userId: wanted,
    termsVersion,
    privacyVersion,
    agreedAt: new Date().toISOString(),
  };
  store.memberConsents = [...store.memberConsents, record];
  return structuredClone(record);
}
