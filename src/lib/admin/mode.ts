import "server-only";

import { isSupabaseConfigured } from "@/config";
import { env } from "@/env";
import { isDatabaseConfigured } from "@/env.server";

/**
 * How the Admin runs (CONVENTIONS §1):
 * - "sample": every screen works on the in-memory sample data, and Staff sign
 *   in from the development-only "Sign in as" list.
 * - "closed": every /admin route and development-only route answers 404, and
 *   every Admin Server Action refuses.
 *
 * Ticket 16 adds "live" (the database and Google sign-in through Supabase).
 */
export type AdminMode = "sample" | "closed";

export interface AdminModeInputs {
  nodeEnv: string | undefined;
  databaseConfigured: boolean;
  supabaseConfigured: boolean;
}

/**
 * Pure: the Stage A rule. Sample data everywhere but production, where the
 * Admin stays closed until Stage B. The database and Supabase are ignored, even
 * when .env sets them.
 */
export function computeAdminMode({ nodeEnv }: AdminModeInputs): AdminMode {
  return nodeEnv === "production" ? "closed" : "sample";
}

/** The mode this server runs in. NODE_ENV is fixed for a given build. */
export const adminMode = computeAdminMode({
  nodeEnv: env.NODE_ENV,
  databaseConfigured: isDatabaseConfigured,
  supabaseConfigured: isSupabaseConfigured,
});
