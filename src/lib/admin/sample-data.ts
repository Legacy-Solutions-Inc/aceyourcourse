import "server-only";

import { revalidateTag } from "next/cache";

import { serverEnv } from "@/env.server";
import { seedCatalogue } from "@/lib/catalogue-seed/seed";
import { getDb } from "@/lib/db/client";
import { isLocalDatabase } from "@/lib/db/local-database";
import { CATALOGUE_TAG } from "@/services/catalogue.tags";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { resetSampleStore } from "@/services/mock/sample-store";

export type RestoreOutcome = { ok: true } | { ok: false; reason: "not-local" };

/**
 * Starts the sample data again from the seed, as a server restart does, and
 * clears every Catalogue read cached from the old data. On the database
 * (DATABASE_URL set), it replaces the catalogue, the staff list and Staff
 * Activity with the seed and the sample Staff, as `pnpm db:reset` does, and
 * refuses any database that isn't on this machine. A development tool for the
 * header's Reset button and the Admin specs, so its callers allow it in
 * "sample" mode only.
 */
export async function restoreSampleData(): Promise<RestoreOutcome> {
  const url = serverEnv.DATABASE_URL;
  if (url) {
    if (!isLocalDatabase(url)) return { ok: false, reason: "not-local" };
    const outcome = await seedCatalogue(getDb(), CATALOGUE_SEED);
    if (!outcome.ok) throw new Error(`The sample data wasn't restored (${outcome.reason}).`);
  }
  // The uploads stay in memory until ticket 17, so they start again too.
  resetSampleStore();
  revalidateTag(CATALOGUE_TAG);
  return { ok: true };
}
