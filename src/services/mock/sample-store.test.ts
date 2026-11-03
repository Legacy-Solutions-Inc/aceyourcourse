import { describe, expect, it } from "vitest";

import { getSampleStore, resetSampleStore, withStandInStore } from "./sample-store";

// The Admin seam's database arm runs the sample arm's code over a store it
// loaded from Postgres (admin.db.ts): inside withStandInStore, every
// getSampleStore() gets that store, and the sample data is left alone.

describe("withStandInStore", () => {
  it("gives the stand-in store to every getSampleStore() inside it, across awaits", async () => {
    const sample = resetSampleStore();
    const standIn = { ...structuredClone(sample), generation: "stand-in" };

    const seen = await withStandInStore(standIn, async () => {
      const first = getSampleStore();
      await new Promise((resolve) => setTimeout(resolve, 1));
      return [first, getSampleStore()];
    });

    expect(seen).toEqual([standIn, standIn]);
    expect(seen[0]).toBe(standIn);
  });

  it("leaves the sample data alone, and gives it back outside", async () => {
    const sample = resetSampleStore();
    const standIn = structuredClone(sample);

    await withStandInStore(standIn, async () => {
      getSampleStore().staffActivity = [];
      getSampleStore().catalogue = { ...getSampleStore().catalogue, faqs: [] };
    });

    expect(getSampleStore()).toBe(sample);
    expect(sample.catalogue.faqs.length).toBeGreaterThan(0);
  });
});
