import { seedCatalogue } from "../../src/lib/catalogue-seed/seed";
import { connectDatabase } from "../../src/lib/db/connect";
import { CATALOGUE_SEED } from "../../src/services/mock/catalogue";
import { SAMPLE_MEMBERS } from "../../src/services/mock/members";
import { SAMPLE_USERS } from "../../src/services/mock/staff";
import { LIVE, SERVER } from "../server";

import { ensurePasswordUser } from "./helpers";

// Live mode only (CI, ticket 16): before any spec, the runner's local
// Supabase gets
// - the seed and the sample staff list in its database, so the Owner can sign
//   in to reset it before each spec, as the reset route asks a Staff User to
// - each sample User and sample Member as a confirmed password User, named
//   in their identity's data, where Google's profile name goes, with the id
//   "Sign in as" gives them (so the seed's Access Passes are theirs)
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

  // Each is named as on the sample data, with the id "Sign in as" gives them.
  const emails = new Set([...SAMPLE_USERS, ...SAMPLE_MEMBERS].map(({ email }) => email));
  for (const email of emails) await ensurePasswordUser(email);
}
