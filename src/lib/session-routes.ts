/**
 * The areas that need a Supabase session: the Member App (`/app`), the Admin
 * (`/admin`) and the OAuth callback (`/auth`). Every other route is the public
 * Website, which never makes a Supabase round trip.
 */
const SESSION_PREFIXES = ["/app", "/admin", "/auth"] as const;

/**
 * Pure: does this pathname need a session? Matches whole path segments only,
 * so "/app" and "/app/library" do, while "/application" and "/apple-icon" don't.
 */
export function needsSession(pathname: string): boolean {
  return SESSION_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
