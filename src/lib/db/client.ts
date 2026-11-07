import "server-only";

import { serverEnv } from "@/env.server";
import { connectDatabase, type Database } from "@/lib/db/connect";

/**
 * Lazy Drizzle client. The connection is built on first `getDb()` call, never
 * at import/module-eval time, so `next build` (which runs with no database)
 * never opens a socket. postgres.js itself also connects lazily on first query,
 * and gives up after CONNECT_TIMEOUT_SECONDS when the database doesn't answer.
 */

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

  db = connectDatabase(url).db;
  return db;
}
