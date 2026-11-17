import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { getSignedInUser } from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
import { memberAppGate } from "@/lib/member-app/gate";
import { paths } from "@/paths";
import { getStaffByEmail } from "@/services/admin";
import { memberAppLive } from "@/services/catalogue.rules";
import { getOrCreateMember, isBetaTester } from "@/services/member";
import type { Member, MemberUser } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Member App gate on the server (spec, Phase 3 → The beta gate). Every
// Member App page and every Member App Server Action calls requireMember. It
// takes the signed-in User from src/lib/admin/identity.ts (the Admin and the
// Member App share one sign-in), then reads the Member App switch, the staff
// list and the Beta Tester list on every call, so a removed tester or removed
// Staff User is refused on their next request. The pure rule is
// src/lib/member-app/gate.ts. Authorisation never comes from the client.
//
// Unlike the Staff Guard, it only reads the staff list: an unused Invite isn't
// activated here, and a refusal isn't recorded. Later tickets add consent and
// the Active Device behind it.
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
 * The signed-in Member. Signed out, it redirects to the sign-in screen, coming
 * back to `from` afterwards. A User the gate doesn't let in yet goes to "Not
 * open yet", and gets no Member record. The first time someone passes, their
 * Member record is made, keyed by their User.
 */
export async function requireMember(from: string = paths.memberApp.home): Promise<Member> {
  const access = await getMemberAppAccess();
  if (access.status === "signed-out") redirect(paths.memberApp.signIn(from));
  if (access.status === "not-open-yet") redirect(paths.memberApp.notOpenYet);
  return getOrCreateMember(access.user);
}
