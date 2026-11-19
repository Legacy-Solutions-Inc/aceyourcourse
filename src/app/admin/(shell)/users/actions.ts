"use server";

import { adminAction } from "@/lib/admin/action";
import { addBetaTester, forceSignOut, removeBetaTester } from "@/services/admin";
import { betaTesterInputSchema, forceSignOutInputSchema } from "@/services/admin.schema";

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
