import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NotOpenYet } from "@/components/member-app/not-open-yet";
import { getMemberAppAccess } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { getWebsiteSettings } from "@/services/catalogue";

import { signOut } from "../actions";

export const metadata: Metadata = { title: "Not open yet" };

/**
 * "Not open yet" (story 133c): signed in, but not let in while the Member App
 * switch is off. The gate is asked on every load, so someone an Owner has
 * since added, or anyone once the switch is on, goes straight to Home, and a
 * signed-out visitor to sign-in. Showing it makes no Member record.
 */
export default async function NotOpenYetPage() {
  const access = await getMemberAppAccess();
  if (access.status === "signed-out") redirect(paths.memberApp.signIn());
  if (access.status === "open") redirect(paths.memberApp.home);

  const { contactEmail } = await getWebsiteSettings();
  return <NotOpenYet user={access.user} contactEmail={contactEmail} signOutAction={signOut} />;
}
