import { paths } from "@/paths";

/**
 * The areas that need a Supabase session: the Member App (`/app`), the Admin
 * (`/admin`) and the OAuth callback (`/auth`). Every other route is the public
 * Website, which never makes a Supabase round trip.
 */
const SESSION_PREFIXES = ["/app", "/admin", "/auth"] as const;

/** Pure: is the pathname this prefix, or under it? Whole path segments only. */
const isUnder = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Pure: does this pathname need a session? Matches whole path segments only,
 * so "/app" and "/app/library" do, while "/application" and "/apple-icon" don't.
 */
export function needsSession(pathname: string): boolean {
  return SESSION_PREFIXES.some((prefix) => isUnder(pathname, prefix));
}

/** Pure: is this pathname in the Admin? "/admin" and "/admin/x" are; "/administrator" isn't. */
export function isAdminPath(pathname: string): boolean {
  return isUnder(pathname, paths.admin.overview);
}
