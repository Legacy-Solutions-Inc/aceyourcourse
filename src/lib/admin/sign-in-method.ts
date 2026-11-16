import { z } from "zod";

import type { AdminMode } from "@/lib/admin/mode";

/**
 * How a Supabase session signed in: its `amr` claim, a list of
 * { method, timestamp }. Supabase records the method when the session starts
 * and keeps it when the token refreshes.
 */
const amrSchema = z.array(z.object({ method: z.string() }));

/** What the password box is for, for its heading: `pnpm dev`, or a deployment being tested (ticket 24). */
export type PasswordSignInPurpose = "development" | "testing";

export interface PasswordSignInInputs {
  adminMode: AdminMode;
  nodeEnv: string | undefined;
  /** ADMIN_PASSWORD_SIGN_IN (ticket 24): "true", "false", or unset. */
  passwordSwitch: "true" | "false" | undefined;
}

/**
 * Pure: where the Admin's password sign-in is allowed: live mode, under
 * `pnpm dev` (ticket 19) or, while the deployed site is tested, with the
 * ADMIN_PASSWORD_SIGN_IN switch "true" (ticket 24). The box, its action and the
 * Staff Guard all ask this, so they never disagree.
 */
export function passwordSignInPermitted({
  adminMode,
  nodeEnv,
  passwordSwitch,
}: PasswordSignInInputs): boolean {
  return adminMode === "live" && (nodeEnv === "development" || passwordSwitch === "true");
}

/**
 * Pure: whether a session's sign-in counts for the Admin (ticket 19;
 * CONVENTIONS §3). Google (`oauth`) counts everywhere; a password only where
 * the password sign-in is allowed. It fails closed: any other method (otp,
 * magiclink, anonymous, a refresh alone), or an amr that's missing or
 * unreadable, never counts.
 */
export function signInMethodCounts(amr: unknown, passwordAllowed: boolean): boolean {
  const parsed = amrSchema.safeParse(amr);
  if (!parsed.success) return false;
  const counted = passwordAllowed ? ["oauth", "password"] : ["oauth"];
  return parsed.data.some(({ method }) => counted.includes(method));
}
