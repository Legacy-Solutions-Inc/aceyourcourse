import "server-only";

import { isSupabaseConfigured } from "@/config";
import { env } from "@/env";
import { serverEnv } from "@/env.server";
import { isLocalDatabase } from "@/lib/db/local-database";

/**
 * How the Admin runs (CONVENTIONS §1):
 * - "live": the database, with Staff signing in with Google through Supabase
 *   (ticket 16).
 * - "sample": every screen works on the sample data (in memory, or the local
 *   database when DATABASE_URL points at one), and Staff sign in from the
 *   development-only "Sign in as" list.
 * - "closed": every /admin route and development-only route answers 404, and
 *   every Admin Server Action refuses.
 */
export type AdminMode = "live" | "sample" | "closed";

export interface AdminModeInputs {
  nodeEnv: string | undefined;
  /** Where DATABASE_URL points: unset, this machine, or anywhere else. */
  database: "none" | "local" | "elsewhere";
  supabaseConfigured: boolean;
}

/**
 * Pure: live wherever the database and Supabase are both configured, local or
 * hosted, in any environment. Otherwise sample data everywhere but
 * production, where the Admin stays closed. "Sign in as" asks for no real
 * sign-in, so it never reaches a database that isn't on this machine: with
 * DATABASE_URL pointing elsewhere and no Supabase, the Admin stays closed in
 * development too.
 */
export function computeAdminMode({
  nodeEnv,
  database,
  supabaseConfigured,
}: AdminModeInputs): AdminMode {
  if (database !== "none" && supabaseConfigured) return "live";
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
