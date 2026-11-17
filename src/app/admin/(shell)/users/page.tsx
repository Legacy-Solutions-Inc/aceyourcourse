import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { BetaTesters } from "@/components/admin/users/beta-testers";
import { UsersTabs } from "@/components/admin/users/users-tabs";
import { requireOwner } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { listBetaTesters } from "@/services/admin";
import { memberAppLive } from "@/services/catalogue.rules";

import { addTester, removeTester } from "./actions";

export const metadata: Metadata = { title: adminScreen("users").title };

/**
 * Users, for Owners only (spec, Phase 3 → The beta gate): the Beta Testers
 * tab, read fresh on every request. The Users list and each Member's detail
 * page come with ticket 16, so for now every address shows this one tab.
 */
export default async function UsersPage() {
  const actor = await requireOwner(paths.admin.users);
  const testers = await listBetaTesters(actor);
  // requireOwner just let an Owner in, so the list can't refuse them.
  if (!testers.ok) throw new Error(`The Beta Tester list refused an Owner: ${testers.error.kind}`);
  return (
    <AdminScreen screen="users">
      <UsersTabs tab="beta-testers" />
      <BetaTesters
        testers={testers.value}
        memberAppLive={memberAppLive()}
        actions={{ addTester, removeTester }}
      />
    </AdminScreen>
  );
}
