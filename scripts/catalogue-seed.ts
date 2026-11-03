import { config } from "dotenv";

import { runCatalogueSeed } from "@/lib/catalogue-seed/cli";

// ─────────────────────────────────────────────────────────────────────────────
// pnpm catalogue:seed [--local | --production]
//
// Loads the Phase 1 seed into the catalogue tables, in one transaction. See
// src/lib/catalogue-seed/cli.ts for the three targets. `pnpm db:reset` runs it
// with --local after re-applying the migrations.
// ─────────────────────────────────────────────────────────────────────────────

config({ quiet: true });

process.exitCode = await runCatalogueSeed({
  args: process.argv.slice(2),
  databaseUrl: process.env.DATABASE_URL,
  log: (line) => console.log(line),
  error: (line) => console.error(line),
});
