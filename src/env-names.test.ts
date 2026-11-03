// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// The Supabase key names (spec Phase 2: Keys). The anon key was renamed to the
// publishable key with no fallback, so the old name must not survive anywhere,
// and the secret key stays server-only. Names are spelled in parts so this file
// doesn't match itself.
const OLD_KEY_NAME = ["NEXT_PUBLIC_SUPABASE", "ANON", "KEY"].join("_");
const PUBLIC_SECRET = new RegExp(["NEXT_PUBLIC_", "\\w*SECRET"].join(""));
const SECRET_KEY_NAME = ["SUPABASE", "SECRET", "KEY"].join("_");

// docs/ holds the spec, the ADRs and past plans: read-only records that name
// the old key to describe the rename. .scratch/ holds planning notes.
const SKIPPED = ["docs/", ".scratch/"];

/** Tracked files plus new ones not yet added, without ignored files (.env). */
function repoFiles(): string[] {
  const listed = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  );
  return listed
    .split("\0")
    .filter((file) => file && !SKIPPED.some((dir) => file.startsWith(dir)) && existsSync(file));
}

function filesContaining(pattern: string | RegExp): string[] {
  return repoFiles().filter((file) => {
    const text = readFileSync(file, "utf8");
    return typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);
  });
}

describe("Supabase key names", () => {
  it("leaves no file using the old anon key name", () => {
    expect(filesContaining(OLD_KEY_NAME)).toEqual([]);
  });

  it("never gives a secret a NEXT_PUBLIC_ name, which would ship it to the browser", () => {
    expect(filesContaining(PUBLIC_SECRET)).toEqual([]);
  });

  it("keeps the secret key out of the public env schema", () => {
    const declares = new RegExp(
      `(^\\s*${SECRET_KEY_NAME}:|process\\.env\\.${SECRET_KEY_NAME})`,
      "m",
    );
    expect(readFileSync("src/env.ts", "utf8")).not.toMatch(declares);
    expect(readFileSync("src/env.server.ts", "utf8")).toMatch(declares);
  });

  it("marks the server env server-only, so a client import fails the build", () => {
    expect(readFileSync("src/env.server.ts", "utf8")).toMatch(/^import "server-only";$/m);
  });

  it("imports the server env from no client module", () => {
    const clientModules = repoFiles().filter(
      (file) =>
        /^src\/.*\.tsx?$/.test(file) && /^["']use client["'];?$/m.test(readFileSync(file, "utf8")),
    );
    expect(clientModules.length).toBeGreaterThan(0);
    expect(
      clientModules.filter((file) =>
        /from ["']@\/env\.server["']/.test(readFileSync(file, "utf8")),
      ),
    ).toEqual([]);
  });

  // Ticket 17: the secret-key Storage client. `import "server-only"` makes
  // `next build` fail should a client module ever import it; the build is
  // also checked by hand for the key's value in .next/static.
  it("keeps the secret-key Storage client server-only, and out of every client module", () => {
    const storageModules = ["src/lib/supabase/admin.ts", "src/services/uploads.storage.ts"];
    for (const file of storageModules) {
      expect(readFileSync(file, "utf8"), file).toMatch(/^import "server-only";$/m);
    }
    expect(readFileSync("src/lib/supabase/admin.ts", "utf8")).toMatch(
      new RegExp(`serverEnv\\.${SECRET_KEY_NAME}`),
    );

    const imports =
      /from ["']@\/(lib\/supabase\/admin|services\/uploads\.storage|lib\/catalogue-seed\/photos)["']/;
    const clientModules = repoFiles().filter(
      (file) =>
        /^src\/.*\.tsx?$/.test(file) && /^["']use client["'];?$/m.test(readFileSync(file, "utf8")),
    );
    expect(clientModules.filter((file) => imports.test(readFileSync(file, "utf8")))).toEqual([]);
  });
});

// Ticket 18: the docs list every variable the app reads, so the production
// runbook's Vercel list and a new .env can't miss one.
describe("the documented environment", () => {
  /** Every variable src/env.ts and src/env.server.ts validate (`NAME: process.env.NAME`). */
  const appVariables = ["src/env.ts", "src/env.server.ts"]
    .flatMap((file) => [
      ...readFileSync(file, "utf8").matchAll(/^\s*([A-Z0-9_]+): process\.env\.\1,$/gm),
    ])
    .map((match) => match[1] ?? "")
    // NODE_ENV and NEXT_PUBLIC_VERCEL_URL are set by Next and Vercel, never by hand.
    .filter((name) => name !== "NODE_ENV" && name !== "NEXT_PUBLIC_VERCEL_URL");

  /** A Markdown section: from its heading to the next heading of the same level. */
  function section(markdown: string, heading: string): string {
    const start = markdown.indexOf(`${heading}\n`);
    expect(start, heading).toBeGreaterThanOrEqual(0);
    const next = markdown.indexOf("\n## ", start + heading.length);
    return markdown.slice(start, next === -1 ? undefined : next);
  }

  it("finds the variables the app reads", () => {
    expect(appVariables).toEqual(
      expect.arrayContaining(["DATABASE_URL", SECRET_KEY_NAME, "NEXT_PUBLIC_SITE_URL"]),
    );
  });

  it("lists every one in .env.example", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(appVariables.filter((name) => !new RegExp(`^#? ?${name}=`, "m").test(example))).toEqual(
      [],
    );
  });

  it("lists every one in the README's environment table", () => {
    const table = section(readFileSync("README.md", "utf8"), "## Environment variables");
    expect(appVariables.filter((name) => !table.includes(`| \`${name}\``))).toEqual([]);
  });

  it("lists every one in the production runbook's Vercel step", () => {
    const step = section(
      readFileSync("docs/runbooks/production.md", "utf8"),
      "## 9. Set the Vercel environment variables",
    );
    expect(appVariables.filter((name) => !step.includes(`| \`${name}\``))).toEqual([]);
  });
});
