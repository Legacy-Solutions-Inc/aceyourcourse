import type { SignInProblem } from "@/lib/admin/sign-in-problem";

/**
 * What the Member App's sign-in screen says when the last sign-in didn't go
 * on. The problems are the Admin's (the two share Google sign-in and its
 * callback); the words are the Member App's.
 */
export const MEMBER_SIGN_IN_PROBLEMS: Record<SignInProblem, string> = {
  callback: "Sign-in didn't finish. Try again.",
  "google-not-set-up": "Google sign-in isn't set up on this server",
  unreachable: "Sign-in isn't answering right now. Try again in a minute.",
  unverified:
    "This Google account's email address isn't verified, so it can't sign in. Verify it with Google, then try again.",
};
