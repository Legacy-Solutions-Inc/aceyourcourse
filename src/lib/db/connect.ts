import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/lib/db/schema";

/**
 * Opens a Drizzle connection to Postgres. The app's lazy client
 * (src/lib/db/client.ts, server-only) uses it, and so do scripts such as
 * `pnpm catalogue:seed`, which run outside Next and can't import server-only
 * modules. postgres.js connects on the first query, never here.
 */

export type Database = PostgresJsDatabase<typeof schema>;

/** How long connecting waits for Postgres to answer before the query fails, in seconds. A query on a working connection has no limit here. */
export const CONNECT_TIMEOUT_SECONDS = 10;

export interface DatabaseConnection {
  db: Database;
  /** Closes every connection, waiting a few seconds for running queries. */
  close(): Promise<void>;
}

export function connectDatabase(
  url: string,
  {
    connectTimeoutSeconds = CONNECT_TIMEOUT_SECONDS,
    max,
  }: { connectTimeoutSeconds?: number; max?: number } = {},
): DatabaseConnection {
  const client = postgres(url, {
    // REQUIRED for the Supabase transaction pooler (port 6543), which does
    // not support prepared statements.
    prepare: false,
    // An unreachable database fails the read with CONNECT_TIMEOUT instead of hanging.
    connect_timeout: connectTimeoutSeconds,
    max,
    onnotice: () => {},
  });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
