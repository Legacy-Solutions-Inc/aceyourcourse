import type { ExamDateSetBy } from "@/lib/member-app/exam-date";

// The Member seam's types (spec, Phase 3 → Phase 3 seams). A Member is a
// person with a Member App account (CONTEXT.md), keyed by their User.

/** The signed-in User, as sign-in verified them: the Member seam's caller. */
export interface MemberUser {
  /** The Supabase User's id. */
  userId: string;
  /** Their verified email. */
  email: string;
  /** Their Google profile name, when sign-in gave one. */
  name: string | null;
}

/** A Member's record, made the first time they pass the Member App gate. */
export interface Member {
  /** The Supabase User's id: a Member is keyed by their User. */
  userId: string;
  /** Their email when they joined, lowercased. */
  email: string;
  /** Their Google profile name when they joined, or null when sign-in gave none. */
  name: string | null;
  /** ISO time they first passed the gate. */
  joinedAt: string;
}

/** The Terms of Use and Privacy Policy versions in one agreement, such as "2.0". */
export interface AgreedVersions {
  termsVersion: string;
  privacyVersion: string;
}

/**
 * One time a Member agreed to the Terms of Use and the Privacy Policy, with
 * the versions they agreed to (spec, Phase 3 → Consent). Agreements are kept
 * as history: a new one is added each time, and none is ever changed.
 */
export interface ConsentRecord extends AgreedVersions {
  /** The Member's User id. */
  userId: string;
  /** ISO time they agreed. */
  agreedAt: string;
}

/** An Exam a Member can pick as a Target Exam: one that's on the Website. */
export interface PickableExam {
  /** Uppercase code, such as "CE". */
  code: string;
  /** Board acronym, such as "CELE". */
  board: string;
  name: string;
  /** The Exam's Official Exam Date (YYYY-MM-DD), which a new Target Exam follows. Null when Staff set none. */
  officialExamDate: string | null;
}

/**
 * One of a Member's Target Exams (CONTEXT.md): an Exam plus the Member's Exam
 * Date for it (spec, Phase 3 → Target Exams).
 */
export interface TargetExam {
  examCode: string;
  board: string;
  name: string;
  /**
   * The Exam Date (YYYY-MM-DD): the Member's own once they have set one, and
   * the Exam's Official Exam Date until then. Null when neither is set.
   */
  examDate: string | null;
  /** Whose date `examDate` is. Null when there is none. */
  dateSetBy: ExamDateSetBy | null;
  /** Whether this is the Member's selected Target Exam: exactly one is. */
  selected: boolean;
  /** ISO time the Member first added it. */
  addedAt: string;
}

/** What the onboarding and add forms send. */
export interface NewTargetExam {
  examCode: string;
  /** YYYY-MM-DD, or blank or null to follow the Exam's Official Exam Date. */
  examDate: string | null;
}

/** A Target Exam just added, or restored when the Member had removed it earlier. */
export interface AddedTargetExam {
  targetExam: TargetExam;
  /** It was removed earlier, and came back with its own date. */
  restored: boolean;
}

/** Why a Target Exam change was refused. */
export type TargetExamRefusal =
  /** No such Exam, or one that isn't on the Website. */
  | "not-an-exam"
  /** Already one of the Member's Target Exams. */
  | "already-yours"
  /** The Exam has no Official Exam Date, so the Member must give a date. */
  | "date-required"
  /** Not a date on the calendar. */
  | "invalid-date"
  /** Before today in Asia/Manila. */
  | "date-in-past"
  /** Not one of this Member's Target Exams. */
  | "not-yours"
  /** The Member's last Target Exam can't be removed. */
  | "last-one";

export type TargetExamResult<T> = { ok: true; value: T } | { ok: false; error: TargetExamRefusal };
