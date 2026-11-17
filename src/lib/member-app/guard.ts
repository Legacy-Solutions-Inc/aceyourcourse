import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { currentLegalVersions } from "@/content/legal/documents";
import { getSignedInUser } from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
import type { LegalVersions } from "@/content/legal/types";
import { type ConsentStatus, consentStatus } from "@/lib/member-app/consent";
import { memberAppGate } from "@/lib/member-app/gate";
import { paths } from "@/paths";
import { getStaffByEmail } from "@/services/admin";
import { memberAppLive } from "@/services/catalogue.rules";
import { getOrCreateMember, isBetaTester, latestConsent } from "@/services/member";
import type { Member, MemberUser } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Member App's server checks, in order: the gate (spec, Phase 3 → The
// beta gate), then consent (Phase 3 → Consent). Every Member App page and
// every Member App Server Action calls requireMember, which runs both; only
// the consent screen and its action call requireGatedMember, the gate alone.
//
// The gate takes the signed-in User from src/lib/admin/identity.ts (the Admin
// and the Member App share one sign-in), then reads the Member App switch, the
// staff list and the Beta Tester list on every call, so a removed tester or
// removed Staff User is refused on their next request. The pure rule is
// src/lib/member-app/gate.ts. Unlike the Staff Guard, it only reads the staff
// list: an unused Invite isn't activated here, and a refusal isn't recorded.
//
// Consent compares the Member's latest agreement with the current Terms and
// Privacy versions, read from the legal documents; the pure rule is
// src/lib/member-app/consent.ts. Authorisation never comes from the client.
// A later ticket adds the Active Device behind consent.
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
 * The signed-in Member, past the gate and consent: what every Member App page
 * and Member App Server Action calls first. The gate goes first, exactly as
 * requireGatedMember. Then a Member who hasn't agreed to the current Terms and
 * Privacy Policy goes to the consent screen, coming back to `from` once they
 * agree.
 */
export async function requireMember(from: string = paths.memberApp.home): Promise<Member> {
  const member = await requireGatedMember(from);
  const { status } = await checkConsent(member.userId);
  if (status !== "ok") redirect(paths.memberApp.consent(from));
  return member;
}
