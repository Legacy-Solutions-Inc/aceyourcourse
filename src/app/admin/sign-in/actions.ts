"use server";

import { notFound, redirect } from "next/navigation";

import { continueSignIn, signIn } from "@/lib/admin/guard";
import {
  endSession,
  googleSignInDestination,
  passwordSignInAllowed,
  startPasswordSession,
  startSampleSession,
} from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
import { safeAdminNext } from "@/lib/admin/safe-next";
import { PASSWORD_PROBLEMS } from "@/lib/admin/sign-in-problem";
import { fieldErrorsOf, passwordSignInSchema, signInAsSchema } from "@/services/admin.schema";

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

export interface PasswordSignInState {
  /** Why the sign-in didn't go on, for the whole form. */
  error: string | null;
  /** A message next to an empty or malformed field. */
  fieldErrors: { email?: string; password?: string };
  /** What was typed, so the field keeps it after an error. The password is never sent back. */
  email: string;
}

/**
 * The "Development only" password box (ticket 19): under `pnpm dev` in live
 * mode only; anywhere else it answers 404, whatever is posted. It signs in to
 * Supabase with the email and password, then through the Staff Guard exactly
 * as /auth/callback does after Google: Staff go to `next`; anyone else is
 * recorded and goes to the 403 screen. It never makes a User.
 */
export async function signInWithPassword(
  _previous: PasswordSignInState,
  formData: FormData,
): Promise<PasswordSignInState> {
  if (!passwordSignInAllowed()) notFound();

  const typed = formData.get("email");
  const email = typeof typed === "string" ? typed : "";
  const refused = (error: string): PasswordSignInState => ({ error, fieldErrors: {}, email });

  const parsed = passwordSignInSchema.safeParse({
    email: typed ?? undefined,
    password: formData.get("password") ?? undefined,
  });
  if (!parsed.success) {
    const errors = fieldErrorsOf(parsed.error);
    return {
      error: null,
      fieldErrors: { email: errors.email?.[0], password: errors.password?.[0] },
      email,
    };
  }

  const started = await startPasswordSession(parsed.data.email, parsed.data.password);
  if (!started.ok) return refused(PASSWORD_PROBLEMS[started.problem]);

  const step = await continueSignIn();
  if (step.status === "unverified") return refused(PASSWORD_PROBLEMS.unconfirmed);
  if (step.status === "signed-out") {
    // A session the Guard doesn't count: don't leave it in the cookies.
    await endSession();
    return refused(PASSWORD_PROBLEMS.failed);
  }
  redirect(safeAdminNext(formData.get("next")));
}
