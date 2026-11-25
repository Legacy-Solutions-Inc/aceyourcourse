import { AdminDrawer } from "@/components/admin/admin-drawer";
import { adminMenu } from "@/components/admin/admin-menu";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getStaff } from "@/lib/admin/guard";
import { getPaidToday } from "@/services/admin";
import type { PaidToday, StaffActor } from "@/services/admin.types";

import { signOut } from "../actions";

/**
 * The sidebar's "PAID TODAY" card (Phase 4, ticket 11): an Owner's, read by
 * the seam, which gives an Editor none. A card that can't be read is left
 * out, logged, rather than taking every Admin screen down with it.
 */
async function paidTodayOf(actor: StaffActor): Promise<PaidToday | null> {
  try {
    return await getPaidToday(actor);
  } catch (error) {
    console.error("Couldn't read the sidebar's PAID TODAY card; leaving it out:", error);
    return null;
  }
}

/**
 * The signed-in Admin shell: the 268 px sidebar, or below 760 px the "Menu"
 * button and drawer, around each screen. The menu follows the Staff Role.
 *
 * A layout doesn't re-render when Staff move between screens, so it can't be
 * the Guard: every page calls requireStaff or requireOwner itself. When nobody
 * is signed in as Staff, the layout renders the bare page, whose Guard then
 * redirects with the right `next`. For the same reason an Owner's PAID TODAY
 * card is as of the last full load or refresh.
 */
export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const actor = await getStaff();
  if (!actor) return children;

  const menu = adminMenu(actor.role);
  const paidToday = await paidTodayOf(actor);
  return (
    <div className="flex min-h-svh bg-background">
      <a
        href="#main"
        className="sr-only z-70 bg-accent px-4 py-3 font-bold text-accent-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <aside className="hidden w-67 shrink-0 border-r-[1.5px] bg-ayc-sand wide:block">
        <div className="sticky top-0 flex min-h-svh flex-col">
          <AdminSidebar menu={menu} actor={actor} signOutAction={signOut} paidToday={paidToday} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <AdminDrawer menu={menu} actor={actor} signOutAction={signOut} paidToday={paidToday} />
    </div>
  );
}
