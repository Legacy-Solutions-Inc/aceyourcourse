import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * The Supabase session cookie, as every server-side client writes and reads
 * it: the server client (src/lib/supabase/server.ts), the middleware's
 * refresh, and the live-mode e2e sign-in, which writes the same cookie into
 * the browser. `secure` follows NODE_ENV where it's used.
 *
 * httpOnly (security review, Phase 5 ticket 05): it holds the session's
 * tokens, and only the server reads it. No page makes a browser Supabase
 * client, so no script needs it, and a script injected into a page can't
 * read it. A browser client added later would find no session: sign-in and
 * every read of the session stay on the server.
 */
export const SESSION_COOKIE: Omit<CookieOptionsWithName, "secure"> = {
  name: "sb",
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  // Not honoured: @supabase/ssr 0.6 writes its own 400 days whatever this
  // says. How long a session lasts is Supabase's setting (security review,
  // follow-up 4).
  maxAge: 60 * 60 * 24 * 7,
};
