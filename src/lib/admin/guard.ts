import "server-only";

import { notFound, redirect } from "next/navigation";

import { endSession, getIdentity, getSignInAttempt } from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
import { paths } from "@/paths";
import {
  getLatestDeniedSignIn,
  getStaffByEmail,
  recordDeniedSignIn,
  recordSignIn,
  resolveSignIn,
} from "@/services/admin";
import type { DeniedReason, SignInIdentity, StaffActor } from "@/services/admin.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Staff Guard (CONVENTIONS §3). Every Admin page and every Admin Server
// Action calls it. It takes the signed-in User from src/lib/admin/identity.ts
// and asks the staff list through the Admin seam on every call, so a removed
// or demoted Staff User loses that access on their next request. Authorisation
// never comes from the client.
// ─────────────────────────────────────────────────────────────────────────────

/** Closed mode: answers 404, as if the Admin didn't exist. */
export function requireAdminOpen(): void {
  if (adminMode === "closed") notFound();
}

/**
 * Lets a signed-in User into the Admin, or refuses them. The staff list
 * decides (an unexpired Invite activates on the way in). A refusal is
 * recorded and goes to the 403 screen, saying why.
 */
export async function admit(identity: SignInIdentity): Promise<StaffActor> {
  const now = new Date();
  const result = await resolveSignIn(identity, now);
  if (result.status === "staff") return result.actor;
  await recordDeniedSignIn({ email: identity.email, reason: result.reason, at: now });
  redirect(paths.admin.denied(result.reason));
}

/**
 * A sign-in: admit, then record its time on the Staff User's row, for "LAST
 * SIGNED IN …". Only signing in records it, not each request after.
 */
export async function signIn(identity: SignInIdentity): Promise<StaffActor> {
  const actor = await admit(identity);
  await recordSignIn(actor.email, new Date(), identity.name);
  return actor;
}

/** Where a sign-in back from Google goes: on as Staff, or back to sign-in. */
export type SignInStep =
  { status: "staff"; actor: StaffActor } | { status: "signed-out" } | { status: "unverified" };

/**
 * Live mode's sign-in, back from Google: /auth/callback calls it once the code
 * is exchanged. A verified email signs in (see signIn: Staff go on, and anyone
 * else is recorded and refused). An email Google didn't verify is recorded as
 * not Staff, once, and its session ends, so the sign-in screen can say why
 * and offer Google again.
 */
export async function continueSignIn(): Promise<SignInStep> {
  requireAdminOpen();
  const attempt = await getSignInAttempt();
  if (attempt.status === "signed-out") return attempt;
  if (attempt.status === "unverified") {
    await recordDeniedSignIn({ email: attempt.email, reason: "not-staff", at: new Date() });
    await endSession();
    return { status: "unverified" };
  }
  return { status: "staff", actor: await signIn(attempt.identity) };
}

/**
 * The signed-in Staff User, or null when signed out or not Staff. Only reads:
 * for the shell and the sign-in screen, never in place of requireStaff.
 */
export async function getStaff(): Promise<StaffActor | null> {
  requireAdminOpen();
  const identity = await getIdentity();
  return identity ? getStaffByEmail(identity.email) : null;
}

/**
 * The signed-in Staff User. Signed out, it redirects to sign-in, coming back to
 * `from` afterwards; a User who isn't Staff is refused (see admit).
 */
export async function requireStaff(from: string = paths.admin.overview): Promise<StaffActor> {
  requireAdminOpen();
  const identity = await getIdentity();
  if (!identity) redirect(paths.admin.signIn(from));
  return admit(identity);
}

/** Like requireStaff, but an Editor goes to the owners-only 403 screen. */
export async function requireOwner(from?: string): Promise<StaffActor> {
  const actor = await requireStaff(from);
  if (actor.role !== "owner") redirect(paths.admin.denied("owners-only"));
  return actor;
}

export type DeniedScreen =
  | { reason: "owners-only"; actor: StaffActor }
  | { reason: DeniedReason; email: string; loggedAt: string | null };

/**
 * What the 403 screen says to the signed-in User. The staff list gives the
 * reason; the address only asks for "owners only", which applies to Editors.
 * Staff who may use the Admin go back to the Overview. `loggedAt` is the
 * User's latest recorded refusal. Showing the screen records nothing.
 */
export async function getDeniedScreen(reason: unknown): Promise<DeniedScreen> {
  requireAdminOpen();
  const identity = await getIdentity();
  if (!identity) redirect(paths.admin.signIn());

  const result = await resolveSignIn(identity, new Date());
  if (result.status === "staff") {
    if (reason === "owners-only" && result.actor.role === "editor") {
      return { reason, actor: result.actor };
    }
    redirect(paths.admin.overview);
  }

  const latest = await getLatestDeniedSignIn(identity.email);
  return { reason: result.reason, email: identity.email, loggedAt: latest?.at ?? null };
}
