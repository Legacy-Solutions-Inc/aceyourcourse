"use server";

import { notFound, redirect } from "next/navigation";

import { continueSignIn, signIn } from "@/lib/admin/guard";
import {
  endSession,
  googleSignInDestination,
  passwordSignInAllowed,
  startSampleSession,
} from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
import {
  type PasswordSignInState,
  passwordRefused,
  submitPasswordSignIn,
} from "@/lib/admin/password-sign-in";
import { safeAdminNext } from "@/lib/admin/safe-next";
import { signInAsSchema } from "@/services/admin.schema";

export interface SignInAsState {
  error: string | null;
  /** What was typed, so the field keeps it after an error. */
  email: string;
}

/**
 * The development-only "Sign in as" (sample mode only; any other mode answers
 * 404). Anyone may sign in, so no Staff Role is required here: the Staff
 * Guard's signIn decides what happens next, exactly as it will after Google
 * sign-in. Staff go to `next`; anyone else is recorded and goes to the 403
 * screen.
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

  await signIn(await startSampleSession(parsed.data.email));
  redirect(safeAdminNext(formData.get("next")));
}

/**
 * Live mode's "Continue with Google": sends the browser to Google, coming back
 * through /auth/callback to `next`. When Google sign-in isn't set up on this
 * Supabase, or it doesn't answer, the sign-in screen says so instead. Any other
 * mode answers 404.
 */
export async function continueWithGoogle(formData: FormData): Promise<void> {
  if (adminMode !== "live") notFound();
  redirect(await googleSignInDestination(formData.get("next")));
}

/**
 * The password box (ticket 19): in live mode under `pnpm dev`, or with
 * ADMIN_PASSWORD_SIGN_IN "true" (ticket 24, temporary); anywhere else it
 * answers 404, whatever is posted. It signs in to
 * Supabase with the email and password, then through the Staff Guard exactly
 * as /auth/callback does after Google: Staff go to `next`; anyone else is
 * recorded and goes to the 403 screen. It never makes a User.
 */
export async function signInWithPassword(
  _previous: PasswordSignInState,
  formData: FormData,
): Promise<PasswordSignInState> {
  if (!passwordSignInAllowed()) notFound();

  const submitted = await submitPasswordSignIn(formData);
  if (!submitted.ok) return submitted.state;

  const step = await continueSignIn();
  if (step.status === "unverified") return passwordRefused(submitted.email, "unconfirmed");
  if (step.status === "signed-out") {
    // A session the Guard doesn't count: don't leave it in the cookies.
    await endSession();
    return passwordRefused(submitted.email, "failed");
  }
  redirect(safeAdminNext(formData.get("next")));
}
