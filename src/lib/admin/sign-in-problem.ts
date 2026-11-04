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
