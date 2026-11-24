import { pesoText } from "@/lib/admin/peso";
import { defaultPlanName, parsePlanPrice, type PlanDays } from "@/lib/plans/plan-rules";
import { periodLabel } from "@/lib/plans/plan-text";
import { paths } from "@/paths";
import type { Plan } from "@/services/admin.types";

// How the Admin's Plans & prices screen words a Plan (Phase 4, ticket 01;
// spec, Phase 4 → Plans; BUILD-MAP §3.8). The duration and per-month figure
// read as they do on the Member's Plans page: src/lib/plans/plan-text.ts.

/** Pure: the editor's access-period option, "3 months · 90 days". */
export const accessPeriodLabel = (days: PlanDays) => `${periodLabel(days)} · ${days} days`;

/** Pure: the preview's tag, "CE · 3 MONTHS". */
export const planPreviewTag = (examCode: string, days: PlanDays) =>
  `${examCode} · ${periodLabel(days).toUpperCase()}`;

/** What the Plans & prices screen's address picks: the Exam chip (null for ALL) and the selected Plan. */
export interface PlansSelection {
  exam: string | null;
  /** A Plan's id, "new" for the new Plan's editor, or null. */
  plan: string | null;
}

const MAX_PARAM = 100;

/** Pure: the selection a Plans & prices address carries. */
export function parsePlansParams(
  params: Record<string, string | string[] | undefined>,
): PlansSelection {
  const value = (key: string) => {
    const raw = params[key];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, MAX_PARAM) || null;
  };
  return { exam: value("exam")?.toUpperCase() ?? null, plan: value("plan") };
}

/** Pure: the Plans & prices address for a selection. */
export function plansHref({ exam, plan }: PlansSelection): string {
  const params = new URLSearchParams();
  if (exam) params.set("exam", exam.toLowerCase());
  if (plan) params.set("plan", plan);
  const search = params.toString();
  return search ? `${paths.admin.plans}?${search}` : paths.admin.plans;
}

/** The Plans & prices editor's values: its fields as the form holds them. */
export interface PlanFormValues {
  [field: string]: unknown;
  name: string;
  examCode: string;
  /** The access period's option: "30", "90", "180" or "365". */
  days: string;
  /** The price as typed, in pesos: "1,299". */
  price: string;
  bestValue: boolean;
  onSale: boolean;
}

/** Pure: a Plan's fields as its editor opens them. */
export const planFormValues = (plan: Plan): PlanFormValues => ({
  name: plan.name,
  examCode: plan.examCode,
  days: String(plan.days),
  price: pesoText(plan.priceCentavos),
  bestValue: plan.bestValue,
  onSale: plan.onSale,
});

/** Pure: a new Plan's fields: 30 days for the Exam, named after it, with no price, off sale. */
export const newPlanFormValues = (examCode: string): PlanFormValues => ({
  name: defaultPlanName(examCode),
  examCode,
  days: "30",
  price: "",
  bestValue: false,
  onSale: false,
});

/**
 * Pure: the price the preview shows while it's typed, in centavos, or null
 * for anything the save would refuse (the same rules: parsePlanPrice).
 */
export function previewPrice(text: string): number | null {
  const price = parsePlanPrice(text);
  return price.ok ? price.centavos : null;
}
