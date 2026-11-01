"use server";

import { adminAction } from "@/lib/admin/action";
import { setProductFlags } from "@/services/admin";
import { productFlagsInputSchema } from "@/services/admin.schema";

// The Products list's Server Actions, for any Staff User.

/**
 * An inline "Site" or "App" toggle: it always saves, with no conflict check,
 * and clears the products tag, so the Website changes on its next load.
 */
export const setProductFlag = adminAction(
  { role: "staff", schema: productFlagsInputSchema },
  async (actor, { id, ...flags }) => setProductFlags(actor, id, flags),
);
