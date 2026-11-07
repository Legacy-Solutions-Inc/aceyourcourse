import type { CatalogueSeed } from "@/services/catalogue.schema";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { resetSampleStore } from "@/services/mock/sample-store";

/**
 * Starts the sample data from an edited copy of the seed, for states the seed
 * lacks. The Catalogue seam's mock arm reads the sample store, which lives on
 * globalThis and so survives vi.resetModules(): mocking the seed module can't
 * reach it. The edited seed is validated as the seed is, so an invalid edit
 * throws. Call resetSampleStore() afterwards to start from the seed again.
 */
export function editSampleCatalogue(edit: (seed: CatalogueSeed) => void): void {
  const seed = structuredClone(CATALOGUE_SEED);
  edit(seed);
  resetSampleStore(seed);
}
