"use server";

import { adminAction } from "@/lib/admin/action";
import { addBetaTester, removeBetaTester } from "@/services/admin";
import { betaTesterInputSchema } from "@/services/admin.schema";

// Users' Server Actions, all Owners-only (spec, Phase 3 → The beta gate). The
// Beta Tester list's own rules decide them, not the conflict check, so they
// ignore any expected stamp. The Staff Guard refuses an Editor here, and the
// seam refuses them again.

/** Adds a Google email to the Beta Tester list. */
export const addTester = adminAction(
  { role: "owner", schema: betaTesterInputSchema },
  addBetaTester,
);

/** Remove: takes an email off the Beta Tester list. */
export const removeTester = adminAction(
  { role: "owner", schema: betaTesterInputSchema },
  async (actor, { email }) => removeBetaTester(actor, email),
);
