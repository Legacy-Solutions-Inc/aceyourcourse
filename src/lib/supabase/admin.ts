import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/env";
import { serverEnv } from "@/env.server";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase with the secret key (spec Phase 2: Keys), for Storage only: the
// upload seam's signed upload URLs and the clean-up of removed photos
// (src/services/uploads.storage.ts). The secret key bypasses RLS, so it stays
// on the server: this module is server-only, and reads the key from the
// server env. Data goes through Drizzle, never through this client.
// ─────────────────────────────────────────────────────────────────────────────

export const STORAGE_NOT_CONFIGURED = "Storage isn't configured on this server.";

/** A Supabase to reach Storage on, with the URL it was made for. */
export interface StorageConnection {
  client: SupabaseClient;
  supabaseUrl: string;
}

/**
 * A secret-key client for this Supabase URL. It keeps no session: the secret
 * key is the only credential, on every request.
 */
export function connectStorage(supabaseUrl: string, secretKey: string): StorageConnection {
  const client = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { client, supabaseUrl };
}

/** Whether this server has what Storage needs: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY. */
export const isStorageConfigured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && serverEnv.SUPABASE_SECRET_KEY,
);

let connection: StorageConnection | undefined;

/**
 * The server's Storage, made on first use. Throws STORAGE_NOT_CONFIGURED
 * without NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY, naming neither
 * value.
 */
export function getStorage(): StorageConnection {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = serverEnv.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error(STORAGE_NOT_CONFIGURED);
  return (connection ??= connectStorage(url, key));
}
