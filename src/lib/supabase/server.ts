import type { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { config } from "@/config";
import { env } from "@/env";

export function createClient(cookieStore: ReturnType<typeof cookies>): SupabaseClient {
  return createServerClient(config.supabase.url!, config.supabase.anonKey!, {
    cookieOptions: {
      name: "sb",
      path: "/",
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    },
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
