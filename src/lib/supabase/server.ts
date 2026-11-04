import type { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { config } from "@/config";
import { env } from "@/env";
import { SESSION_COOKIE } from "@/lib/supabase/cookie-options";

export function createClient(cookieStore: ReturnType<typeof cookies>): SupabaseClient {
  return createServerClient(config.supabase.url!, config.supabase.publishableKey!, {
    cookieOptions: { ...SESSION_COOKIE, secure: env.NODE_ENV === "production" },
    cookies: {
      async getAll() {
        const store = await cookieStore;
        return store.getAll();
      },
      async setAll(cookiesToSet) {
        try {
          const store = await cookieStore;
          cookiesToSet.forEach(({ name, value, options }) =>
            store.set({ name, value, ...options }),
          );
        } catch {
          // `setAll` was called from a Server Component, where the cookie store
          // is read-only. Safe to ignore — the middleware refreshes the session.
        }
      },
    },
  });
}
