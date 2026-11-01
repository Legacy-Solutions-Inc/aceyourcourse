import { isAdminPath } from "@/lib/session-routes";
import { paths } from "@/paths";

/** Admin screens that make no sense to return to after signing in. */
const NOT_A_DESTINATION = new Set([paths.admin.signIn(), paths.admin.denied()]);

// A throwaway origin to resolve `next` against. A value that resolves to any
// other origin (https://…, //…, /\…) named another site.
const BASE = "http://admin.invalid";

/**
 * Pure: the sanitised `next` for after sign-in. Only a path inside the Admin is
 * kept, with its search string; anything else, including another Surface, a
 * path that climbs out with "..", and the sign-in and 403 screens themselves,
 * falls back to the Overview.
 */
export function safeAdminNext(next: unknown): string {
  const overview = paths.admin.overview;
  if (typeof next !== "string" || !next.startsWith("/")) return overview;

  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return overview;
  }
  // URL resolves "..", "%2e%2e", backslashes and stray tabs the way a browser
  // would, so the checks below see the path the browser would really open.
  if (url.origin !== BASE || !isAdminPath(url.pathname)) return overview;
  if (NOT_A_DESTINATION.has(url.pathname.replace(/\/$/, ""))) return overview;
  return `${url.pathname}${url.search}`;
}
