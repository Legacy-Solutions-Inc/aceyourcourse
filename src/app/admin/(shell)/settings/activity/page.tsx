import type { Metadata } from "next";

import { AdminScreen } from "@/components/admin/admin-screen";
import { StaffActivityList } from "@/components/admin/settings/staff-activity-list";
import { requireOwner } from "@/lib/admin/guard";
import { activityHref, parseActivityParams } from "@/lib/admin/staff-activity-view";
import { listStaffActivity } from "@/services/admin";

export const metadata: Metadata = { title: "Staff Activity" };

interface StaffActivityPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Staff Activity, under Settings, for Owners only (Phase 4, ticket 15; spec,
 * Phase 4 → Orders Admin): the records the filters and cursor in the URL
 * match, read fresh on every request. An Editor is sent to the 403 screen,
 * and the seam refuses them too. Read-only: the screen has no actions.
 */
export default async function StaffActivityPage({ searchParams }: StaffActivityPageProps) {
  const query = parseActivityParams(await searchParams);
  const actor = await requireOwner(activityHref(query));
  const listed = await listStaffActivity(actor, query);
  // requireOwner just let an Owner in, so the list can't refuse them.
  if (!listed.ok) throw new Error(`Staff Activity refused an Owner: ${listed.error.kind}`);

  return (
    <AdminScreen screen="settings">
      <StaffActivityList list={listed.value} />
    </AdminScreen>
  );
}
