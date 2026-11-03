import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  // Migrations live with Supabase's, named `<timestamp>_<name>.sql`, so
  // `supabase db reset` (local) and `supabase db push` (production) apply the
  // generated SQL and the hand-written SQL (the revokes, the bucket) in order.
  // drizzle-kit keeps its snapshots in `supabase/migrations/meta`.
  out: "./supabase/migrations",
  migrations: { prefix: "supabase" },
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    // `db:generate` diffs the schema against the snapshots and needs NO
    // database, so a harmless placeholder lets it run offline. `db:studio`
    // DOES connect and requires a real DATABASE_URL to be set.
    url:
      process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
