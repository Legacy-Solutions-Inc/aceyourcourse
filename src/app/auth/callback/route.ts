import { NextResponse } from "next/server";
import { z } from "zod";

import { continueSignIn } from "@/lib/admin/guard";
import { finishGoogleSignIn } from "@/lib/admin/identity";
import { safeAdminNext } from "@/lib/admin/safe-next";
import { paths } from "@/paths";

const codeSchema = z.string().min(1);

/**
 * GET /auth/callback: where Google sign-in comes back (ticket 16). It
 * exchanges the PKCE `code` for a Supabase session, signs in through the Staff
 * Guard (Staff go on; anyone else is recorded and goes to the 403 screen), and
 * lands on `next`, sanitised to an Admin path. Without a code, with one
 * Supabase refuses, or for an email Google didn't verify, it goes back to
 * sign-in saying why. Only the Admin signs in for now; the Member App
 * (Phase 3) will widen `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeAdminNext(searchParams.get("next"));
  const back = (problem: "callback" | "unverified") =>
    NextResponse.redirect(`${origin}${paths.admin.signIn(next, problem)}`);

  const code = codeSchema.safeParse(searchParams.get("code"));
  if (!code.success || !(await finishGoogleSignIn(code.data))) return back("callback");

  const step = await continueSignIn();
  if (step.status === "staff") return NextResponse.redirect(`${origin}${next}`);
  return back(step.status === "unverified" ? "unverified" : "callback");
}
