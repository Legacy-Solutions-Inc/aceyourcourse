import { describe, expect, it } from "vitest";

import { hasFileSignature } from "./file-signature";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const ZIP = [0x50, 0x4b, 0x03, 0x04];

describe("hasFileSignature", () => {
  it.each([
    ["image/png", PNG],
    ["image/jpeg", JPEG],
    ["image/webp", WEBP],
    ["application/zip", ZIP],
  ] as const)("knows a %s by its first bytes", (type, bytes) => {
    expect(hasFileSignature(new Uint8Array(bytes), type)).toBe(true);
  });

  it.each([
    ["image/png", JPEG],
    ["image/jpeg", PNG],
    ["image/webp", [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20]],
    ["application/zip", PNG],
    ["image/png", []],
  ] as const)("refuses a %s that starts as something else", (type, bytes) => {
    expect(hasFileSignature(new Uint8Array(bytes), type)).toBe(false);
  });

  it("takes any text as a CSV, which has no signature", () => {
    expect(hasFileSignature(new TextEncoder().encode("topic,front"), "text/csv")).toBe(true);
  });
});
