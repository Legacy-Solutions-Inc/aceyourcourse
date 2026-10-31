import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { formatPeso } from "@/lib/money";
import { listProducts } from "@/services/catalogue";
import type { ProductFormat } from "@/services/catalogue.types";

import { aboutCopy, missionTabs, storyPhotos, teamPhoto } from "./about";

// About's fixed copy (docs/mockup/website/About_v2.dc.html), checked against
// the catalogue and the files it points at.

const file = (publicPath: string) => join(process.cwd(), "public", publicPath);

describe("the About photos", () => {
  it("ships each one as a self-hosted WebP of at most 250 KB, with alt text", () => {
    const photos = [teamPhoto, ...storyPhotos];
    expect(photos).toHaveLength(4);
    for (const photo of photos) {
      expect(photo.src, photo.src).toMatch(/^\/about\/[a-z-]+\.webp$/);
      expect(existsSync(file(photo.src)), photo.src).toBe(true);
      expect(statSync(file(photo.src)).size, photo.src).toBeLessThanOrEqual(250 * 1024);
      expect(photo.alt.trim(), photo.src).not.toBe("");
    }
  });
});

describe("the timeline's Now line", () => {
  it("lists the Exams it's given", () => {
    expect(aboutCopy.story.now.body(["Civil Engineering", "Accountancy"])).toBe(
      "Then came updated editions and reviewers for more courses. We now make reviewers for Civil Engineering and Accountancy.",
    );
  });

  it("lists no courses when there are no Exams", () => {
    expect(aboutCopy.story.now.body([])).toBe(
      "Then came updated editions and reviewers for more courses.",
    );
  });
});

describe("the mission tabs", () => {
  it("has the mockup's four", () => {
    expect(missionTabs.map((tab) => tab.title)).toEqual([
      "Board-focused, nothing extra",
      "Updated to the trend",
      "Made for tight budgets",
      "Original, and protected",
    ]);
  });

  // Tab 03 quotes prices as fixed copy. This guards the Phase 1 seed only: when
  // a seed price changes (or the client's spreadsheet replaces the seed), it
  // fails so the copy is checked too. Prices edited in the Admin from Phase 2
  // won't trip it, so the copy still needs the client's review.
  it.each<[string, string, ProductFormat]>([
    ["CE posters from", "CE", "posters"],
    ["EE cards at", "EE", "flash-cards"],
    ["MedTech cards at", "MT", "flash-cards"],
  ])("quotes “%s” the seed's lowest Live price", async (phrase, examCode, format) => {
    const { items } = await listProducts({ examCode, format });
    const prices = items.flatMap((product) =>
      product.priceFrom === null ? [] : [product.priceFrom],
    );
    expect(prices.length, `${examCode} ${format}`).toBeGreaterThan(0);
    expect(missionTabs[2]?.body).toContain(`${phrase} ${formatPeso(Math.min(...prices))}`);
  });
});
