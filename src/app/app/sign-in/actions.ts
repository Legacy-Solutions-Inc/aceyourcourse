"use server";

import { notFound, redirect } from "next/navigation";

import type { SignInAsState } from "@/app/admin/sign-in/actions";
import {
  endSession,
  getSignInAttempt,
  passwordSignInAllowed,
  startGoogleSignIn,
  startSampleSession,
} from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
import {
  type PasswordSignInState,
  passwordRefused,
  submitPasswordSignIn,
} from "@/lib/admin/password-sign-in";
import { googleProblem } from "@/lib/admin/sign-in-problem";
import { claimDeviceAtSignIn } from "@/lib/member-app/guard";
import { safeMemberAppNext } from "@/lib/member-app/safe-next";
import { paths } from "@/paths";
import { signInAsSchema } from "@/services/admin.schema";

// The Member App's sign-in actions. None needs the gate: anyone may sign in,
// and the gate on the page they land on decides what happens next (in, or
// "Not open yet"). Sign-in that completes makes this device the Member's
// Active Device, for someone the gate lets in (claimDeviceAtSignIn): here for
// "Sign in as" and the password box, and in /auth/callback for Google.

/**
 * The development-only "Sign in as" (sample mode only; any other mode answers
 * 404): signs in as a sample Member, or any email, then goes on to `next`,
 * sanitised to a Member App path. It stands in for Google, so it claims this
 * device the way the callback does: for someone the gate lets in, this device
 * becomes their Active Device, and any other is replaced.
 */
export async function signInAs(
  _previous: SignInAsState,
  formData: FormData,
): Promise<SignInAsState> {
  if (adminMode !== "sample") notFound();

  const typed = formData.get("email");
  const parsed = signInAsSchema.safeParse({ email: typed ?? undefined });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Enter an email address.",
      email: typeof typed === "string" ? typed : "",
    };
  }

  await startSampleSession(parsed.data.email);
  await claimDeviceAtSignIn();
  redirect(safeMemberAppNext(formData.get("next")));
}

/**
 * Live mode's "Continue with Google": sends the browser to Google, coming back
 * through /auth/callback to `next`, sanitised to a Member App path. When
 * Google sign-in isn't set up on this Supabase, or it doesn't answer, the
 * sign-in screen says so instead. Any other mode answers 404.
 */
export async function continueWithGoogle(formData: FormData): Promise<void> {
  if (adminMode !== "live") notFound();
  const next = safeMemberAppNext(formData.get("next"));
  const start = await startGoogleSignIn(next, "member-app");
  redirect(start.ok ? start.url : paths.memberApp.signIn(next, googleProblem(start.reason)));
}

/**
 * The password box (ticket 20, temporary, like the Admin's: removed once the
 * deployed site is tested). Only where the Admin's box is allowed
 * (passwordSignInAllowed); anywhere else it answers 404, whatever is posted. It signs in to Supabase with the email and
 * password, then goes on as /auth/callback does after Google: for someone
 * the gate lets in, this device becomes their Active Device; then to `next`,
 * sanitised to a Member App path, whose gate sends anyone else to "Not open
 * yet". An unconfirmed email, or a session the Member App doesn't count, is
 * refused and its session ended. It never makes a User.
 */
export async function signInWithPassword(
  _previous: PasswordSignInState,
  formData: FormData,
): Promise<PasswordSignInState> {
  if (!passwordSignInAllowed()) notFound();

  const submitted = await submitPasswordSignIn(formData);
  if (!submitted.ok) return submitted.state;

  const attempt = await getSignInAttempt();
  if (attempt.status !== "verified") {
    // It matches no list, or doesn't count here: don't leave it in the cookies.
    await endSession();
    return passwordRefused(
      submitted.email,
      attempt.status === "unverified" ? "unconfirmed" : "failed",
    );
  }

  await claimDeviceAtSignIn();
  redirect(safeMemberAppNext(formData.get("next")));
}
