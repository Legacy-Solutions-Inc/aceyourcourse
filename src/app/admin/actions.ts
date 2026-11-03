"use server";

import { notFound, redirect } from "next/navigation";

import { requireAdminOpen, requireStaff } from "@/lib/admin/guard";
import { endSession } from "@/lib/admin/identity";
import { adminMode } from "@/lib/admin/mode";
import { restoreSampleData } from "@/lib/admin/sample-data";
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

/**
 * The header's Reset button: starts the sample data again from the seed and
 * clears every Catalogue cache tag. Any Staff User may use it, with sample
 * data only; any other mode answers 404. On a database that isn't local it
 * refuses, as the reset route does.
 */
export async function resetSampleData(): Promise<void> {
  if (adminMode !== "sample") notFound();
  await requireStaff();
  const restored = await restoreSampleData();
  if (!restored.ok) throw new Error("The sample data can only be reset on a local database.");
}
