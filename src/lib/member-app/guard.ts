import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { currentLegalVersions } from "@/content/legal/documents";
import { getSignedInUser } from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
import type { LegalVersions } from "@/content/legal/types";
import { type ConsentStatus, consentStatus } from "@/lib/member-app/consent";
import { checkDevice, claimThisDevice } from "@/lib/member-app/device";
import { memberAppGate } from "@/lib/member-app/gate";
import { paths } from "@/paths";
import { getStaffByEmail } from "@/services/admin";
import { memberAppLive } from "@/services/catalogue.rules";
import { getOrCreateMember, isBetaTester, latestConsent, listTargetExams } from "@/services/member";
import type { Member, MemberUser, TargetExam } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Member App's server checks, in order: the gate (spec, Phase 3 → The
// beta gate), then consent (Phase 3 → Consent), then the Active Device
// (Phase 3 → Active Device; ADR 0011). Every Member App page and every Member
// App Server Action calls requireMember, which runs all three. Only the
// consent screen and its action call requireGatedMember, the gate alone; only
// the Active Device screen and its actions call requireConsentedMember, the
// gate and consent.
//
// The gate takes the signed-in User from src/lib/admin/identity.ts (the Admin
// and the Member App share one sign-in, and count how a session signed in
// alike: Google, or a password only where the password box is allowed; ticket
// 20), then reads the Member App switch, the staff list and the Beta Tester
// list on every call, so a removed tester or removed Staff User is refused on
// their next request. The pure rule is
// src/lib/member-app/gate.ts. Unlike the Staff Guard, it only reads the staff
// list: an unused Invite isn't activated here, and a refusal isn't recorded.
//
// Consent compares the Member's latest agreement with the current Terms and
// Privacy versions, read from the legal documents; the pure rule is
// src/lib/member-app/consent.ts. Authorisation never comes from the client.
//
// The Active Device compares this request's device token with the Member's
// Active Device (src/lib/member-app/device.ts): anything but a match goes to
// the Active Device screen. The Admin never runs this check.
//
// Past consent, a Member with no Target Exam yet is onboarding (Phase 3 →
// Target Exams): Home shows them the onboarding form, and every other screen
// in the shell calls requireMemberWithExam, which sends them there.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Closed mode (production with no database and no Supabase): answers 404, as
 * if the Member App didn't exist, the way the Admin does.
 */
export function requireMemberAppOpen(): void {
  if (adminMode === "closed") notFound();
}

/** What the gate answers this request. */
export type MemberAppAccess =
  | { status: "signed-out" }
  | { status: "not-open-yet"; user: MemberUser }
  | { status: "open"; user: MemberUser };

/**
 * The gate's answer for this request. Only reads: it makes no Member record,
 * so the sign-in and "Not open yet" screens can ask, never in place of
 * requireMember.
 */
export async function getMemberAppAccess(): Promise<MemberAppAccess> {
  requireMemberAppOpen();
  return readAccess();
}

/**
 * One read of the gate per request: the shell's layout and the page under it
 * both ask, and React's cache gives the second the first's answer. It holds
 * for that one request only, so the next request reads the lists again.
 */
const readAccess = cache(async (): Promise<MemberAppAccess> => {
  const user = await getSignedInUser();
  if (!user) return { status: "signed-out" };

  const [staff, betaTester] = await Promise.all([
    getStaffByEmail(user.email),
    isBetaTester(user.email),
  ]);
  const decision = memberAppGate({
    live: memberAppLive(),
    // getSignedInUser gives nobody for an email that isn't verified.
    emailVerified: true,
    activeStaff: staff !== null,
    betaTester,
  });
  return { status: decision, user };
});

/**
 * The gate alone, for the consent screen and its action: everywhere else
 * calls requireMember. Signed out, it redirects to the sign-in screen, coming
 * back to `from` afterwards. A User the gate doesn't let in yet goes to "Not
 * open yet", and gets no Member record. The first time someone passes, their
 * Member record is made, keyed by their User.
 */
export async function requireGatedMember(from: string = paths.memberApp.home): Promise<Member> {
  const access = await getMemberAppAccess();
  if (access.status === "signed-out") redirect(paths.memberApp.signIn(from));
  if (access.status === "not-open-yet") redirect(paths.memberApp.notOpenYet);
  return getOrCreateMember(access.user);
}

/** The consent check's answer for one Member, and the versions it checked against. */
export interface ConsentCheck {
  status: ConsentStatus;
  current: LegalVersions;
}

/**
 * Whether this Member has agreed to the current Terms and Privacy Policy,
 * read from their own latest agreement. Like the gate, it's read once per
 * request (the shell's layout and the page both ask) and fresh on the next.
 */
export const checkConsent = cache(async (userId: string): Promise<ConsentCheck> => {
  const current = currentLegalVersions();
  return { status: consentStatus(current, await latestConsent(userId)), current };
});

/**
 * The gate and consent, for the Active Device screen and its actions:
 * everywhere else calls requireMember. The gate goes first, exactly as
 * requireGatedMember. Then a Member who hasn't agreed to the current Terms and
 * Privacy Policy goes to the consent screen, coming back to `from` once they
 * agree.
 */
export async function requireConsentedMember(from: string = paths.memberApp.home): Promise<Member> {
  const member = await requireGatedMember(from);
  const { status } = await checkConsent(member.userId);
  if (status !== "ok") redirect(paths.memberApp.consent(from));
  return member;
}

/**
 * The signed-in Member, past the gate, consent and the Active Device: what
 * every Member App page and Member App Server Action calls first. The gate
 * and consent go first, exactly as requireConsentedMember. Then a request
 * that isn't from the Member's Active Device goes to the Active Device screen
 * ("Session ended" for a replaced device, "Use the Member App on this device"
 * for no token), coming back to `from` once this device is active. An action
 * refused this way has changed nothing.
 */
export async function requireMember(from: string = paths.memberApp.home): Promise<Member> {
  const member = await requireConsentedMember(from);
  if ((await checkDevice(member.userId)) !== "active") redirect(paths.memberApp.device(from));
  return member;
}

/**
 * The Member App sign-in's claim, once sign-in completes (the callback after
 * Google, the password box, or the sample "Sign in as"): when the gate lets
 * the signed-in User in, this device becomes their Active Device, replacing
 * any other, and the claim is logged. Their Member record is made here if this is their first
 * pass, as the gate's first pass would. Someone the gate turns away gets no
 * claim, no device token and no Member record. Consent is asked afterwards,
 * on the page they land on, like everything else.
 */
export async function claimDeviceAtSignIn(): Promise<void> {
  const access = await getMemberAppAccess();
  if (access.status !== "open") return;
  const member = await getOrCreateMember(access.user);
  await claimThisDevice(member.userId);
}

/**
 * This Member's Target Exams, read once per request like the gate (the
 * shell's layout and the page both ask) and fresh on the next.
 */
export const readTargetExams = cache((userId: string): Promise<TargetExam[]> =>
  listTargetExams(userId),
);

/** A Member past onboarding: they have Target Exams, one of them selected. */
export interface MemberWithExam {
  member: Member;
  /** In the order added. Never empty. */
  targetExams: TargetExam[];
  selected: TargetExam;
}

/**
 * The signed-in Member, past the gate, consent and onboarding: what every
 * Member App screen but Home calls first. requireMember goes first. Then a
 * Member with no Target Exam yet goes to Home, which shows the onboarding
 * form.
 */
export async function requireMemberWithExam(
  from: string = paths.memberApp.home,
): Promise<MemberWithExam> {
  const member = await requireMember(from);
  const targetExams = await readTargetExams(member.userId);
  const selected = targetExams.find((exam) => exam.selected);
  if (!selected) redirect(paths.memberApp.home);
  return { member, targetExams, selected };
}
