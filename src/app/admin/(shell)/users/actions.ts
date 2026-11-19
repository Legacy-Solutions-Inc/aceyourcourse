"use server";

import { adminAction } from "@/lib/admin/action";
import {
  addBetaTester,
  endAccess,
  extendAccess,
  forceSignOut,
  grantAccess,
  removeBetaTester,
} from "@/services/admin";
import {
  betaTesterInputSchema,
  endAccessInputSchema,
  extendAccessInputSchema,
  forceSignOutInputSchema,
  grantAccessInputSchema,
} from "@/services/admin.schema";

// Users' Server Actions, all Owners-only (spec, Phase 3 → The beta gate, Beta
// access). Their own rules decide them, not the conflict check, so they ignore
// any expected stamp. The Staff Guard refuses an Editor here, and the seam
// refuses them again.

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

/**
 * Force sign-out (ticket 16; story 132): clears a Member's Active Device, with
 * the reason Staff Activity keeps. Their device's next Member App request
 * lands on "Session ended".
 */
export const forceSignOutMember = adminAction(
  { role: "owner", schema: forceSignOutInputSchema },
  forceSignOut,
);

/**
 * "Grant Access Pass" (ticket 17; story 131): an Exam, its days and a reason.
 * The days add from the pass's end, or from now when it has ended; an Exam
 * the Member doesn't have joins their Target Exams. The Member gets an in-app
 * notice, never an email.
 */
export const grantAccessPass = adminAction(
  { role: "owner", schema: grantAccessInputSchema },
  grantAccess,
);

/** "Extend access" (story 131): 3, 7, 14 or 30 days more on a pass the Member holds, with a reason. */
export const extendAccessPass = adminAction(
  { role: "owner", schema: extendAccessInputSchema },
  extendAccess,
);

/**
 * "End access now" (story 133j): ends the pass now, with a reason. The
 * Member sees the expired state; their progress stays.
 */
export const endAccessPass = adminAction(
  { role: "owner", schema: endAccessInputSchema },
  endAccess,
);
