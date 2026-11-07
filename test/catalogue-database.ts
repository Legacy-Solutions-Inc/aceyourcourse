import { vi } from "vitest";

import { seedCatalogue } from "@/lib/catalogue-seed/seed";
import type { Database } from "@/lib/db/connect";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import type { CatalogueArm } from "./catalogue-contract";

/**
 * The Catalogue's database arm in the database tests (`*.db.test.ts`), which
 * run against TEST_DATABASE_URL (src/lib/db/test-database.ts). Each test file
 * mocks `@/lib/db/client` so the seam reads the test database:
 *
 *   const testDb = vi.hoisted(() => ({ current: undefined as Database | undefined }));
 *   vi.mock("@/lib/db/client", () => ({ getDb: () => testDb.current }));
 *
 * These tests replace the local database's catalogue, and leave the seed loaded.
 */

/** Replaces the test database's catalogue with the seed, or an edited copy. Throws when invalid. */
export async function loadTestCatalogue(db: Database, seed: CatalogueSeed = CATALOGUE_SEED) {
  const outcome = await seedCatalogue(db, seed);
  if (!outcome.ok) {
    const problems = outcome.reason === "invalid" ? outcome.errors.join("; ") : outcome.reason;
    throw new Error(`The test catalogue wasn't loaded: ${problems}`);
  }
}

/**
 * The database arm for describeCatalogueContract. The seam picks it when
 * DATABASE_URL is set; the mocked client points it at the test database.
 */
export function databaseArm(db: () => Database): CatalogueArm {
  return {
    name: "database",
    seam: async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL);
      return import("@/services/catalogue");
    },
    loadSeed: (seed) => loadTestCatalogue(db(), seed),
  };
}
