import type { Metadata } from "next";
import Link from "next/link";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { PlanList } from "@/components/admin/plans/plan-list";
import { PlanPanel } from "@/components/admin/plans/plan-panel";
import { requireOwner } from "@/lib/admin/guard";
import { parsePlansParams, plansHref } from "@/lib/admin/plan-view";
import { listPlansForAdmin } from "@/services/admin";

import { addPlan, removePlan, savePlan, switchPlanOnSale } from "./actions";

export const metadata: Metadata = { title: adminScreen("plans").title };

interface PlansPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Plans & prices, for Owners only (Phase 4, ticket 01; BUILD-MAP §3.8): every
 * Plan, with the Exam chip and the selected Plan in the URL, and the selected
 * Plan's editor beside them, read fresh on every request. An Editor is sent
 * to the 403 screen; the seam and the Server Actions refuse them too.
 */
export default async function PlansPage({ searchParams }: PlansPageProps) {
  const selection = parsePlansParams(await searchParams);
  const actor = await requireOwner(plansHref(selection));
  const listed = await listPlansForAdmin(actor);
  // requireOwner just let an Owner in, so the list can't refuse them.
  if (!listed.ok) throw new Error(`The Plans list refused an Owner: ${listed.error.kind}`);
  const plans = listed.value;
  const examChip = plans.exams.some(({ code }) => code === selection.exam) ? selection.exam : null;
  const opened = plans.plans.find(({ id }) => id === selection.plan) ?? null;

  return (
    <AdminScreen
      screen="plans"
      primaryAction={
        <Link
          href={plansHref({ exam: examChip, plan: "new" })}
          scroll={false}
          className="flex min-h-10 items-center border-[1.5px] bg-ayc-orange px-4 text-sm font-bold text-ayc-navy shadow-hard-sm"
        >
          + New plan
        </Link>
      }
    >
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <PlanList
          plans={plans}
          examChip={examChip}
          selected={selection.plan}
          setOnSale={switchPlanOnSale}
        />
        <PlanPanel
          selected={selection.plan}
          opened={opened}
          exams={plans.exams}
          examChip={examChip}
          actions={{ add: addPlan, save: savePlan, remove: removePlan }}
        />
      </div>
    </AdminScreen>
  );
}
