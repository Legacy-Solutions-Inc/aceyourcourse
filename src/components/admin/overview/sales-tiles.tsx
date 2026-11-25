import Link from "next/link";

import type { SalesTile, SalesTrend } from "@/lib/admin/sales-view";
import { cn } from "@/lib/utils";

/** A change's colour (mockup 1663): green up, amber down, plain for none. */
const TREND: Record<SalesTrend, string> = {
  up: "text-ayc-success",
  down: "text-ayc-warning",
  none: "text-ayc-slate",
};

/**
 * The Overview's KPI tiles for an Owner (Phase 4, ticket 11; mockup 711–713,
 * BUILD-MAP §3.1): each opens the Orders or the Users behind its figure, and
 * a money tile says what was refunded in its days.
 */
export function SalesTiles({ tiles }: { tiles: SalesTile[] }) {
  return (
    <ul
      aria-label="Sales figures"
      className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3.5"
    >
      {tiles.map((tile) => (
        <li key={tile.label} className="flex">
          <Link
            href={tile.href}
            className="flex flex-1 flex-col gap-2 border-[1.5px] bg-ayc-paper px-4.5 py-4 shadow-hard transition-transform hover:-translate-0.5 motion-reduce:transition-none"
          >
            <span className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-slate">
              {tile.label}
            </span>
            <span className="text-[clamp(28px,2.8vw,36px)] leading-none font-black tracking-[-0.03em]">
              {tile.value}
            </span>
            <span className={cn("font-mono text-xs font-bold", TREND[tile.trend])}>
              {tile.change}
            </span>
            {tile.refunded ? (
              <span className="font-mono text-xs text-ayc-slate">{tile.refunded}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
