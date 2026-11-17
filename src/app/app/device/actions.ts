"use server";

import { redirect } from "next/navigation";

import { startGoogleSignIn } from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
import { googleProblem } from "@/lib/admin/sign-in-problem";
import { checkDevice, claimThisDevice } from "@/lib/member-app/device";
import { requireConsentedMember } from "@/lib/member-app/guard";
import { safeMemberAppNext } from "@/lib/member-app/safe-next";
import { paths } from "@/paths";

// The Active Device screen's actions (spec, Phase 3 → Active Device). Both
// run the gate and consent first, so someone the gate turns away, or a Member
// who hasn't agreed to the current Terms and Privacy Policy, claims nothing.
// Who claims comes from the session alone, never from the form; `next` is
// sanitised to a Member App path.

/**
 * "Use the Member App on this device" (story 133f): one tap claims this
 * device for a session with no device token, then goes on to `next`. A
 * replaced device can't claim this way: it goes back to "Session ended", to
 * sign in again. The Active Device already (a second click) just goes on.
 */
export async function confirmThisDevice(formData: FormData): Promise<void> {
  const next = safeMemberAppNext(formData.get("next"));
  const member = await requireConsentedMember(next);
  const status = await checkDevice(member.userId);
  if (status === "replaced") redirect(paths.memberApp.device(next));
  if (status === "no-token") await claimThisDevice(member.userId);
  redirect(next);
}

/**
 * "Sign in on this device" on "Session ended" (story 108). Live, it starts
 * Google sign-in, coming back through /auth/callback to `next`, which claims
 * this device; when Google sign-in can't start, the screen says why. With
 * sample data, "Sign in as" stands in for Google and the Member is already
 * signed in as themselves, so the sign-in completes at once and claims this
 * device, as the callback would.
 */
export async function signInOnThisDevice(formData: FormData): Promise<void> {
  const next = safeMemberAppNext(formData.get("next"));
  const member = await requireConsentedMember(next);
  if (adminMode === "live") {
    const start = await startGoogleSignIn(next, "member-app");
    redirect(start.ok ? start.url : paths.memberApp.device(next, googleProblem(start.reason)));
  }
  if ((await checkDevice(member.userId)) !== "active") await claimThisDevice(member.userId);
  redirect(next);
}
