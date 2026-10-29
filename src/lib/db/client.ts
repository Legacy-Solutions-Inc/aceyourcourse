import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/env.server";
import * as schema from "@/lib/db/schema";

/**
 * Lazy Drizzle client. The connection is built on first `getDb()` call, never
 * at import/module-eval time, so `next build` (which runs with no database)
 * never opens a socket. postgres.js itself also connects lazily on first query.
 */

type Database = PostgresJsDatabase<typeof schema>;

let db: Database | undefined;

export function getDb(): Database {
  if (db) return db;

  const url = serverEnv.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — the Drizzle client requires a Postgres " +
        "connection string. The app runs on the in-memory mock by default; set " +
        "DATABASE_URL to route the service seam through the database.",
    );
  }

  // `prepare: false` is REQUIRED for the Supabase transaction pooler (port
  // 6543), which does not support prepared statements.
  const client = postgres(url, { prepare: false });
  db = drizzle(client, { schema });
  return db;
}
