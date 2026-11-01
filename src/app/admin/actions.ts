"use server";

import { redirect } from "next/navigation";

import { requireAdminOpen } from "@/lib/admin/guard";
import { endSession } from "@/lib/admin/identity";
import { paths } from "@/paths";

/**
 * Signs out of the Admin and returns to sign-in. Signing out needs no Staff
 * Role: the 403 screen's "Use another account" uses it too, for Users who
 * aren't Staff. Closed mode answers 404.
 */
export async function signOut(): Promise<void> {
  requireAdminOpen();
  await endSession();
  redirect(paths.admin.signIn());
}
