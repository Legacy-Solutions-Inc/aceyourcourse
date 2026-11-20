import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { BetaTesters } from "@/components/admin/users/beta-testers";
import { PrivacyRequests } from "@/components/admin/users/privacy-requests";
import { UserList } from "@/components/admin/users/user-list";
import { UsersTabs } from "@/components/admin/users/users-tabs";
import { requireOwner } from "@/lib/admin/guard";
import { parseUsersParams, type UsersTab, userListHref } from "@/lib/admin/users-list";
import { paths } from "@/paths";
import { listBetaTesters, listPrivacyRequests, listUsers } from "@/services/admin";
import type { UserListQuery } from "@/services/admin.types";
import { memberAppLive } from "@/services/catalogue.rules";

import { addTester, removeTester } from "./actions";

export const metadata: Metadata = { title: adminScreen("users").title };

interface UsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Pure: the address of the tab a sign-in comes back to. */
function tabHref(tab: UsersTab, query: UserListQuery): string {
  if (tab === "beta-testers") return paths.admin.betaTesters;
  if (tab === "privacy-requests") return paths.admin.privacyRequests;
  return userListHref(query);
}

/**
 * Users, for Owners only (spec, Phase 3 → Beta access, The beta gate,
 * Privacy Requests), read fresh on every request: the Users list (ticket 16),
 * with its search, filter and page in the URL, the Beta Testers tab beside it
 * (ticket 01), and the Privacy Requests tab (ticket 18). An Editor is sent to
 * the 403 screen; the seam refuses them too.
 */
export default async function UsersPage({ searchParams }: UsersPageProps) {
  const { tab, query } = parseUsersParams(await searchParams);
  const actor = await requireOwner(tabHref(tab, query));

  if (tab === "privacy-requests") {
    const requests = await listPrivacyRequests(actor);
    // requireOwner just let an Owner in, so the list can't refuse them.
    if (!requests.ok)
      throw new Error(`The Privacy Requests list refused an Owner: ${requests.error.kind}`);
    return (
      <AdminScreen screen="users">
        <UsersTabs tab="privacy-requests" />
        <PrivacyRequests requests={requests.value} />
      </AdminScreen>
    );
  }

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
