"use server";

import { adminAction } from "@/lib/admin/action";
import {
  createPlan,
  deletePlan,
  setCourseOnSale,
  setCoursePrice,
  setPlanOnSale,
  updatePlan,
} from "@/services/admin";
import {
  addPlanInputSchema,
  courseOnSaleInputSchema,
  coursePriceInputSchema,
  planIdInputSchema,
  planOnSaleInputSchema,
  savePlanInputSchema,
} from "@/services/admin.schema";

// The Plans & prices screen's Server Actions (Phase 4, ticket 01), for Owners
// only: an Editor's call is refused on the server, whatever the menu shows.
// Each one checks the input's shape; the seam checks every Plan rule, so the
// form is told each field's message.

/** "Add plan": a new Plan. */
export const addPlan = adminAction({ role: "owner", schema: addPlanInputSchema }, createPlan);

/** "Save": the editor's fields, with the conflict check against the stamp it opened with. */
export const savePlan = adminAction(
  { role: "owner", schema: savePlanInputSchema, requiresStamp: true },
  async (actor, { id, ...form }, expected) => updatePlan(actor, id, form, expected),
);

/** A list row's On sale switch: it always saves, with no conflict check. */
export const switchPlanOnSale = adminAction(
  { role: "owner", schema: planOnSaleInputSchema },
  async (actor, { id, onSale }) => setPlanOnSale(actor, id, onSale),
);

/** The editor's Delete, once confirmed: refused for a Plan that has had an Order. */
export const removePlan = adminAction(
  { role: "owner", schema: planIdInputSchema },
  async (actor, { id }) => deletePlan(actor, id),
);

/** One-time purchases (Phase 5, ticket 06): a separately sold Course's price, in whole pesos. */
export const saveCoursePrice = adminAction(
  { role: "owner", schema: coursePriceInputSchema },
  setCoursePrice,
);

/** One-time purchases: a separately sold Course's On sale switch; it always saves, with no conflict check. */
export const switchCourseOnSale = adminAction(
  { role: "owner", schema: courseOnSaleInputSchema },
  setCourseOnSale,
);
