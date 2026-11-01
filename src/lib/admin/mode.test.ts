import { afterEach, describe, expect, it, vi } from "vitest";

import { computeAdminMode } from "./mode";

// Stage A (CONVENTIONS §1): the Admin runs on sample data everywhere but
// production, where it stays closed. The database and Supabase don't count yet:
// ticket 16 adds the "live" mode that uses them.
describe("computeAdminMode", () => {
  it.each(["development", "test", undefined])("is sample when NODE_ENV is %s", (nodeEnv) => {
    expect(
      computeAdminMode({ nodeEnv, databaseConfigured: false, supabaseConfigured: false }),
    ).toBe("sample");
  });

  it("is closed in production", () => {
    expect(
      computeAdminMode({
        nodeEnv: "production",
        databaseConfigured: false,
        supabaseConfigured: false,
      }),
    ).toBe("closed");
  });

  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])(
    "ignores the database (%s) and Supabase (%s) in Stage A",
    (databaseConfigured, supabaseConfigured) => {
      expect(
        computeAdminMode({ nodeEnv: "development", databaseConfigured, supabaseConfigured }),
      ).toBe("sample");
      expect(
        computeAdminMode({ nodeEnv: "production", databaseConfigured, supabaseConfigured }),
      ).toBe("closed");
    },
  );
});

describe("adminMode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("follows NODE_ENV, even with a database URL set", async () => {
    // config.ts warns that production has no Supabase; keep the output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("DATABASE_URL", "postgres://user:secret@localhost:5432/db");
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    expect((await import("./mode")).adminMode).toBe("sample");

    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    expect((await import("./mode")).adminMode).toBe("closed");
  });
});
