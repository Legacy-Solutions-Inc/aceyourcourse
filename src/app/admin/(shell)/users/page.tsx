import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { BetaTesters } from "@/components/admin/users/beta-testers";
import { UserList } from "@/components/admin/users/user-list";
import { UsersTabs } from "@/components/admin/users/users-tabs";
import { requireOwner } from "@/lib/admin/guard";
import { parseUsersParams, userListHref } from "@/lib/admin/users-list";
import { paths } from "@/paths";
import { listBetaTesters, listUsers } from "@/services/admin";
import { memberAppLive } from "@/services/catalogue.rules";

import { addTester, removeTester } from "./actions";

export const metadata: Metadata = { title: adminScreen("users").title };

interface UsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Users, for Owners only (spec, Phase 3 → Beta access, The beta gate), read
 * fresh on every request: the Users list (ticket 16), with its search, filter
 * and page in the URL, and the Beta Testers tab beside it (ticket 01). An
 * Editor is sent to the 403 screen; the seam refuses them too.
 */
export default async function UsersPage({ searchParams }: UsersPageProps) {
  const { tab, query } = parseUsersParams(await searchParams);
  const actor = await requireOwner(
    tab === "beta-testers" ? paths.admin.betaTesters : userListHref(query),
  );

  if (tab === "beta-testers") {
    const testers = await listBetaTesters(actor);
    // requireOwner just let an Owner in, so the list can't refuse them.
    if (!testers.ok)
      throw new Error(`The Beta Tester list refused an Owner: ${testers.error.kind}`);
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

  const list = await listUsers(actor, query);
  // The query comes from parseUsersParams, and an Owner is let in, so it can't be refused.
  if (!list.ok) throw new Error(`The Users list refused an Owner: ${list.error.kind}`);
  return (
    <AdminScreen screen="users">
      <UsersTabs tab="users" />
      <UserList list={list.value} now={new Date()} />
    </AdminScreen>
  );
}
