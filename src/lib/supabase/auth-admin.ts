import "server-only";

import { isAuthError } from "@supabase/supabase-js";

import { type AdminMode, adminMode } from "@/lib/admin/mode";
import { getStorage, isStorageConfigured } from "@/lib/supabase/admin";
import { createFakeAuthAdmin } from "@/services/auth-admin.fake";
import type { AuthAdmin, AuthAdminResult } from "@/services/auth-admin.types";

// ─────────────────────────────────────────────────────────────────────────────
// The real auth admin (ticket 19): deleting a Member's Supabase User, through
// Supabase Auth's admin API with the secret-key client (src/lib/supabase/
// admin.ts). The secret key bypasses everything, so this module is
// server-only and reads the key from the server env, never a NEXT_PUBLIC_
// one. Which auth admin a server uses follows the Admin's mode:
// - live: Supabase, with SUPABASE_SECRET_KEY; without it, every delete fails
//   and says why, so a deletion stays open rather than leaving a User behind;
// - sample: the fake, as "Sign in as" makes no Supabase Users;
// - closed: none (every Admin action is refused before it gets here).
// ─────────────────────────────────────────────────────────────────────────────

export const AUTH_ADMIN_NOT_CONFIGURED =
  "SUPABASE_SECRET_KEY isn't set on this server, so no Supabase User can be deleted.";

/** Supabase Auth's admin API (SupabaseClient["auth"]["admin"]): the one call deleting an account needs. */
interface AdminApi {
  deleteUser(userId: string): Promise<{ error: unknown }>;
}

/** Pure: the error message of anything thrown or answered. */
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The auth admin over Supabase Auth's admin API. A User already gone counts as deleted. */
export function supabaseAuthAdmin(api: AdminApi): AuthAdmin {
  return {
    configured: true,
    async deleteUser(userId): Promise<AuthAdminResult> {
      try {
        const { error } = await api.deleteUser(userId);
        if (!error) return { ok: true };
        if (isAuthError(error) && (error.status === 404 || error.code === "user_not_found")) {
          return { ok: true };
        }
        return { ok: false, message: messageOf(error) };
      } catch (error) {
        return { ok: false, message: messageOf(error) };
      }
    },
  };
}

/** Pure: which auth admin a server in `mode` uses, with or without the secret key. */
export function chooseAuthAdmin(
  mode: AdminMode,
  secretKeyConfigured: boolean,
): "supabase" | "sample" | "unavailable" {
  if (mode === "sample") return "sample";
  return mode === "live" && secretKeyConfigured ? "supabase" : "unavailable";
}

/** Sample mode's: there is never a Supabase User to delete. */
const SAMPLE_AUTH_ADMIN = createFakeAuthAdmin();

const UNAVAILABLE: AuthAdmin = {
  configured: false,
  async deleteUser() {
    return { ok: false, message: AUTH_ADMIN_NOT_CONFIGURED };
  },
};

/** This server's auth admin. */
export function getAuthAdmin(): AuthAdmin {
  // isStorageConfigured: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY, all the admin API needs too.
  switch (chooseAuthAdmin(adminMode, isStorageConfigured)) {
    case "supabase":
      return supabaseAuthAdmin(getStorage().client.auth.admin);
    case "sample":
      return SAMPLE_AUTH_ADMIN;
    default:
      return UNAVAILABLE;
  }
}
