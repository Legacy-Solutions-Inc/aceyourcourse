"use server";

import { redirect } from "next/navigation";

import { endSession } from "@/lib/admin/identity";
import { requireMemberAppOpen } from "@/lib/member-app/guard";
import { paths } from "@/paths";

/**
 * Signs out of the Member App and returns to its sign-in screen. Signing out
 * needs no gate: the "Not open yet" screen uses it too, for someone who isn't
 * let in. Closed mode answers 404.
 */
export async function signOut(): Promise<void> {
  requireMemberAppOpen();
  await endSession();
  redirect(paths.memberApp.signIn());
}
