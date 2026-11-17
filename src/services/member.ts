import { isDatabaseConfigured } from "@/env.server";
import { databaseArm } from "@/services/member.db";
import * as mockImpl from "@/services/member.mock";
import type {
  AddedTargetExam,
  AgreedVersions,
  ConsentRecord,
  Member,
  MemberUser,
  NewTargetExam,
  PickableExam,
  TargetExam,
  TargetExamResult,
} from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// Member Service Seam (spec, Phase 3 → Phase 3 seams). Everything the Member
// App reads and writes for the signed-in Member goes through here: Member App
// pages and Server Actions never touch the sample store or the database. Like
// src/services/admin.ts, this module is a thin SELECTOR: the database arm
// (member.db.ts) when DATABASE_URL is set, the sample arm otherwise, behind
// the same contract. Reads are always fresh and never cached.
//
// The seam trusts its caller for who is signed in: the Member App gate
// (src/lib/member-app/guard.ts) passes the User that sign-in verified, never
// anything the browser sent. Each read and write is scoped to that User's own
// records. Later tickets add the Active Device and the study records.
// ─────────────────────────────────────────────────────────────────────────────

/** The seam's public contract, checked against each arm below. */
export interface MemberService {
  /**
   * The Member App gate's read: whether this email is on the Beta Tester list
   * now (case-insensitive). A removed tester, or a malformed email, isn't.
   * The caller passes only an email that sign-in verified.
   */
  isBetaTester(email: string): Promise<boolean>;
  /**
   * The Member record of a User who passed the gate, made on their first
   * pass with their name and email from Google, lowercased. Later calls give
   * the same record unchanged. Throws for a User id or email that isn't one.
   */
  getOrCreateMember(user: MemberUser): Promise<Member>;
  /**
   * The consent check's read: this Member's latest agreement to the Terms
   * and Privacy Policy, or null when they have never agreed. Only ever their
   * own. Throws for a User id that isn't one.
   */
  latestConsent(userId: string): Promise<ConsentRecord | null>;
  /**
   * Adds an agreement to this Member's consent history, timed now. Earlier
   * agreements are kept unchanged. The caller checks the versions are the
   * current ones; the seam refuses versions that aren't versions, and a User
   * with no Member record (someone the gate never let in).
   */
  recordConsent(userId: string, versions: AgreedVersions): Promise<ConsentRecord>;

  // Target Exams (spec, Phase 3 → Target Exams). Each call is scoped to the
  // User id given: a Member only ever reads or changes their own. The changes
  // answer a refusal for what a Member could send (a wrong Exam or date), and
  // throw for a User id that isn't one or has no Member record.

  /**
   * The Exams a Member can pick: those on the Website, in the catalogue's
   * order, each with its Official Exam Date. Read fresh, like everything here.
   */
  listPickableExams(): Promise<PickableExam[]>;
  /**
   * This Member's Target Exams, in the order added, without the ones they
   * removed. Each Exam Date is the Member's own once they have set one, and
   * the Exam's Official Exam Date as it is now until then. Exactly one is
   * selected: the one they last selected, or the first when that's gone.
   */
  listTargetExams(userId: string): Promise<TargetExam[]>;
  /**
   * Adds an Exam on the Website to this Member's Target Exams, and selects
   * it. A date equal to the Official Exam Date, or none, follows the Official
   * Exam Date; any other is the Member's own, and must not have passed. An
   * Exam with no Official Exam Date needs one. An Exam the Member removed
   * earlier is restored, with the date it had. Refused for one that's already
   * theirs.
   */
  addTargetExam(userId: string, input: NewTargetExam): Promise<TargetExamResult<AddedTargetExam>>;
  /** Sets this Member's own Exam Date for one of their Target Exams: a real date that hasn't passed. */
  setExamDate(
    userId: string,
    examCode: string,
    examDate: string,
  ): Promise<TargetExamResult<TargetExam>>;
  /** Makes one of this Member's Target Exams the selected one, remembered until they switch again. */
  selectTargetExam(userId: string, examCode: string): Promise<TargetExamResult<TargetExam>>;
  /**
   * Removes one of this Member's Target Exams, keeping its record so adding
   * it back restores it. Refused for their last one. When the selected one is
   * removed, the selection falls back to the first one remaining.
   */
  removeTargetExam(userId: string, examCode: string): Promise<TargetExamResult<TargetExam>>;
}

const impl: MemberService = isDatabaseConfigured ? databaseArm : mockImpl;

export const isBetaTester = impl.isBetaTester;
export const getOrCreateMember = impl.getOrCreateMember;
export const latestConsent = impl.latestConsent;
export const recordConsent = impl.recordConsent;
export const listPickableExams = impl.listPickableExams;
export const listTargetExams = impl.listTargetExams;
export const addTargetExam = impl.addTargetExam;
export const setExamDate = impl.setExamDate;
export const selectTargetExam = impl.selectTargetExam;
export const removeTargetExam = impl.removeTargetExam;
