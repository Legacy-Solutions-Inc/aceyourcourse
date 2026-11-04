import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * The Supabase session cookie, as every server-side client writes and reads
 * it: the server client (src/lib/supabase/server.ts), the middleware's
 * refresh, and the live-mode e2e sign-in, which writes the same cookie into
 * the browser. `secure` follows NODE_ENV where it's used.
 */
export const SESSION_COOKIE: Omit<CookieOptionsWithName, "secure"> = {
  name: "sb",
  path: "/",
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 7,
};
