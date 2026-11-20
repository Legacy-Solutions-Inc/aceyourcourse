import "server-only";

import { startPasswordSession } from "@/lib/admin/identity";
import { PASSWORD_PROBLEMS, type PasswordProblem } from "@/lib/admin/sign-in-problem";
import { fieldErrorsOf, passwordSignInSchema } from "@/services/admin.schema";

// The password box's first step, shared by the Admin's sign-in (tickets 19
// and 24) and the Member App's (ticket 20; all temporary, removed once the
// deployed site is tested): check the fields, then sign in to Supabase. What
// happens after differs by Surface: the Staff Guard in the Admin, the beta
// gate and the Active Device in the Member App. Each Surface's action checks
// passwordSignInAllowed() first and answers 404 where it isn't.

export interface PasswordSignInState {
  /** Why the sign-in didn't go on, for the whole form. */
  error: string | null;
  /** A message next to an empty or malformed field. */
  fieldErrors: { email?: string; password?: string };
  /** What was typed, so the field keeps it after an error. The password is never sent back. */
  email: string;
}

/** What the box shows when sign-in stopped for `problem`, keeping the typed email. */
export function passwordRefused(email: string, problem: PasswordProblem): PasswordSignInState {
  return { error: PASSWORD_PROBLEMS[problem], fieldErrors: {}, email };
}

export type PasswordSubmission =
  | { ok: true; /** What was typed, for a refusal after this step. */ email: string }
  | { ok: false; state: PasswordSignInState };

/**
 * The box's form, checked, then signed in to Supabase: a session set in the
 * cookies as Google's is, or the state the box shows instead (an empty or
 * malformed field, or why Supabase refused). Never makes a User. Throws where
 * the password sign-in isn't allowed.
 */
export async function submitPasswordSignIn(formData: FormData): Promise<PasswordSubmission> {
  const typed = formData.get("email");
  const email = typeof typed === "string" ? typed : "";

  const parsed = passwordSignInSchema.safeParse({
    email: typed ?? undefined,
    password: formData.get("password") ?? undefined,
  });
  if (!parsed.success) {
    const errors = fieldErrorsOf(parsed.error);
    return {
      ok: false,
      state: {
        error: null,
        fieldErrors: { email: errors.email?.[0], password: errors.password?.[0] },
        email,
      },
    };
  }

  const started = await startPasswordSession(parsed.data.email, parsed.data.password);
  return started.ok
    ? { ok: true, email }
    : { ok: false, state: passwordRefused(email, started.problem) };
}
