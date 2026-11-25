import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { NeedsAttentionList } from "@/components/admin/overview/needs-attention-list";
import { QuickActions } from "@/components/admin/overview/quick-actions";
import { SalesChart } from "@/components/admin/overview/sales-chart";
import { SalesTiles } from "@/components/admin/overview/sales-tiles";
import { requireStaff } from "@/lib/admin/guard";
import { needsAttention, needsYouToday } from "@/lib/admin/needs-attention";
import { salesTiles } from "@/lib/admin/sales-view";
import { greeting, overviewDateLine } from "@/lib/admin/time";
import { paths } from "@/paths";
import { getOverview } from "@/services/admin";

export const metadata: Metadata = { title: adminScreen("overview").title };

/**
 * The Overview (BUILD-MAP §3.1): the greeting, the quick actions, and what
 * needs Staff today, read fresh so a fix made elsewhere is gone on the next
 * load. An Owner also sees the sales tiles, the paid-sales chart and the
 * payment work in Needs attention (Phase 4, ticket 11); the seam gives an
 * Editor none of them. The recent orders, members and top-selling panels
 * aren't here.
 */
export default async function OverviewPage() {
  const actor = await requireStaff(paths.admin.overview);
  const now = new Date();
  const overview = await getOverview(actor);
  const { sales } = overview;
  const items = needsAttention({
    ...overview,
    now,
    role: actor.role,
    payments: sales?.payments ?? null,
  });

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
      {sales ? <SalesTiles tiles={salesTiles(sales)} /> : null}
      {sales ? (
        <div className="flex flex-wrap items-stretch gap-4.5">
          <SalesChart days={sales.figures.days} className="min-w-0 flex-[1.6_1_420px]" />
          {items.length > 0 && (
            <NeedsAttentionList items={items} className="max-w-none min-w-0 flex-[1_1_320px]" />
          )}
        </div>
      ) : (
        items.length > 0 && <NeedsAttentionList items={items} />
      )}
    </AdminScreen>
  );
}
