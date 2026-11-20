import { describe, expect, it } from "vitest";

import { idOfOriginal, originalPath, pagePath, reviewerPdfPaths } from "./paths";

const ID = "0b9f4a5e-8d3c-4f1a-9e2b-7c6d5e4f3a21";

describe("a Reviewer PDF's files", () => {
  it("keeps its original and its pages under its id", () => {
    expect(originalPath(ID)).toBe(`${ID}/original.pdf`);
    expect(pagePath(ID, 12)).toBe(`${ID}/pages/12.webp`);
    expect(reviewerPdfPaths(ID, 2)).toEqual([
      `${ID}/original.pdf`,
      `${ID}/pages/1.webp`,
      `${ID}/pages/2.webp`,
    ]);
    expect(reviewerPdfPaths(ID, 0)).toEqual([`${ID}/original.pdf`]);
  });

  it("reads the id back from an original's path, and from nothing else", () => {
    expect(idOfOriginal(originalPath(ID))).toBe(ID);
    expect(idOfOriginal(pagePath(ID, 1))).toBeNull();
    expect(idOfOriginal(`../${ID}/original.pdf`)).toBeNull();
    expect(idOfOriginal(`${ID.toUpperCase()}/original.pdf`)).toBeNull();
    expect(idOfOriginal("uploads/abc")).toBeNull();
  });
});
