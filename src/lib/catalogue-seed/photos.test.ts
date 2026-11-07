// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { storageSeedPhotos } from "./photos";

// Reading the seed's photo files (ticket 17), from a folder standing in for
// public/. Uploading them needs Storage: seed-photos.db.test.ts covers it.
// Making the client connects to nothing.

let root = "";
let publicDir = "";

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "seed-photos-"));
  publicDir = path.join(root, "public");
  await mkdir(path.join(publicDir, "products", "ce-posters"), { recursive: true });
  await writeFile(path.join(publicDir, "products", "ce-posters", "1.webp"), "a photo");
  await writeFile(path.join(root, "outside.webp"), "not the seed's");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const photos = () =>
  storageSeedPhotos({ supabaseUrl: "http://127.0.0.1:1", secretKey: "sb_secret_test", publicDir });

describe("the seed's photo files", () => {
  it("reads a photo by its src, from public/", async () => {
    const bytes = await photos().read("/products/ce-posters/1.webp");
    expect(bytes && Buffer.from(bytes).toString()).toBe("a photo");
  });

  it("is null for a file public/ doesn't have", async () => {
    expect(await photos().read("/products/ce-posters/2.webp")).toBeNull();
  });

  it("never reads outside public/", async () => {
    expect(await photos().read("/../outside.webp")).toBeNull();
  });
});
