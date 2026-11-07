/**
 * The local Supabase database, as the CLI's documented defaults give it: the
 * `postgres` user and password, on supabase/config.toml's [db] port. Not a
 * secret: it only reaches this machine.
 */
export const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Local Supabase's API and Storage, on supabase/config.toml's [api] port. */
export const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Pure: whether a connection string points at this machine. Null when it isn't a URL. */
export function isLocalDatabase(url: string): boolean | null {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return null;
  }
}
