/**
 * Why the sign-in screen shows an error instead of going on: the OAuth
 * callback didn't finish, Google sign-in isn't enabled on this Supabase or
 * Supabase didn't answer, or the Google account's email isn't verified. It travels in the sign-in
 * screen's `error` search param.
 */
export type SignInProblem = "callback" | "google-not-set-up" | "unreachable" | "unverified";

export const SIGN_IN_PROBLEMS: Record<SignInProblem, string> = {
  callback: "Sign-in didn't finish. Try again.",
  "google-not-set-up": "Google sign-in isn't set up on this server",
  unreachable: "Sign-in isn't answering right now. Try again in a minute.",
  unverified:
    "This Google account's email address isn't verified, so it can't open the admin dashboard.",
};

const isSignInProblem = (value: unknown): value is SignInProblem =>
  typeof value === "string" && Object.hasOwn(SIGN_IN_PROBLEMS, value);

/** Pure: the problem an `error` search param names, or null for anything else. */
export function parseSignInProblem(value: unknown): SignInProblem | null {
  return isSignInProblem(value) ? value : null;
}

/** Pure: what the sign-in screen says when Google's sign-in couldn't start. */
export function googleProblem(reason: "not-set-up" | "unreachable"): SignInProblem {
  return reason === "not-set-up" ? "google-not-set-up" : "unreachable";
}

/**
 * Why the development password box (ticket 19) didn't sign in. A wrong email
 * and a wrong password are the same "mismatch": it never says which.
 */
export type PasswordProblem =
  "mismatch" | "rate-limited" | "email-off" | "unconfirmed" | "unreachable" | "failed";

export const PASSWORD_PROBLEMS: Record<PasswordProblem, string> = {
  mismatch: "That email and password don't match.",
  "rate-limited": "Too many tries. Wait a minute and try again.",
  "email-off": "Password sign-in is off on this project.",
  unconfirmed:
    "This email isn't confirmed. Confirm the User in the Supabase dashboard, then try again.",
  unreachable: SIGN_IN_PROBLEMS.unreachable,
  failed: SIGN_IN_PROBLEMS.callback,
};

const PASSWORD_ERRORS: Partial<Record<string, PasswordProblem>> = {
  invalid_credentials: "mismatch",
  over_request_rate_limit: "rate-limited",
  email_provider_disabled: "email-off",
  email_not_confirmed: "unconfirmed",
};

/** Pure: the problem a Supabase sign-in error is, by its code (or HTTP 429). */
export function passwordProblem({
  code,
  status,
}: {
  code?: string;
  status?: number;
}): PasswordProblem {
  if (status === 429) return "rate-limited";
  return (code && PASSWORD_ERRORS[code]) || "failed";
}
