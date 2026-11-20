/** What the Member App gate answers a signed-in User. */
export type GateDecision = "open" | "not-open-yet";

export interface GateInputs {
  /** The Member App switch (MEMBER_APP_LIVE). */
  live: boolean;
  /** Whether Google (or Supabase) verified the User's email. */
  emailVerified: boolean;
  /** Whether that email is an active Staff User's: not removed, and not an Invite still unused. */
  activeStaff: boolean;
  /** Whether that email is on the Beta Tester list now. */
  betaTester: boolean;
}

/**
 * Pure: the Member App gate (spec, Phase 3 → The beta gate). Once the switch
 * is on, anyone gets in. While it's off, only active Staff and Beta Testers
 * do; everyone else is signed in but told it isn't open yet. Both lists match
 * by email, so an email nobody verified never gets in.
 */
export function memberAppGate({
  live,
  emailVerified,
  activeStaff,
  betaTester,
}: GateInputs): GateDecision {
  if (!emailVerified) return "not-open-yet";
  return live || activeStaff || betaTester ? "open" : "not-open-yet";
}
