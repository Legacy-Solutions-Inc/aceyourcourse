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
