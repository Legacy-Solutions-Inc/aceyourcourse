"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  DEFAULT_SALES_CHART_RANGE,
  type SalesBar,
  salesChart,
  SALES_CHART_RANGES,
  type SalesChartRange,
} from "@/lib/admin/sales-view";
import type { SalesDay } from "@/lib/payments/sales-figures";
import { cn } from "@/lib/utils";

const CONFIG = {
  netCentavos: { label: "Net paid", color: "var(--ayc-blue)" },
} satisfies ChartConfig;

/** The tooltip on a bar: its amount first, then its day. */
function BarTooltip({ active, payload }: { active?: boolean; payload?: { payload?: SalesBar }[] }) {
  const bar = payload?.[0]?.payload;
  if (!active || !bar) return null;
  return (
    <div className="border-[1.5px] bg-ayc-paper px-2.5 py-1.5 font-mono text-xs shadow-hard-sm">
      <strong className="font-bold">{bar.amount}</strong>{" "}
      <span className="text-ayc-slate">{bar.today ? `${bar.label}, today` : bar.label}</span>
    </div>
  );
}

/**
 * The Overview's paid-sales chart for an Owner (Phase 4, ticket 11; mockup
 * 715–722, BUILD-MAP §3.1): each day's net paid over the last 14 days (the
 * default) or 30, today's bar orange and outlined, every other blue, with a
 * tooltip on hover. A day with no sales is a ₱0 bar; one with more refunded
 * than paid dips below the line. The table under it gives every day's amount
 * without the chart, to a screen reader and the keyboard alike, so the chart
 * itself takes no focus.
 */
export function SalesChart({ days, className }: { days: SalesDay[]; className?: string }) {
  const [range, setRange] = useState<SalesChartRange>(DEFAULT_SALES_CHART_RANGE);
  const { bars, summary, labelEvery } = salesChart(days, range);

  return (
    <section
      aria-labelledby="paid-sales"
      className={cn("flex flex-col border-[1.5px] bg-ayc-paper shadow-hard", className)}
    >
      <div className="flex items-center justify-between gap-2.5 border-b-[1.5px] px-4 py-3.5">
        <h2 id="paid-sales" className="text-lg font-extrabold tracking-[-0.01em]">
          Paid sales
        </h2>
        <div role="group" aria-label="Days shown" className="flex border-[1.5px]">
          {SALES_CHART_RANGES.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={days === range}
              onClick={() => setRange(days)}
              className={cn(
                "flex min-h-9 cursor-pointer items-center px-3 font-mono text-xs font-bold",
                days === range ? "bg-primary text-primary-foreground" : "bg-transparent",
              )}
            >
              {days} DAYS
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-4 pt-4 pb-3">
        <p className="font-mono text-xs font-medium text-ayc-slate">{summary}</p>
        <ChartContainer config={CONFIG} className="aspect-auto h-44 w-full">
          {/* No keyboard layer: the table below gives every day's amount, so the
              picture isn't a control of its own. */}
          <BarChart
            data={bars}
            accessibilityLayer={false}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--ayc-rule)" strokeOpacity={0.5} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={labelEvery - 1}
              tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <ReferenceLine y={0} stroke="var(--ayc-navy)" strokeWidth={1.5} />
            <ChartTooltip cursor={false} content={<BarTooltip />} />
            <Bar dataKey="netCentavos" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {bars.map((bar) => (
                <Cell
                  key={bar.date}
                  fill={bar.today ? "var(--ayc-orange)" : "var(--ayc-blue)"}
                  stroke={bar.today ? "var(--ayc-navy)" : "none"}
                  strokeWidth={1.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <table className="sr-only">
          <caption>Net paid by day</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Net paid</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.date}>
                <th scope="row">{bar.today ? `${bar.label}, today` : bar.label}</th>
                <td>{bar.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
