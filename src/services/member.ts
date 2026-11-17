import { isDatabaseConfigured } from "@/env.server";
import { databaseArm } from "@/services/member.db";
import * as mockImpl from "@/services/member.mock";
import type { AgreedVersions, ConsentRecord, Member, MemberUser } from "@/services/member.types";

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
// records. Later tickets add Target Exams, the Active Device and the study
// records.
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
}

const impl: MemberService = isDatabaseConfigured ? databaseArm : mockImpl;

export const isBetaTester = impl.isBetaTester;
export const getOrCreateMember = impl.getOrCreateMember;
export const latestConsent = impl.latestConsent;
export const recordConsent = impl.recordConsent;
