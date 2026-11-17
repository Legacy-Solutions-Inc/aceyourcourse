import { formatDate, manilaDate } from "@/lib/manila-time";
import type { DeviceStatus } from "@/lib/member-app/device-token";
import type { GateDecision } from "@/lib/member-app/gate";

// ─────────────────────────────────────────────────────────────────────────────
// The access decision (spec, Phase 3 → Access decision seam; ADR 0010 with
// its 2026-11-17 amendment, and ADR 0011): whether a Member may open one deck,
// quiz or Reviewer PDF, and if not, what they see instead. This module is the
// pure rule. src/lib/member-app/access-check.ts gathers its inputs on the
// server for the signed-in Member, and every protected read goes through it.
//
// The rule checks, in order:
//   1. the gate: "not-open-yet" while the Member App doesn't let them in,
//   2. the Active Device: "no-token" or "device-replaced",
//   3. the content: "unavailable" while it's Hidden or not Published,
//   4. "allowed" for Free Preview, active Staff, or a pass for the content's
//      Exam that ends later than now,
//   5. otherwise "expired" when they hold a pass for that Exam, or "locked".
// ─────────────────────────────────────────────────────────────────────────────

/** Why the decision allowed it. When several hold, Staff reads first, then the pass. */
export type AllowedVia = "staff" | "pass" | "free-preview";

export type AccessDecision =
  | { outcome: "allowed"; via: AllowedVia }
  /** They hold a pass for the content's Exam, and it has ended: renew, progress kept. */
  | { outcome: "expired"; passEndedAt: string }
  /** No pass for the content's Exam: the unlock prompt. */
  | { outcome: "locked" }
  /** Another device is the Member's Active Device: "Session ended". */
  | { outcome: "device-replaced" }
  /** This request carries no device token: "Use the Member App on this device". */
  | { outcome: "no-token" }
  /** Hidden, or not Published: "no longer available", progress kept. */
  | { outcome: "unavailable" }
  /** The beta gate doesn't let them in. */
  | { outcome: "not-open-yet" };

export type AccessOutcome = AccessDecision["outcome"];

/** What the decision needs to know about the content. */
export interface AccessContent {
  /** The Exam it belongs to, through its Topic and Subject. */
  examCode: string;
  /** A Visible deck or quiz, or a Published Reviewer PDF. */
  available: boolean;
  freePreview: boolean;
}

/** One of the Member's Access Passes: its Exam, and when it ends (ISO). */
export interface AccessPassEnd {
  examCode: string;
  endsAt: string;
}

export interface AccessInputs {
  /** The beta gate's answer for this Member. */
  gate: GateDecision;
  /** Whether this request is from the Member's Active Device. */
  device: DeviceStatus;
  content: AccessContent;
  /** On the staff list now, and active: a removed Staff User is a Member like any other. */
  activeStaff: boolean;
  /** The Member's Access Passes, at most one per Exam. */
  passes: readonly AccessPassEnd[];
  now: Date;
}

/** Pure: the access decision for one Member and one piece of content (see the order above). */
export function accessDecision({
  gate,
  device,
  content,
  activeStaff,
  passes,
  now,
}: AccessInputs): AccessDecision {
  if (gate !== "open") return { outcome: "not-open-yet" };
  if (device === "no-token") return { outcome: "no-token" };
  if (device !== "active") return { outcome: "device-replaced" };
  if (!content.available) return { outcome: "unavailable" };

  const exam = content.examCode.toUpperCase();
  const pass = passes.find((candidate) => candidate.examCode.toUpperCase() === exam);
  // End later than now: the instant it ends, it has ended.
  const passActive = pass !== undefined && new Date(pass.endsAt).getTime() > now.getTime();

  if (activeStaff) return { outcome: "allowed", via: "staff" };
  if (passActive) return { outcome: "allowed", via: "pass" };
  if (content.freePreview) return { outcome: "allowed", via: "free-preview" };
  return pass ? { outcome: "expired", passEndedAt: pass.endsAt } : { outcome: "locked" };
}

/**
 * Pure: the day a pass ends, as people read it: its calendar date in Manila,
 * such as "17 Nov 2026". Throws a RangeError for a time that isn't one.
 */
export function passEndDate(endsAt: string): string {
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) throw new RangeError(`Expected an ISO time, got "${endsAt}"`);
  return formatDate(manilaDate(end));
}
