import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { SettingsEditor } from "@/components/admin/settings/settings-editor";
import { requireOwner } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { getSettingsForAdmin } from "@/services/admin";

import { saveContactEmail, saveLinks, saveTrustFigures } from "./actions";

export const metadata: Metadata = { title: adminScreen("settings").title };

/**
 * Settings, for Owners only: the contact email, the store and social links and
 * the trust figures. Ticket 03 adds the Admin accounts.
 */
export default async function SettingsPage() {
  await requireOwner(paths.admin.settings);
  const settings = await getSettingsForAdmin();
  return (
    <AdminScreen screen="settings">
      <SettingsEditor
        initial={settings}
        actions={{ saveContactEmail, saveLinks, saveTrustFigures }}
      />
    </AdminScreen>
  );
}
