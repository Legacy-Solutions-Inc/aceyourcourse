// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseServerEnv } from "@/env.server";
import { parseEnv } from "@/env";

import { e2eServerEnv } from "./e2e-server-env";

// The env playwright.config.ts gives the e2e server (ticket 16). By default,
// on the developer's machine, it runs on the in-memory sample data, with every
// hosted value from .env blanked. With the PLAYWRIGHT_* values for a local
// Supabase (CI), it runs live on that one, and on nothing else.

const LOCAL = {
  PLAYWRIGHT_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  PLAYWRIGHT_SUPABASE_URL: "http://127.0.0.1:54321",
  PLAYWRIGHT_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local",
  PLAYWRIGHT_SUPABASE_SECRET_KEY: "sb_secret_local",
};
const BLANKED = {
  DATABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  SUPABASE_SECRET_KEY: "",
};

describe("e2eServerEnv", () => {
  it("runs on the in-memory sample data with no PLAYWRIGHT_* set, blanking every hosted value", () => {
    expect(e2eServerEnv({})).toEqual({ mode: "sample", env: BLANKED });
  });

  it("ignores what the shell or .env says about the app's own variables", () => {
    const shell = {
      DATABASE_URL:
        "postgresql://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_hosted",
    };
    expect(e2eServerEnv(shell)).toEqual({ mode: "sample", env: BLANKED });
  });

  it("runs live on a local Supabase with every PLAYWRIGHT_* value set", () => {
    expect(e2eServerEnv(LOCAL)).toEqual({
      mode: "live",
      env: {
        DATABASE_URL: LOCAL.PLAYWRIGHT_DATABASE_URL,
        NEXT_PUBLIC_SUPABASE_URL: LOCAL.PLAYWRIGHT_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: LOCAL.PLAYWRIGHT_SUPABASE_PUBLISHABLE_KEY,
        SUPABASE_SECRET_KEY: LOCAL.PLAYWRIGHT_SUPABASE_SECRET_KEY,
      },
    });
  });

  it.each([
    [
      "PLAYWRIGHT_DATABASE_URL",
      "postgresql://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
    ],
    ["PLAYWRIGHT_SUPABASE_URL", "https://abc.supabase.co"],
    ["PLAYWRIGHT_SUPABASE_URL", "not a url"],
  ])("refuses %s naming a host that isn't local, without printing it", (name, value) => {
    expect(() => e2eServerEnv({ ...LOCAL, [name]: value })).toThrow(
      new Error(
        `${name} must point at this machine (localhost or 127.0.0.1). The e2e run stopped.`,
      ),
    );
  });

  it("refuses some PLAYWRIGHT_* values without the rest", () => {
    expect(() => e2eServerEnv({ PLAYWRIGHT_DATABASE_URL: LOCAL.PLAYWRIGHT_DATABASE_URL })).toThrow(
      "Set all of PLAYWRIGHT_DATABASE_URL, PLAYWRIGHT_SUPABASE_URL, PLAYWRIGHT_SUPABASE_PUBLISHABLE_KEY and PLAYWRIGHT_SUPABASE_SECRET_KEY for a live run, or none. Missing: PLAYWRIGHT_SUPABASE_URL, PLAYWRIGHT_SUPABASE_PUBLISHABLE_KEY, PLAYWRIGHT_SUPABASE_SECRET_KEY.",
    );
  });

  it("treats an empty PLAYWRIGHT_* value as unset", () => {
    expect(e2eServerEnv({ PLAYWRIGHT_DATABASE_URL: "" }).mode).toBe("sample");
  });
});

describe("the blanked values on the e2e server", () => {
  let dir: string | undefined;
  const saved = { ...process.env };

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    for (const name of Object.keys(BLANKED)) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  it("stay blank when Next loads a .env with hosted values: Next never replaces a set variable", () => {
    dir = mkdtempSync(path.join(tmpdir(), "e2e-env-"));
    writeFileSync(
      path.join(dir, ".env"),
      [
        "DATABASE_URL=postgresql://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
        "NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_hosted",
        "SUPABASE_SECRET_KEY=sb_secret_hosted",
      ].join("\n"),
    );
    Object.assign(process.env, e2eServerEnv({}).env);
    // Next's own loader, as `next dev` runs it (next depends on @next/env).
    const fromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
    const { loadEnvConfig } = fromNext("@next/env") as {
      loadEnvConfig(dir: string, dev: boolean, log: object, forceReload: boolean): unknown;
    };
    loadEnvConfig(dir, true, { info: () => {}, error: () => {} }, true);

    for (const name of Object.keys(BLANKED)) expect(process.env[name]).toBe("");
  });

  it("read as unset in the app's env schemas, so the Admin runs on sample data", () => {
    const { env } = e2eServerEnv({});
    expect(parseEnv(env)).toMatchObject({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    });
    expect(parseServerEnv(env)).toMatchObject({
      DATABASE_URL: undefined,
      SUPABASE_SECRET_KEY: undefined,
    });
  });
});
