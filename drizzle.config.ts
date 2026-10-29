import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    // `db:generate` diffs the schema against the migration history and needs NO
    // database, so a harmless placeholder lets it run offline. `db:migrate` and
    // `db:studio` DO connect and require a real DATABASE_URL to be set.
    url:
      process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
