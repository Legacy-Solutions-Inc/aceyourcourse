import { describe, expect, it, vi } from "vitest";

import { resetSampleStore } from "@/services/mock/sample-store";

import { describeCatalogueContract, type CatalogueArm } from "../../test/catalogue-contract";

// The Catalogue seam's behaviour suite (test/catalogue-contract.ts) over the
// sample arm, the default with no DATABASE_URL. The database arm runs the same
// suite in src/services/catalogue.db.test.ts.

const SAMPLE_ARM: CatalogueArm = {
  name: "sample data",
  seam: async () => {
    vi.stubEnv("DATABASE_URL", "");
    return import("@/services/catalogue");
  },
  loadSeed: async (seed) => {
    resetSampleStore(seed);
  },
};

describe("catalogue seam on the sample data", () => {
  describeCatalogueContract(SAMPLE_ARM);

  it("refuses to load a seed that fails validation", async () => {
    vi.resetModules();
    vi.doMock("@/services/mock/catalogue", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/services/mock/catalogue")>();
      const [first] = real.CATALOGUE_SEED.exams;
      return {
        CATALOGUE_SEED: { ...real.CATALOGUE_SEED, exams: [first, first] },
      };
    });
    await expect(import("./catalogue.mock")).rejects.toThrow(/exams\.1\.code: duplicate/);
    vi.doUnmock("@/services/mock/catalogue");
  });
});
