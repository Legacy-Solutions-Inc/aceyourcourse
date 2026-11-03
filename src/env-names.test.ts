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
});
