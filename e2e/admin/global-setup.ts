import postgres from "postgres";

import { seedCatalogue } from "../../src/lib/catalogue-seed/seed";
import { connectDatabase } from "../../src/lib/db/connect";
import { CATALOGUE_SEED } from "../../src/services/mock/catalogue";
import { SAMPLE_USERS } from "../../src/services/mock/staff";
import { LIVE, SERVER } from "../server";

import { ensurePasswordUser } from "./helpers";

// Live mode only (CI, ticket 16): before any spec, the runner's local
// Supabase gets
// - the seed and the sample staff list in its database, so the Owner can sign
//   in to reset it before each spec, as the reset route asks a Staff User to
// - each sample User as a confirmed password User, named in their identity's
//   data, where Google's profile name goes
// playwright.config.ts runs it only when e2e/server.ts says the run is live,
// and that refuses any URL that isn't on this machine.

export default async function globalSetup() {
  if (!LIVE) throw new Error("The live global setup runs only against a local Supabase.");

  const database = connectDatabase(SERVER.env.DATABASE_URL, { max: 1 });
  try {
    const outcome = await seedCatalogue(database.db, CATALOGUE_SEED);
    if (!outcome.ok) throw new Error(`The seed wasn't loaded (${outcome.reason}).`);
  } finally {
    await database.close();
  }

  for (const { email } of SAMPLE_USERS) await ensurePasswordUser(email);

  const sql = postgres(SERVER.env.DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    for (const { email, name } of SAMPLE_USERS) {
      await sql`
        update auth.identities
        set identity_data = identity_data || jsonb_build_object('full_name', ${name}::text)
        where provider = 'email' and lower(identity_data ->> 'email') = ${email}`;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
