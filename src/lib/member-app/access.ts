import { formatDate, manilaDate } from "@/lib/manila-time";
import type { DeviceStatus } from "@/lib/member-app/device-token";
import type { GateDecision } from "@/lib/member-app/gate";

// ─────────────────────────────────────────────────────────────────────────────
// The access decision (spec, Phase 3 → Access decision seam, amended on
// 2026-11-28; ADR 0010 with its 2026-11-17 amendment, and ADR 0011): whether
// a Member may open one deck, quiz, Reviewer PDF or Lesson, and if not, what
// they see instead. This module is the pure rule.
// src/lib/member-app/access-check.ts gathers its inputs on the server for the
// signed-in Member, and every protected read goes through it.
//
// The rule checks, in order:
//   1. the gate: "not-open-yet" while the Member App doesn't let them in,
//   2. the Active Device: "no-token" or "device-replaced",
//   3. the content: "unavailable" while it's Hidden or not Published; a
//      Lesson's Course Hidden too, except to the Members who own it,
//   4. "allowed" for active Staff, a pass for the content's Exam that ends
//      later than now (never for a separately sold Course), Course
//      Ownership, or Free Preview,
//   5. otherwise "expired" when they hold a pass for that Exam (a separately
//      sold Course never: a pass doesn't open it), or "locked".
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Why the decision allowed it. When several hold, Staff reads first, then the
 * pass, then Course Ownership.
 */
export type AllowedVia = "staff" | "pass" | "ownership" | "free-preview";

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

/**
 * What the decision needs to know about a Lesson's Course (Phase 5), for the
 * Member asking: the Course's facts, and whether they own it.
 */
export interface AccessCourse {
  /** Visible on the Courses screen. A Hidden one stays open to its owners only. */
  visible: boolean;
  /** Sold separately: only Course Ownership opens it, never an Access Pass. */
  soldSeparately: boolean;
  /** The Member holds Course Ownership of it, which never expires. */
  owned: boolean;
}

/** What the decision needs to know about the content. */
export interface AccessContent {
  /** The Exam it belongs to, through its Topic and Subject, or a Lesson's through its Course. */
  examCode: string;
  /** A Visible deck or quiz, or a Published Reviewer PDF or Lesson. */
  available: boolean;
  freePreview: boolean;
  /** A Lesson's Course; none for a deck, quiz or Reviewer PDF. */
  course?: AccessCourse;
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

/**
 * The signed-in Member's side of the access decision: everything but the
 * content. The server gathers it for each request (access-check.ts); the
 * Member seam's study reads and writes take it, and decide each deck with it.
 */
export type MemberAccess = Omit<AccessInputs, "content">;

/** A decision that refuses. */
export type RefusedDecision = Exclude<AccessDecision, { outcome: "allowed" }>;

/**
 * A refusal the Member App shows in place of the content: locked, expired, or
 * no longer available. The gate's and the Active Device's have screens of their own.
 */
export type ShownRefusal = Extract<
  AccessDecision,
  { outcome: "locked" } | { outcome: "expired" } | { outcome: "unavailable" }
>;

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
  const { course } = content;
  if (!content.available) return { outcome: "unavailable" };
  // A Hidden Course is gone for everyone but its owners, Staff included.
  if (course && !course.visible && !course.owned) return { outcome: "unavailable" };
  if (activeStaff) return { outcome: "allowed", via: "staff" };

  // A separately sold Course: an Access Pass never opens it, nor says it ended.
  const exam = content.examCode.toUpperCase();
  const pass = course?.soldSeparately
    ? undefined
    : passes.find((candidate) => candidate.examCode.toUpperCase() === exam);
  if (pass && isPassActive(pass.endsAt, now)) return { outcome: "allowed", via: "pass" };
  if (course?.owned) return { outcome: "allowed", via: "ownership" };
  if (content.freePreview) return { outcome: "allowed", via: "free-preview" };
  return pass ? { outcome: "expired", passEndedAt: pass.endsAt } : { outcome: "locked" };
}

/** Pure: whether a pass ending at `endsAt` is active at `now`: its end is later. The instant it ends, it has ended. */
export const isPassActive = (endsAt: string, now: Date): boolean =>
  new Date(endsAt).getTime() > now.getTime();

/**
 * Pure: the day a pass ends, as people read it: its calendar date in Manila,
 * such as "17 Nov 2026". Throws a RangeError for a time that isn't one.
 */
export function passEndDate(endsAt: string): string {
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) throw new RangeError(`Expected an ISO time, got "${endsAt}"`);
  return formatDate(manilaDate(end));
}
