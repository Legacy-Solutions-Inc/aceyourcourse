import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { requireOwner } from "@/lib/admin/guard";
import { paths } from "@/paths";

export const metadata: Metadata = { title: adminScreen("settings").title };

/** Settings, for Owners only. Tickets 02 and 03 fill it in. */
export default async function SettingsPage() {
  await requireOwner(paths.admin.settings);
  return <AdminScreen screen="settings" />;
}
