import { drizzle } from "drizzle-orm/postgres-js";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/connect";
import * as schema from "@/lib/db/schema";
import { describeWithDatabase, openTestDatabase } from "@/lib/db/test-database";
import { resetSampleStore } from "@/services/mock/sample-store";

import { loadTestCatalogue } from "../../test/catalogue-database";
import { cachedTags, clearFakeCache, fakeNextCache } from "../../test/fake-next-cache";

// The Catalogue seam caches the database arm's reads exactly as the sample
// arm's (catalogue.cache.test.ts): with the same tags, served from the cache
// until an Admin save clears a tag they carry. Here Next's data cache is a
// fake that honours tags. Skips, saying why, without TEST_DATABASE_URL.

vi.mock("next/cache", async () => (await import("../../test/fake-next-cache")).fakeNextCache);

const testDb = vi.hoisted(() => ({ current: undefined as Database | undefined }));

vi.mock("@/lib/db/client", () => ({
  getDb: () => {
    if (!testDb.current) throw new Error("No test database: this suite should have been skipped.");
    return testDb.current;
  },
}));

const database = await openTestDatabase();
if (database.sql) testDb.current = drizzle(database.sql, { schema });

function db(): Database {
  if (!testDb.current) throw new Error("No test database: this suite should have been skipped.");
  return testDb.current;
}

/** The seam with the database arm selected. */
async function seam() {
  vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL);
  return import("./catalogue");
}

const NEW_EMAIL = "hello@aceyourcourse.ph";
const SEED_EMAIL = "aceyourcourseinc@gmail.com";

describeWithDatabase("catalogue seam on the database: cached reads", database, () => {
  beforeAll(async () => {
    await loadTestCatalogue(db());
  });

  beforeEach(async () => {
    clearFakeCache();
    await loadTestCatalogue(db());
  });

  it("tags a read with catalogue and the areas it reads, as on the sample arm", async () => {
    await (await seam()).listExams();
    expect(cachedTags().map((entry) => [...entry].sort())).toEqual([
      ["catalogue", "catalogue:exams", "catalogue:products"],
    ]);
  });

  it("serves a cached read until its tag is cleared", async () => {
    const { getWebsiteSettings } = await seam();
    expect((await getWebsiteSettings()).contactEmail).toBe(SEED_EMAIL);
    await db().update(schema.websiteSettings).set({ contactEmail: NEW_EMAIL });

    expect((await getWebsiteSettings()).contactEmail).toBe(SEED_EMAIL);
    fakeNextCache.revalidateTag("catalogue:products");
    expect((await getWebsiteSettings()).contactEmail).toBe(SEED_EMAIL);
    fakeNextCache.revalidateTag("catalogue:settings");
    expect((await getWebsiteSettings()).contactEmail).toBe(NEW_EMAIL);
  });

  it("reads the database afresh after a restart in development, when a reseed cleared no tag", async () => {
    const { getWebsiteSettings } = await seam();
    await getWebsiteSettings();
    // As `pnpm db:reset` or `pnpm catalogue:seed` would, with no tag cleared.
    await db().update(schema.websiteSettings).set({ contactEmail: NEW_EMAIL });
    expect((await getWebsiteSettings()).contactEmail).toBe(SEED_EMAIL);

    // A restart (or Reset) starts a new generation of the development data.
    resetSampleStore();
    expect((await getWebsiteSettings()).contactEmail).toBe(NEW_EMAIL);
  });
});
