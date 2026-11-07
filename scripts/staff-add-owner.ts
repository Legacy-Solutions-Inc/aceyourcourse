import { config } from "dotenv";

import { runAddOwner } from "@/lib/admin/add-owner";

// ─────────────────────────────────────────────────────────────────────────────
// pnpm staff:add-owner <email>
//
// Makes the email an active Owner on the staff list of the database
// DATABASE_URL names, with a Staff Activity record by "deployment". Safe to
// run again. Run once at deployment, so the first Owner can sign in with
// Google and add everyone else in Settings. See src/lib/admin/add-owner.ts,
// and docs/runbooks/production.md (step 6).
// ─────────────────────────────────────────────────────────────────────────────

config({ quiet: true });

process.exitCode = await runAddOwner({
  args: process.argv.slice(2),
  databaseUrl: process.env.DATABASE_URL,
  log: (line) => console.log(line),
  error: (line) => console.error(line),
});
