import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { analyticsSessionReplay, authDisabled, isSupabaseConfigured } from "@/config";
import { env } from "@/env";
import { adminMode } from "@/lib/admin/mode";
import { buildCsp } from "@/lib/csp";
import { isAdminPath, needsSession } from "@/lib/session-routes";
import { createClient } from "@/lib/supabase/middleware";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Per-request CSP nonce. Edge-safe Web Crypto only (no Node Buffer).
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, {
    isDev: env.NODE_ENV !== "production",
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    // Adds `worker-src 'self' blob:` ONLY when PostHog Session Replay is on
    // (off by default). See src/config.ts and docs/adr/0007.
    sessionReplay: analyticsSessionReplay,
  });

  // Forwarded request headers carry the nonce + CSP so Next.js auto-nonces its
  // own framework scripts. A pass-through response also sets the CSP response
  // header. Every return path below applies the CSP — no path is missed.
  const passThrough = () => {
    const headers = new Headers(req.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  // The public Website needs no session: set the CSP and return before any
  // Supabase client exists, so public pages make no Supabase round trip. Only
  // the Member App, the Admin and the OAuth callback go on (see needsSession).
  if (!needsSession(pathname)) {
    return passThrough();
  }

  // Only the Admin's live mode signs Staff in through Supabase (ticket 16).
  // Sample mode has its own cookie (CONVENTIONS §1), and closed mode answers
  // 404: no round trip for /admin there.
  if (adminMode !== "live" && isAdminPath(pathname)) {
    return passThrough();
  }

  // Dev-only: no Supabase configured → auth disabled, let every request through.
  if (authDisabled) {
    return passThrough();
  }

  // Production without Supabase config: there is no client to create, so pass
  // through. Nothing is gated yet; Phase 2's Member App and Admin gates must
  // fail CLOSED here (see computeAuthDisabled in src/config.ts).
  if (!isSupabaseConfigured) {
    return passThrough();
  }

  const { supabaseClient, res } = createClient(req, nonce, csp);

  // Refreshes the session cookie on every session route. If Supabase is
  // unreachable, carry on unauthenticated rather than erroring.
  try {
    await supabaseClient.auth.getUser();
  } catch {
    // Treated as signed out; nothing is gated on the result yet.
  }

  // res already carries the nonce request headers + CSP response header.
  return res;
}

export const config = {
  // `relay` is excluded so the middleware never intercepts PostHog's same-origin
  // reverse proxy — intercepting it silently breaks ingestion (assets still
  // load, so it *looks* connected). `/relay` is kept in sync in next.config.ts
  // (rewrites) and src/instrumentation-client.ts (api_host).
  matcher: [
    "/((?!relay|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
