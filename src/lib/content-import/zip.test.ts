import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { MAX_ZIP_BYTES } from "./limits";
import { listZipFile, readZipEntries } from "./zip";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]);

describe("listZipFile", () => {
  it("lists each file's name and size without unpacking it, folders left out", () => {
    const zip = zipSync({ "beam.png": PNG, "images/": {}, "images/truss.jpg": JPEG });

    expect(listZipFile(zip)).toEqual({
      ok: true,
      listing: {
        entries: [
          { name: "beam.png", size: PNG.byteLength },
          { name: "images/truss.jpg", size: JPEG.byteLength },
        ],
      },
    });
  });

  it("lists an empty zip", () => {
    const zip = zipSync({});
    expect(listZipFile(zip)).toEqual({ ok: true, listing: { entries: [] } });
  });

  it("refuses a file that isn't a zip", () => {
    expect(listZipFile(new TextEncoder().encode("topic,front\n"))).toEqual({
      ok: false,
      problem: "isn’t a zip file",
    });
  });

  it("refuses a zip cut short", () => {
    const zip = zipSync({ "beam.png": PNG });
    expect(listZipFile(zip.subarray(0, zip.byteLength - 10))).toEqual({
      ok: false,
      problem: "isn’t a zip file",
    });
  });

  it("refuses a zip over 200 MB before reading it", () => {
    expect(listZipFile(new Uint8Array(MAX_ZIP_BYTES + 1))).toEqual({
      ok: false,
      problem: "is over 200 MB",
    });
  });
});

describe("readZipEntries", () => {
  it("unpacks only the files asked for", () => {
    const zip = zipSync({ "a.png": PNG, "b.jpg": JPEG, "c.png": PNG });

    const files = readZipEntries(zip, ["a.png", "b.jpg"]);

    expect([...files.keys()].sort()).toEqual(["a.png", "b.jpg"]);
    expect(files.get("a.png")).toEqual(PNG);
    expect(files.get("b.jpg")).toEqual(JPEG);
  });

  it("unpacks compressed files", () => {
    const big = new Uint8Array(50_000).fill(7);
    const zip = zipSync({ "big.png": [big, { level: 9 }] });

    expect(zip.byteLength).toBeLessThan(big.byteLength);
    expect(readZipEntries(zip, ["big.png"]).get("big.png")).toEqual(big);
  });

  it("throws when a file asked for isn't in the zip", () => {
    const zip = zipSync({ "a.png": PNG });
    expect(() => readZipEntries(zip, ["missing.png"])).toThrow(/missing\.png/);
  });
});
