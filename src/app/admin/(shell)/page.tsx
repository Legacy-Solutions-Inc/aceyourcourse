import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { requireStaff } from "@/lib/admin/guard";
import { greeting, overviewDateLine } from "@/lib/admin/time";
import { paths } from "@/paths";

export const metadata: Metadata = { title: adminScreen("overview").title };

/** The Overview (mockup 704–706): the greeting for now. Ticket 11 adds what needs attention. */
export default async function OverviewPage() {
  const actor = await requireStaff(paths.admin.overview);
  const now = new Date();

  return (
    <AdminScreen screen="overview">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-xs font-bold tracking-[0.06em] text-ayc-blue">
          {overviewDateLine(now)}
        </p>
        <h2 className="text-[clamp(26px,3vw,38px)] leading-[1.05] font-extrabold tracking-[-0.03em]">
          {greeting(now, actor.name)}
        </h2>
      </div>
    </AdminScreen>
  );
}
