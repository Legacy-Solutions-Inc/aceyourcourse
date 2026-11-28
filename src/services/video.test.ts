// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { computeVideoMode, sampleVideoFake, videoMode, videoService } from "./video";

// The video service selector (Phase 5, ticket 02; spec, Phase 5 planning
// decisions → The VdoCipher key decides): sample mode has the fake; anywhere
// else VDOCIPHER_API_SECRET decides, VdoCipher when set and none when not.
// The secret is server-only: never NEXT_PUBLIC_, never in a client module.

const SECRET = "fake-vdocipher-secret-test-only";

describe("computeVideoMode", () => {
  it("uses the fake in sample mode, whatever the key", () => {
    expect(computeVideoMode({ adminMode: "sample", apiSecret: undefined })).toBe("fake");
    expect(computeVideoMode({ adminMode: "sample", apiSecret: SECRET })).toBe("fake");
  });

  it.each(["live", "closed"] as const)("uses VdoCipher with the key in %s mode", (mode) => {
    expect(computeVideoMode({ adminMode: mode, apiSecret: SECRET })).toBe("vdocipher");
  });

  it.each([
    ["no key", undefined],
    ["an empty key", ""],
    ["a blank key", "   "],
  ])("is off with %s", (_case, apiSecret) => {
    expect(computeVideoMode({ adminMode: "live", apiSecret })).toBe("off");
  });
});

describe("this server's video service", () => {
  it("is the fake in the tests' sample mode, one shared fake", () => {
    expect(videoMode).toBe("fake");
    expect(videoService()?.kind).toBe("fake");
    expect(sampleVideoFake()).toBe(videoService());
  });
});

/** Tracked files plus new ones not yet added, without ignored files (.env), docs and planning notes. */
function repoFiles(): string[] {
  const listed = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  );
  return listed
    .split("\0")
    .filter(
      (file) =>
        file && !file.startsWith("docs/") && !file.startsWith(".scratch/") && existsSync(file),
    );
}

describe("the VdoCipher secret", () => {
  // Spelled in parts so this file doesn't match itself.
  const NAME = ["VDOCIPHER", "API", "SECRET"].join("_");

  it("is never given a NEXT_PUBLIC_ name", () => {
    const publicName = new RegExp(`NEXT_PUBLIC_\\w*${"VDOCIPHER"}`);
    expect(repoFiles().filter((file) => publicName.test(readFileSync(file, "utf8")))).toEqual([]);
  });

  it("is read only by the server env, and the modules that use it are server-only", () => {
    const readers = repoFiles().filter(
      (file) =>
        /\.(ts|tsx)$/.test(file) && readFileSync(file, "utf8").includes(`process.env.${NAME}`),
    );
    expect(readers).toEqual(["src/env.server.ts"]);
    for (const file of [
      "src/env.server.ts",
      "src/services/video.ts",
      "src/lib/vdocipher/client.ts",
    ]) {
      expect(readFileSync(file, "utf8")).toMatch(/^import "server-only";$/m);
    }
  });

  it("is imported by no client module", () => {
    const clientModules = repoFiles().filter(
      (file) =>
        /\.(ts|tsx)$/.test(file) && /^["']use client["'];?$/m.test(readFileSync(file, "utf8")),
    );
    const serverOnly = /from "@\/(services\/video"|lib\/vdocipher\/client"|env\.server")/;
    expect(clientModules.filter((file) => serverOnly.test(readFileSync(file, "utf8")))).toEqual([]);
  });
});
