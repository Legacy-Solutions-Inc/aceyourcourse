// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  type ClientBundleCheckInputs,
  clientOutputLeaks,
  isClientOutput,
  runClientBundleCheck,
  serverOnlyNames,
} from "./client-bundle";

// The client bundle check (security review, Phase 5 ticket 05): after
// `pnpm build`, `pnpm check:bundle` reads what a browser can receive (the
// static chunks, and the pages Next prerendered) for any server-only
// variable's name, and for the value of any set in the shell that's long
// enough to be a secret.

describe("serverOnlyNames", () => {
  it("reads every server-only variable from src/env.server.ts, as the runbook lists them", () => {
    // A variable added to src/env.server.ts is added here, and to the runbook's table.
    expect(serverOnlyNames(readFileSync("src/env.server.ts", "utf8"))).toEqual([
      "ADMIN_PASSWORD_SIGN_IN",
      "CRON_SECRET",
      "DATABASE_URL",
      "MEMBER_APP_LIVE",
      "PAYMONGO_SECRET_KEY",
      "PAYMONGO_WEBHOOK_SECRET",
      "SUPABASE_SECRET_KEY",
      "VDOCIPHER_API_SECRET",
    ]);
  });

  it("reads only the variables the schema is given, not ones named in comments", () => {
    const source = [
      "// Never NEXT_PUBLIC_, and never DATABASE_URL in a client module.",
      "export const serverEnv = parseServerEnv({",
      "  ONE_SECRET: process.env.ONE_SECRET,",
      "  TWO_KEY: process.env.TWO_KEY,",
      "});",
    ].join("\n");
    expect(serverOnlyNames(source)).toEqual(["ONE_SECRET", "TWO_KEY"]);
  });
});

describe("isClientOutput", () => {
  it.each([
    ".next/static/chunks/app/layout-1a2b.js",
    ".next/static/css/app.css",
    ".next/static/media/font.woff2",
    ".next/server/app/index.html",
    ".next/server/app/products/psad.rsc",
    ".next/server/app/about.body",
    ".next/server/pages/404.html",
  ])("reads %s, which a browser can receive", (file) => {
    expect(isClientOutput(file)).toBe(true);
  });

  it.each([
    ".next/server/app/page.js",
    ".next/server/chunks/123.js",
    ".next/server/middleware.js",
    ".next/cache/fetch-cache/abc",
    ".next/trace",
  ])("leaves %s, which stays on the server", (file) => {
    expect(isClientOutput(file)).toBe(false);
  });
});

describe("clientOutputLeaks", () => {
  const names = ["CRON_SECRET", "DATABASE_URL", "VDOCIPHER_API_SECRET"];

  it("finds nothing in output that names no server-only variable", () => {
    const files = [{ file: ".next/static/chunks/a.js", text: 'const url="https://x.supabase.co"' }];
    expect(clientOutputLeaks(files, names, {})).toEqual([]);
  });

  it("finds a server-only name in a chunk, saying where", () => {
    const files = [
      { file: ".next/static/chunks/a.js", text: "fine" },
      { file: ".next/static/chunks/b.js", text: "e.env.VDOCIPHER_API_SECRET" },
    ];
    expect(clientOutputLeaks(files, names, {})).toEqual([
      { file: ".next/static/chunks/b.js", name: "VDOCIPHER_API_SECRET", found: "name" },
    ]);
  });

  it("matches whole names only: another variable that ends the same isn't one", () => {
    const files = [{ file: ".next/static/chunks/a.js", text: "TEST_DATABASE_URL" }];
    expect(clientOutputLeaks(files, names, {})).toEqual([]);
  });

  it("finds a set secret's value in a prerendered page, without giving the value back", () => {
    const secret = "a-secret-value-long-enough-to-matter";
    const files = [{ file: ".next/server/app/index.html", text: `<p>${secret}</p>` }];
    const leaks = clientOutputLeaks(files, names, { CRON_SECRET: secret });
    expect(leaks).toEqual([
      { file: ".next/server/app/index.html", name: "CRON_SECRET", found: "value" },
    ]);
    expect(JSON.stringify(leaks)).not.toContain(secret);
  });

  it("doesn't look for values too short to be a secret, or unset", () => {
    const files = [{ file: ".next/static/chunks/a.js", text: 'x="true";y=""' }];
    expect(clientOutputLeaks(files, names, { CRON_SECRET: "true", DATABASE_URL: "" })).toEqual([]);
  });
});

describe("runClientBundleCheck", () => {
  const ENV_SERVER = [
    "  CRON_SECRET: process.env.CRON_SECRET,",
    "  DATABASE_URL: process.env.DATABASE_URL,",
  ].join("\n");

  /** The check over a build of `files` (path → contents), recording what it prints. */
  function check(files: Record<string, string> | null, env: ClientBundleCheckInputs["env"] = {}) {
    const printed: { log: string[]; error: string[] } = { log: [], error: [] };
    const exitCode = runClientBundleCheck({
      builtFiles: () => (files ? Object.keys(files) : null),
      read: (file) => files?.[file] ?? "",
      envServerSource: ENV_SERVER,
      env,
      log: (line) => printed.log.push(line),
      error: (line) => printed.error.push(line),
    });
    return { exitCode, ...printed };
  }

  it("passes a build whose client output names nothing server-only, counting what it read", () => {
    const result = check({
      ".next/static/chunks/a.js": "fine",
      ".next/server/app/index.html": "<p>Home</p>",
      ".next/server/chunks/1.js": "process.env.DATABASE_URL",
    });
    expect(result).toEqual({
      exitCode: 0,
      log: [
        "No server-only variable's name or secret value in the client output: 2 files checked for 2 names.",
      ],
      error: [],
    });
  });

  it("fails a build with a server-only name in a chunk, naming the file and the variable", () => {
    const result = check({ ".next/static/chunks/a.js": "e.env.CRON_SECRET" });
    expect(result).toEqual({
      exitCode: 1,
      log: [],
      error: [".next/static/chunks/a.js: names CRON_SECRET"],
    });
  });

  it("fails a build holding a secret's value, never printing the value", () => {
    const secret = "postgresql://postgres:password@db.example.com:6543/postgres";
    const result = check({ ".next/server/app/index.html": secret }, { DATABASE_URL: secret });
    expect(result.exitCode).toBe(1);
    expect(result.error).toEqual([".next/server/app/index.html: holds the value of DATABASE_URL"]);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("fails when there's no build to read, saying to build first", () => {
    expect(check(null)).toEqual({
      exitCode: 1,
      log: [],
      error: ["There's no build in .next: run pnpm build first."],
    });
  });
});
