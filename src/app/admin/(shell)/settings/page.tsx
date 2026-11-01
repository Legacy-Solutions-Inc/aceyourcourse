import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { AdminAccounts } from "@/components/admin/settings/admin-accounts";
import { SettingsEditor } from "@/components/admin/settings/settings-editor";
import { config } from "@/config";
import { requireOwner } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { getSettingsForAdmin, listStaff } from "@/services/admin";

import {
  addInvite,
  cancelStaffInvite,
  changeStaffMemberRole,
  removeStaffMember,
  renewStaffInvite,
  saveContactEmail,
  saveLinks,
  saveTrustFigures,
} from "./actions";

export const metadata: Metadata = { title: adminScreen("settings").title };

/**
 * Settings, for Owners only: the contact email, the store and social links,
 * the trust figures, and the Admin accounts, read fresh on every request.
 */
export default async function SettingsPage() {
  const actor = await requireOwner(paths.admin.settings);
  const [settings, staff] = await Promise.all([getSettingsForAdmin(), listStaff(actor)]);
  // requireOwner just let an Owner in, so the staff list can't refuse them.
  if (!staff.ok) throw new Error(`The staff list refused an Owner: ${staff.error.kind}`);
  return (
    <AdminScreen screen="settings">
      <SettingsEditor
        initial={settings}
        actions={{ saveContactEmail, saveLinks, saveTrustFigures }}
        accounts={
          <AdminAccounts
            list={staff.value}
            you={actor.email}
            now={new Date().toISOString()}
            siteUrl={config.site.url}
            actions={{
              addInvite,
              renewStaffInvite,
              cancelStaffInvite,
              changeStaffMemberRole,
              removeStaffMember,
            }}
          />
        }
      />
    </AdminScreen>
  );
}
