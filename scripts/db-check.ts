import { config } from "dotenv";

import { runDatabaseCheck } from "@/lib/db/check";

// ─────────────────────────────────────────────────────────────────────────────
// pnpm db:check
//
// A read-only health check of the database DATABASE_URL names: the Postgres
// version, the migrations applied, deny-all on every table, the catalogue
// bucket and the catalogue counts. Exits 1 when a check fails. See
// src/lib/db/check.ts, and docs/runbooks/production.md for when to run it.
// ─────────────────────────────────────────────────────────────────────────────

config({ quiet: true });

process.exitCode = await runDatabaseCheck({
  databaseUrl: process.env.DATABASE_URL,
  log: (line) => console.log(line),
  error: (line) => console.error(line),
});
