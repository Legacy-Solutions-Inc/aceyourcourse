import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminAction } from "@/lib/admin/action";
import { plansHref } from "@/lib/admin/plan-view";
import { perMonthText, periodLabel } from "@/lib/plans/plan-text";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { AdminPlan, AdminPlans } from "@/services/admin.types";

import { PlanOnSaleSwitch } from "./plan-on-sale-switch";

interface PlanListProps {
  plans: AdminPlans;
  /** The Exam chip picked, or null for ALL. */
  examChip: string | null;
  /** The selected Plan's id, "new", or null. */
  selected: string | null;
  setOnSale: AdminAction<AdminPlan>;
}

const chip =
  "flex min-h-9 items-center border-[1.5px] px-2.5 font-mono text-xs font-bold hover:bg-ayc-sand";
const chipOn = "bg-primary text-primary-foreground hover:bg-primary";
const head = "h-auto px-0 py-2.5 font-mono text-[10px] font-bold tracking-[0.06em] text-ayc-slate";

/**
 * The Plans list (Phase 4, ticket 01; BUILD-MAP §3.8, mockup 591–606): Exam
 * chips in the URL, then the chip's Plans, already sorted by Exam, duration
 * and name, each with its On sale switch. A Plan that's off stays listed,
 * dimmed and marked NOT ON SALE. The mockup's ACTIVE count and one-time
 * purchases aren't here: Courses are sold from Phase 5.
 */
export function PlanList({ plans, examChip, selected, setOnSale }: PlanListProps) {
  const shown = examChip ? plans.plans.filter((plan) => plan.examCode === examChip) : plans.plans;
  return (
    <section aria-label="Plans" className="flex min-w-0 flex-col gap-2.5">
      <div role="group" aria-label="Exam" className="flex flex-wrap gap-1.5">
        {[null, ...plans.exams.map(({ code }) => code)].map((exam) => (
          <Link
            key={exam ?? "all"}
            href={plansHref({ exam, plan: null })}
            aria-current={examChip === exam ? "true" : undefined}
            className={cn(chip, examChip === exam ? chipOn : "bg-ayc-paper")}
          >
            {exam ?? "ALL"}
          </Link>
        ))}
      </div>

      <div className="border-[1.5px] bg-ayc-paper">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="border-b-[1.5px] hover:bg-transparent">
              <TableHead className={cn(head, "pl-3.5")}>PLANS · {shown.length}</TableHead>
              <TableHead className={cn(head, "hidden w-22 wide:table-cell")}>PERIOD</TableHead>
              <TableHead className={cn(head, "w-20")}>PRICE</TableHead>
              <TableHead className={cn(head, "w-14 pr-3.5")}>ON</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                href={plansHref({ exam: examChip, plan: plan.id })}
                selected={plan.id === selected}
                setOnSale={setOnSale}
              />
            ))}
          </TableBody>
        </Table>
        {shown.length === 0 ? (
          <p className="px-3.5 py-7 text-center text-sm text-muted-foreground">
            {examChip
              ? `No plans for ${examChip} yet. Add one with + New plan.`
              : "No plans yet. Add the first one with + New plan."}
          </p>
        ) : null}
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        PAID THROUGH PAYMONGO · MEMBERS RENEW THEMSELVES · NOTHING RENEWS AUTOMATICALLY
      </p>
    </section>
  );
}

interface PlanRowProps {
  plan: AdminPlan;
  href: string;
  selected: boolean;
  setOnSale: AdminAction<AdminPlan>;
}

/** One Plan (mockup 597–604). */
function PlanRow({ plan, href, selected, setOnSale }: PlanRowProps) {
  const period = periodLabel(plan.days);
  const title = `${plan.name} · ${period}`;
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      className={cn(
        "border-ayc-ruled hover:bg-ayc-sand/40 data-[state=selected]:bg-ayc-orange/15",
        // Dimmed with colour, not the mockup's opacity, so the text keeps its contrast.
        !plan.onSale && "bg-ayc-sand/70 text-muted-foreground",
      )}
    >
      <TableCell className="py-2.25 pr-2.5 pl-3.5">
        <Link
          href={href}
          scroll={false}
          aria-current={selected ? "true" : undefined}
          className="flex min-w-0 flex-col gap-0.5"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-bold">{plan.name}</span>
            {/* On a phone the PERIOD column folds in here; wider, it names the link only. */}
            <span className="font-mono text-[10px] font-bold text-ayc-blue wide:sr-only">
              {period}
            </span>
            {plan.bestValue ? (
              <span className="bg-ayc-orange px-1.25 py-0.75 font-mono text-[9px] leading-none font-bold text-ayc-navy">
                BEST VALUE
              </span>
            ) : null}
            {plan.onSale ? null : (
              <span className="border border-ayc-slate px-1.25 py-0.5 font-mono text-[9px] leading-none font-bold text-ayc-slate">
                NOT ON SALE
              </span>
            )}
          </span>
          <span className="truncate font-mono text-[10px] text-ayc-slate">
            {perMonthText(plan.priceCentavos, plan.days)}
          </span>
        </Link>
      </TableCell>
      <TableCell className="hidden px-0 text-[13px] wide:table-cell">{period}</TableCell>
      <TableCell className="px-0 text-sm font-extrabold">
        {formatPeso(plan.priceCentavos)}
      </TableCell>
      <TableCell className="pr-3.5 pl-0">
        <PlanOnSaleSwitch planId={plan.id} checked={plan.onSale} title={title} action={setOnSale} />
      </TableCell>
    </TableRow>
  );
}
