import { isDatabaseConfigured } from "@/env.server";
import type { DeviceStatus } from "@/lib/member-app/device-token";
import { databaseArm } from "@/services/member.db";
import * as mockImpl from "@/services/member.mock";
import type {
  ActiveDevice,
  AddedTargetExam,
  AgreedVersions,
  ConsentRecord,
  DeviceClaim,
  DeviceSwitch,
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
// records. Later tickets add the study records.
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

  // The Active Device (spec, Phase 3 → Active Device; ADR 0011). Each call is
  // scoped to the User id given. The seam only ever receives a token's hash:
  // the caller hashes the device's token (src/lib/member-app/device-token.ts),
  // so the token itself is never stored or logged, and no read gives the hash
  // back. The Admin never calls these.

  /**
   * Makes the device holding this token hash the Member's Active Device,
   * replacing the one before, and adds the claim to their switch log, timed
   * now. Every claim is logged, the first one too. Refuses anything but a
   * SHA-256 hash (a raw token above all), a blank or overlong label, and a
   * User with no Member record.
   */
  claimDevice(userId: string, claim: DeviceClaim): Promise<ActiveDevice>;
  /**
   * Is this request from the Member's Active Device? "no-token" when the
   * request carries no token; "active" when its hash matches the Member's
   * Active Device, compared in constant time; "replaced" for any other value,
   * including one Member's token sent for another and a Member with no Active
   * Device yet. Never "active" for a tampered or unknown token.
   */
  deviceStatus(userId: string, tokenHash: string | null): Promise<DeviceStatus>;
  /** The Member's Active Device's label and claim time, or null before their first claim. */
  getActiveDevice(userId: string): Promise<ActiveDevice | null>;
  /** The Member's switch log, oldest first: every claim, the first one too. */
  listDeviceSwitches(userId: string): Promise<DeviceSwitch[]>;
  /** How many claims the Member's switch log holds. */
  deviceSwitchCount(userId: string): Promise<number>;
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
export const claimDevice = impl.claimDevice;
export const deviceStatus = impl.deviceStatus;
export const getActiveDevice = impl.getActiveDevice;
export const listDeviceSwitches = impl.listDeviceSwitches;
export const deviceSwitchCount = impl.deviceSwitchCount;
