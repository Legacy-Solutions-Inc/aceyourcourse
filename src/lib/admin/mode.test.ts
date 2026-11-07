import { afterEach, describe, expect, it, vi } from "vitest";

import { computeAdminMode } from "./mode";

// CONVENTIONS §1, with ticket 16's "live": the database and Supabase both
// configured mean Google sign-in on the database, in any environment.
// Otherwise the Admin runs on sample data outside production, and "Sign in
// as" never reaches a database that isn't on this machine.
describe("computeAdminMode", () => {
  it.each(["development", "test", undefined])(
    "is sample on the in-memory data when NODE_ENV is %s",
    (nodeEnv) => {
      expect(computeAdminMode({ nodeEnv, database: "none", supabaseConfigured: false })).toBe(
        "sample",
      );
    },
  );

  it("is sample on a local database without Supabase", () => {
    expect(
      computeAdminMode({ nodeEnv: "development", database: "local", supabaseConfigured: false }),
    ).toBe("sample");
  });

  it("is sample with a placeholder Supabase and no database", () => {
    expect(
      computeAdminMode({ nodeEnv: "development", database: "none", supabaseConfigured: true }),
    ).toBe("sample");
    expect(computeAdminMode({ nodeEnv: "test", database: "none", supabaseConfigured: true })).toBe(
      "sample",
    );
  });

  it.each([
    ["development", "local"],
    ["development", "elsewhere"],
    ["test", "local"],
    ["production", "local"],
    ["production", "elsewhere"],
  ] as const)(
    "is live with the database and Supabase both configured (NODE_ENV %s, database %s)",
    (nodeEnv, database) => {
      expect(computeAdminMode({ nodeEnv, database, supabaseConfigured: true })).toBe("live");
    },
  );

  it.each([
    ["none", false],
    ["none", true],
    ["local", false],
    ["elsewhere", false],
  ] as const)(
    "is closed in production without both (database %s, Supabase %s)",
    (database, supabaseConfigured) => {
      expect(computeAdminMode({ nodeEnv: "production", database, supabaseConfigured })).toBe(
        "closed",
      );
    },
  );

  it.each(["development", "test"])(
    "is closed with a database that isn't on this machine and no Supabase (NODE_ENV %s)",
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

  async function modeWith(env: Record<string, string>) {
    // config.ts warns that production has no Supabase; keep the output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("DATABASE_URL", "");
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    vi.resetModules();
    return (await import("./mode")).adminMode;
  }

  const LOCAL = "postgres://user:secret@localhost:5432/db";
  const HOSTED =
    "postgresql://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
  const SUPABASE = {
    NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  };

  it("follows NODE_ENV with a local database URL and no Supabase", async () => {
    expect(await modeWith({ DATABASE_URL: LOCAL, NODE_ENV: "development" })).toBe("sample");
    expect(await modeWith({ DATABASE_URL: LOCAL, NODE_ENV: "production" })).toBe("closed");
  });

  it("stays closed in development with a hosted database URL and no Supabase", async () => {
    expect(await modeWith({ DATABASE_URL: HOSTED, NODE_ENV: "development" })).toBe("closed");
  });

  it("is live in development with the hosted database and Supabase, as .env has them", async () => {
    expect(await modeWith({ DATABASE_URL: HOSTED, NODE_ENV: "development", ...SUPABASE })).toBe(
      "live",
    );
  });

  it("treats empty values as unset: the e2e server's blanks give sample mode", async () => {
    expect(await modeWith({ NODE_ENV: "development" })).toBe("sample");
  });
});
