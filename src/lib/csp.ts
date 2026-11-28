import { LOCAL_SUPABASE_URL } from "@/lib/db/local-database";
import { PAYMONGO_CHECKOUT_ORIGIN } from "@/lib/paymongo/checkout-origin";
import { VDOCIPHER_PLAYER_ORIGIN, VDOCIPHER_UPLOAD_SOURCE } from "@/lib/vdocipher/hosts";

export interface CspOptions {
  /** Dev enables 'unsafe-eval' (HMR) and local Supabase/websocket origins. */
  isDev: boolean;
  /** When set, its https + wss origins are added to connect-src. */
  supabaseUrl?: string;
  /**
   * When true, adds `worker-src 'self' blob:` for PostHog Session Replay — its
   * recorder runs in a `blob:` Web Worker, and `strict-dynamic` does NOT cover
   * `worker-src` (it falls back to `default-src`). Default `false` ⇒ no
   * `worker-src` (policy unchanged). Wired from `analyticsSessionReplay` in
   * src/config.ts via src/middleware.ts. See docs/adr/0007.
   */
  sessionReplay?: boolean;
}

/**
 * Builds an enforced, nonce-based strict Content-Security-Policy string.
 *
 * Pure function of its arguments (no `process.env` reads) so it is trivially
 * testable and identical wherever it runs. Scripts use nonce + 'strict-dynamic'
 * with NO 'unsafe-inline'; styles allow 'unsafe-inline' (shadcn/Radix set inline
 * style attributes — per Google's strict-CSP guidance).
 */
export function buildCsp(nonce: string, opts: CspOptions): string {
  const { isDev, supabaseUrl, sessionReplay } = opts;

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // HMR in dev evaluates code via eval(); never allowed in production.
    ...(isDev ? ["'unsafe-eval'"] : []),
  ];

  // The Lesson editor sends a video straight to VdoCipher's upload host
  // (Phase 5, ticket 02), never through the site.
  const connectSrc = ["'self'", VDOCIPHER_UPLOAD_SOURCE];
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      connectSrc.push(url.origin, `wss://${url.host}`);
    } catch {
      // Ignore a malformed Supabase URL — connect-src simply stays 'self'.
    }
  }
  if (isDev) {
    // Local Supabase CLI (http) + the HMR websocket.
    connectSrc.push("ws:", LOCAL_SUPABASE_URL);
  }

  // `https:` covers the hosted Storage bucket's photos. Local Supabase serves
  // them over http, so development adds its origin (ticket 17).
  const imgSrc = ["'self'", "data:", "blob:", "https:", ...(isDev ? [LOCAL_SUPABASE_URL] : [])];

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", scriptSrc],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", imgSrc],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", connectSrc],
    // Lesson videos play in VdoCipher's embedded DRM player (Phase 5, ticket
    // 02): the only frame the site embeds.
    ["frame-src", ["'self'", VDOCIPHER_PLAYER_ORIGIN]],
    ["frame-ancestors", ["'none'"]],
    // This template renders no <base> element; lock it down entirely.
    ["base-uri", ["'none'"]],
    // Pay's Server Action redirects to PayMongo's hosted checkout (ticket 04).
    // With JavaScript, Next follows it by navigating, which form-action
    // doesn't govern; without it, the form posts natively and the redirect
    // after it is checked against form-action, so PayMongo's checkout origin
    // is allowed, and nothing else off the site.
    ["form-action", ["'self'", PAYMONGO_CHECKOUT_ORIGIN]],
    ["object-src", ["'none'"]],
  ];

  // PostHog Session Replay only: its recorder spawns a `blob:` Web Worker, and
  // `strict-dynamic` does not propagate to `worker-src` (which falls back to
  // `default-src 'self'`), so blob: workers would be blocked. Added ONLY when
  // replay is enabled; default is no `worker-src` (policy byte-identical).
  if (sessionReplay) {
    directives.push(["worker-src", ["'self'", "blob:"]]);
  }

  // Force-upgrade any stray http subresource to https — production only. Omitted
  // in dev, where the app, the HMR websocket (ws:), and a local Supabase
  // (http://127.0.0.1:54321) run over http on localhost (see connect-src above)
  // and upgrading would break them. `upgrade-insecure-requests` is valueless.
  if (!isDev) {
    directives.push(["upgrade-insecure-requests", []]);
  }

  return directives
    .map(([name, values]) => (values.length ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}
