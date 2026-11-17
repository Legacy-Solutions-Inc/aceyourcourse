import { NextResponse } from "next/server";
import { z } from "zod";

import { continueSignIn } from "@/lib/admin/guard";
import { endSession, finishGoogleSignIn, getSignInAttempt } from "@/lib/admin/identity";
import { safeAdminNext } from "@/lib/admin/safe-next";
import type { SignInProblem } from "@/lib/admin/sign-in-problem";
import { claimDeviceAtSignIn } from "@/lib/member-app/guard";
import { memberAppNext } from "@/lib/member-app/safe-next";
import { paths } from "@/paths";

const codeSchema = z.string().min(1);

/**
 * GET /auth/callback: where Google sign-in comes back (ticket 16), for the
 * Admin and the Member App (Phase 3). It exchanges the PKCE `code` for a
 * Supabase session, then goes on to `next`, on the Surface `next` names:
 *
 * - A path inside the Member App lands there. The Member App's own gate
 *   decides on that page (in, or "Not open yet"), so this never goes through
 *   the Staff Guard, and nobody is recorded as a refused Admin sign-in. For
 *   someone the gate lets in, this device becomes their Active Device first,
 *   replacing any other (Phase 3 → Active Device).
 * - Anything else is the Admin's: it signs in through the Staff Guard (Staff
 *   go on; anyone else is recorded and goes to the 403 screen) and lands on
 *   `next`, sanitised to an Admin path. The Admin never claims, replaces or
 *   checks the Active Device.
 *
 * Without a code, with one Supabase refuses, or for an email Google didn't
 * verify, it goes back to that Surface's sign-in screen saying why.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const to = (path: string) => NextResponse.redirect(`${origin}${path}`);
  const code = codeSchema.safeParse(searchParams.get("code"));
  const signedIn = async () => code.success && (await finishGoogleSignIn(code.data));

  const appNext = memberAppNext(searchParams.get("next"));
  if (appNext !== null) {
    const back = (problem: SignInProblem) => to(paths.memberApp.signIn(appNext, problem));
    if (!(await signedIn())) return back("callback");

    const attempt = await getSignInAttempt();
    if (attempt.status === "verified") {
      await claimDeviceAtSignIn();
      return to(appNext);
    }
    if (attempt.status === "signed-out") return back("callback");
    // An unverified email matches no list: don't leave its session behind.
    await endSession();
    return back("unverified");
  }

  const next = safeAdminNext(searchParams.get("next"));
  const back = (problem: SignInProblem) => to(paths.admin.signIn(next, problem));
  if (!(await signedIn())) return back("callback");

  const step = await continueSignIn();
  if (step.status === "staff") return to(next);
  return back(step.status === "unverified" ? "unverified" : "callback");
}
