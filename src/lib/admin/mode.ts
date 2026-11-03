import "server-only";

import { isSupabaseConfigured } from "@/config";
import { env } from "@/env";
import { serverEnv } from "@/env.server";
import { isLocalDatabase } from "@/lib/db/local-database";

/**
 * How the Admin runs (CONVENTIONS §1):
 * - "sample": every screen works on the sample data (in memory, or the local
 *   database when DATABASE_URL points at one), and Staff sign in from the
 *   development-only "Sign in as" list.
 * - "closed": every /admin route and development-only route answers 404, and
 *   every Admin Server Action refuses.
 *
 * Ticket 16 adds "live" (the database and Google sign-in through Supabase).
 */
export type AdminMode = "sample" | "closed";

export interface AdminModeInputs {
  nodeEnv: string | undefined;
  /** Where DATABASE_URL points: unset, this machine, or anywhere else. */
  database: "none" | "local" | "elsewhere";
  supabaseConfigured: boolean;
}

/**
 * Pure: the rule until ticket 16. Sample data everywhere but production, where
 * the Admin stays closed. "Sign in as" asks for no real sign-in, so it never
 * reaches a database that isn't on this machine: with DATABASE_URL pointing
 * elsewhere (such as the hosted one), the Admin stays closed in development
 * too. Supabase is ignored, even when .env sets it.
 */
export function computeAdminMode({ nodeEnv, database }: AdminModeInputs): AdminMode {
  if (nodeEnv === "production" || database === "elsewhere") return "closed";
  return "sample";
}

function whereDatabaseIs(url: string | undefined): AdminModeInputs["database"] {
  if (!url) return "none";
  return isLocalDatabase(url) ? "local" : "elsewhere";
}

/** The mode this server runs in. NODE_ENV is fixed for a given build. */
export const adminMode = computeAdminMode({
  nodeEnv: env.NODE_ENV,
  database: whereDatabaseIs(serverEnv.DATABASE_URL),
  supabaseConfigured: isSupabaseConfigured,
});
