import { afterEach, describe, expect, it, vi } from "vitest";

import { computeAdminMode } from "./mode";

// Until ticket 16 (CONVENTIONS §1): the Admin runs on sample data everywhere
// but production, where it stays closed, and "Sign in as" never reaches a
// database that isn't on this machine. Supabase doesn't count yet: ticket 16
// adds the "live" mode that uses it.
describe("computeAdminMode", () => {
  it.each(["development", "test", undefined])("is sample when NODE_ENV is %s", (nodeEnv) => {
    expect(computeAdminMode({ nodeEnv, database: "none", supabaseConfigured: false })).toBe(
      "sample",
    );
  });

  it("is closed in production", () => {
    expect(
      computeAdminMode({
        nodeEnv: "production",
        database: "none",
        supabaseConfigured: false,
      }),
    ).toBe("closed");
  });

  it.each([
    ["none", true],
    ["local", false],
    ["local", true],
  ] as const)(
    "is sample in development on sample data or a local database (%s), whatever Supabase (%s)",
    (database, supabaseConfigured) => {
      expect(computeAdminMode({ nodeEnv: "development", database, supabaseConfigured })).toBe(
        "sample",
      );
      expect(computeAdminMode({ nodeEnv: "production", database, supabaseConfigured })).toBe(
        "closed",
      );
    },
  );

  it.each(["development", "test", "production"])(
    "is closed with a database that isn't on this machine (NODE_ENV %s)",
    (nodeEnv) => {
      expect(computeAdminMode({ nodeEnv, database: "elsewhere", supabaseConfigured: false })).toBe(
        "closed",
      );
    },
  );
});

describe("adminMode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("follows NODE_ENV with a local database URL set", async () => {
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

  it("stays closed in development with a hosted database URL", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
    );
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    expect((await import("./mode")).adminMode).toBe("closed");
  });
});
