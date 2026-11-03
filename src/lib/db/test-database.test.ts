// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { openTestDatabase } from "./test-database";

// The database tests' connection (spec Testing Decisions: database tests skip
// cleanly when local Supabase isn't running). It reads TEST_DATABASE_URL, never
// DATABASE_URL, so a test run can't switch the app's seams to the database.
describe("openTestDatabase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips, saying how to run them, when TEST_DATABASE_URL is unset", async () => {
    vi.stubEnv("TEST_DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
    const database = await openTestDatabase();
    expect(database.sql).toBeUndefined();
    expect(database.skipReason).toMatch(/^TEST_DATABASE_URL is not set\. .*pnpm db:start/);
  });

  it("skips when the database is unreachable, without printing the connection string", async () => {
    const database = await openTestDatabase("postgresql://postgres:s3cret@127.0.0.1:1/postgres");
    expect(database.sql).toBeUndefined();
    expect(database.skipReason).toMatch(/^TEST_DATABASE_URL is unreachable \(ECONNREFUSED\)\./);
    expect(database.skipReason).not.toMatch(/s3cret|127\.0\.0\.1/);
  });

  it("fails instead of skipping when TEST_DATABASE_REQUIRED is set, as in CI", async () => {
    vi.stubEnv("TEST_DATABASE_REQUIRED", "true");
    vi.stubEnv("TEST_DATABASE_URL", "");
    await expect(openTestDatabase()).rejects.toThrow(
      /^The database tests need a database: TEST_DATABASE_URL is not set\./,
    );
    await expect(
      openTestDatabase("postgresql://postgres:s3cret@127.0.0.1:1/postgres"),
    ).rejects.toThrow(/unreachable \(ECONNREFUSED\)/);
  });

  it("skips on a malformed connection string instead of throwing", async () => {
    const database = await openTestDatabase("not a connection string");
    expect(database.sql).toBeUndefined();
    expect(database.skipReason).toMatch(/^TEST_DATABASE_URL is unreachable/);
  });
});
