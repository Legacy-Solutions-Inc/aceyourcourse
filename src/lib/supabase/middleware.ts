import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { config } from "@/config";
import { env } from "@/env";
import { SESSION_COOKIE } from "@/lib/supabase/cookie-options";

type ResponseCookie = Pick<CookieOptions, "httpOnly" | "maxAge" | "priority">;

/**
 * Creates the middleware Supabase client and its pass-through response.
 *
 * `nonce`/`csp` are threaded onto the forwarded REQUEST headers (so Next.js
 * auto-nonces its framework scripts) and the CSP is set on the RESPONSE, without
 * changing the cookie-refresh behavior: each response is rebuilt from the current
 * (cookie-updated) request headers.
 *
 * `latestResponse()` is the response as it stands: ask for it after the client's
 * last call. A refresh replaces it (setAll below), so a response taken before
 * the refresh would leave the new session's cookies behind, and the browser
 * would keep sending a refresh token Supabase has already rotated (security
 * review, Phase 5 ticket 05).
 */
export function createClient(
  req: NextRequest,
  nonce: string,
  csp: string,
): {
  supabaseClient: SupabaseClient;
  latestResponse: () => NextResponse;
} {
  const buildResponse = () => {
    const headers = new Headers(req.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  let res = buildResponse();

  const supabaseClient = createServerClient(config.supabase.url!, config.supabase.publishableKey!, {
    // The server client's cookie: the refresh must update the session it reads.
    cookieOptions: { ...SESSION_COOKIE, secure: env.NODE_ENV === "production" },
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Update the request cookies (so downstream reads in this request see
        // them), rebuild the response from the updated request (re-threading the
        // nonce + CSP), then persist the refreshed cookies onto the response.
        cookiesToSet.forEach(({ name, value, options }) =>
          req.cookies.set({ name, value, ...(options as Partial<ResponseCookie>) }),
        );
        res = buildResponse();
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set({ name, value, ...(options as Partial<ResponseCookie>) }),
        );
      },
    },
  });

  return { supabaseClient, latestResponse: () => res };
}
