import { afterEach, describe, expect, it, vi } from "vitest";

// The seam (admin.ts) selects its arm from DATABASE_URL at import time. These
// tests import it again under each setting and check that every call is the
// database arm's when a database is configured, and the sample arm's
// otherwise. Nothing connects: the database arm only connects when called.

/** The seam and both arms, imported fresh with DATABASE_URL as given. */
async function importWithDatabaseUrl(url: string) {
  vi.stubEnv("DATABASE_URL", url);
  vi.resetModules();
  return {
    seam: await import("./admin"),
    database: (await import("./admin.db")).databaseArm,
    sample: await import("./admin.mock"),
  };
}

describe("Admin seam selector", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("makes every call on the database when DATABASE_URL is set", async () => {
    const { seam, database } = await importWithDatabaseUrl(
      "postgresql://user:pass@127.0.0.1:54322/postgres",
    );
    for (const [name, call] of Object.entries(database)) {
      expect(seam[name as keyof typeof database], name).toBe(call);
    }
  });

  it("makes every call on the sample data when DATABASE_URL is unset", async () => {
    const { seam, database, sample } = await importWithDatabaseUrl("");
    for (const name of Object.keys(database)) {
      expect(seam[name as keyof typeof database], name).toBe(sample[name as keyof typeof sample]);
    }
  });
});
