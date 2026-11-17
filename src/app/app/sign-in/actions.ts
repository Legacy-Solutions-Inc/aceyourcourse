"use server";

import { notFound, redirect } from "next/navigation";

import type { SignInAsState } from "@/app/admin/sign-in/actions";
import { startGoogleSignIn, startSampleSession } from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
import { googleProblem } from "@/lib/admin/sign-in-problem";
import { safeMemberAppNext } from "@/lib/member-app/safe-next";
import { paths } from "@/paths";
import { signInAsSchema } from "@/services/admin.schema";

// The Member App's sign-in actions. Neither needs the gate: anyone may sign
// in, and the gate on the page they land on decides what happens next (in,
// or "Not open yet"). Neither makes a Member record.

/**
 * The development-only "Sign in as" (sample mode only; any other mode answers
 * 404): signs in as a sample Member, or any email, then goes on to `next`,
 * sanitised to a Member App path.
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
