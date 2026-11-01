import "server-only";

import { revalidateTag } from "next/cache";

import { CATALOGUE_TAG } from "@/services/catalogue.tags";
import { resetSampleStore } from "@/services/mock/sample-store";

/**
 * Starts the sample data again from the seed, as a server restart does, and
 * clears every Catalogue read cached from the old data. A development tool for
 * the header's Reset button and the Admin specs, so its callers allow it in
 * "sample" mode only.
 */
export function restoreSampleData(): void {
  resetSampleStore();
  revalidateTag(CATALOGUE_TAG);
}
