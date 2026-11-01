"use server";

import { notFound, redirect } from "next/navigation";

import { admit } from "@/lib/admin/guard";
import { startSampleSession } from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
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
 * Guard's admit decides what happens next, exactly as it will after Google
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

  await admit(await startSampleSession(parsed.data.email));
  redirect(safeAdminNext(formData.get("next")));
}
