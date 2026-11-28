import { defaultPlanName } from "@/lib/plans/plan-rules";
import type { Plan } from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";

import { stableUuid } from "./stable-uuid";

// ─────────────────────────────────────────────────────────────────────────────
// The starting Plans (Phase 4, ticket 01; spec, Phase 4 → Plans): the
// mockup's prices, until the client confirms them. CE has 30 days for ₱499,
// 90 days for ₱1,299 (Best value) and 180 days for ₱2,299; every other Exam
// has 30 days for ₱449. The sample data and a local database load have them
// on sale. On the live database the starting-plans migration adds the same
// Plans switched off, until an Owner switches them on.
// ─────────────────────────────────────────────────────────────────────────────

/** Each starting Plan of CE, as [days, price in centavos, Best value]. */
const CE_PLANS = [
  [30, 49_900, false],
  [90, 129_900, true],
  [180, 229_900, false],
] as const;

/** Every other Exam's starting Plan: 30 days for ₱449. */
const OTHER_EXAM_PLAN = [30, 44_900, false] as const;

/** Pure: a starting Plan's id, the same on every restart and in the database seed. */
export const samplePlanId = (examCode: string, days: number) =>
  stableUuid(`sample-plan:${examCode}:${days}`);

/**
 * Pure: the starting Plans for the catalogue's Exams, in its Exam order: on
 * sale, as the sample data has them, or switched off, as a production load
 * adds them.
 */
export function samplePlans(catalogue: CatalogueSeed, onSale = true): Plan[] {
  return catalogue.exams.flatMap((exam) =>
    (exam.code === "CE" ? CE_PLANS : [OTHER_EXAM_PLAN]).map(
      ([days, priceCentavos, bestValue]): Plan => ({
        id: samplePlanId(exam.code, days),
        examCode: exam.code,
        name: defaultPlanName(exam.code),
        days,
        priceCentavos,
        bestValue,
        onSale,
      }),
    ),
  );
}
