import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { NeedsAttentionList } from "@/components/admin/overview/needs-attention-list";
import { QuickActions } from "@/components/admin/overview/quick-actions";
import { requireStaff } from "@/lib/admin/guard";
import { needsAttention, needsYouToday } from "@/lib/admin/needs-attention";
import { greeting, overviewDateLine } from "@/lib/admin/time";
import { paths } from "@/paths";
import { getOverview } from "@/services/admin";

export const metadata: Metadata = { title: adminScreen("overview").title };

/**
 * The Overview (BUILD-MAP §3.1): the greeting, the quick actions, and what
 * needs Staff today, read fresh so a fix made elsewhere is gone on the next
 * load. Phase 4's sales, orders and member panels aren't here.
 */
export default async function OverviewPage() {
  const actor = await requireStaff(paths.admin.overview);
  const now = new Date();
  const items = needsAttention({ ...(await getOverview(actor)), now, role: actor.role });

  return (
    <AdminScreen screen="overview">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-xs font-bold tracking-[0.06em] text-ayc-blue">
            {overviewDateLine(now)}
          </p>
          <h2 className="text-[clamp(26px,3vw,38px)] leading-[1.05] font-extrabold tracking-[-0.03em]">
            {greeting(now, actor.name)}
          </h2>
          <p className="text-[15px] text-ayc-slate">{needsYouToday(items.length)}</p>
        </div>
        <QuickActions />
      </div>
      {items.length > 0 && <NeedsAttentionList items={items} />}
    </AdminScreen>
  );
}
