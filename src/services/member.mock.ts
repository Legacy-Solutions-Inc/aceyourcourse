import {
  agreedVersionsSchema,
  memberEmailSchema,
  memberUserIdSchema,
  memberUserSchema,
} from "@/services/member.schema";
import {
  applyChange,
  examsForMembers,
  pickableExams,
  targetExamOperations,
  targetExams,
  type MemberExams,
  type WithMemberExams,
} from "@/services/member.rules";
import type {
  AgreedVersions,
  ConsentRecord,
  Member,
  MemberUser,
  PickableExam,
  TargetExam,
} from "@/services/member.types";
import { getSampleStore } from "@/services/mock/sample-store";

// The Member seam's sample arm: over the in-memory sample store
// (src/services/mock/sample-store.ts), which holds the Beta Tester list the
// Admin's sample arm edits, the Members, their consent records and their
// Target Exams. The Target Exam rules are shared with the database arm
// (member.rules.ts).

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

/**
 * One Member's Target Exams as the store holds them now, with the catalogue's
 * Exams. Like the database's cascade, a record whose Exam an Owner deleted is
 * gone for good: it doesn't come back if an Exam with that code is added.
 */
function memberExams(userId: string): MemberExams {
  const store = getSampleStore();
  const exams = examsForMembers(store.catalogue);
  const exists = (code: string) => exams.some((exam) => exam.code === code);
  const records = (store.memberTargetExams[userId] ?? []).filter((r) => exists(r.examCode));
  if (store.memberTargetExams[userId]) store.memberTargetExams[userId] = records;
  const selected = store.selectedExams[userId] ?? null;
  if (selected !== null && !exists(selected)) store.selectedExams[userId] = null;
  return structuredClone({
    records,
    selectedExamCode: store.selectedExams[userId] ?? null,
    exams,
  });
}

export async function listPickableExams(): Promise<PickableExam[]> {
  return pickableExams(examsForMembers(structuredClone(getSampleStore().catalogue)));
}

export async function listTargetExams(userId: string): Promise<TargetExam[]> {
  return targetExams(memberExams(memberUserIdSchema.parse(userId)));
}

const withMemberExams: WithMemberExams = async (userId, work) => {
  const store = getSampleStore();
  // Like the database's foreign key: only a Member, someone the gate let in, has Target Exams.
  if (!store.members.some((member) => member.userId === userId)) {
    throw new Error("Only a Member has Target Exams.");
  }
  const state = memberExams(userId);
  const { change, result } = work(state);
  if (change) {
    const after = applyChange(state, change);
    store.memberTargetExams[userId] = after.records;
    store.selectedExams[userId] = after.selectedExamCode;
  }
  return result;
};

export const { addTargetExam, setExamDate, selectTargetExam, removeTargetExam } =
  targetExamOperations(withMemberExams);
