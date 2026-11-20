import { isMemberAppPath } from "@/lib/session-routes";
import { paths } from "@/paths";

/** Member App screens that make no sense to return to after signing in. */
const NOT_A_DESTINATION = new Set([
  paths.memberApp.signIn(),
  paths.memberApp.notOpenYet,
  paths.memberApp.consent(),
  paths.memberApp.device(),
]);

// A throwaway origin to resolve `next` against. A value that resolves to any
// other origin (https://…, //…, /\…) named another site.
const BASE = "http://member-app.invalid";

/**
 * Pure: `next` as a Member App destination, or null when it isn't a path
 * inside the Member App at all (another site, another Surface, or a path that
 * climbs in or out with ".."). The path keeps its search string. The sign-in,
 * "Not open yet", consent and Active Device screens themselves are the Member
 * App's, but aren't somewhere to land, so they answer Home.
 */
export function memberAppNext(next: unknown): string | null {
  if (typeof next !== "string" || !next.startsWith("/")) return null;
  // As typed, before anything is resolved, it must already be the Member
  // App's: "/admin/../app" is an odd Admin `next`, and stays the Admin's.
  if (!isMemberAppPath(next.split(/[?#]/, 1)[0] ?? "")) return null;

  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return null;
  }
  // URL resolves "..", "%2e%2e", backslashes and stray tabs the way a browser
  // would, so the checks below see the path the browser would really open.
  if (url.origin !== BASE || !isMemberAppPath(url.pathname)) return null;
  if (NOT_A_DESTINATION.has(url.pathname.replace(/\/$/, ""))) return paths.memberApp.home;
  return `${url.pathname}${url.search}`;
}

/** Pure: the sanitised `next` for after a Member App sign-in. Anything unsafe falls back to Home. */
export function safeMemberAppNext(next: unknown): string {
  return memberAppNext(next) ?? paths.memberApp.home;
}
