import { validateCatalogueSeed } from "@/services/catalogue.schema";
import { catalogueReads, type LoadCatalogue } from "@/services/catalogue.rules";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { getSampleStore } from "@/services/mock/sample-store";

// ─────────────────────────────────────────────────────────────────────────────
// In-memory implementation of the Catalogue seam, and the default when no
// DATABASE_URL is set. It reads the catalogue held in the Admin's sample store,
// a copy of the typed seed, so an Admin save shows on the Website
// (src/services/mock/sample-store.ts). The rules it applies are shared with the
// database arm (catalogue.rules.ts). The seed is validated once at load so a
// bad edit fails loudly, and every Admin write is validated again before the
// store takes it. The Member App switch comes from MEMBER_APP_LIVE, not the
// seed. See docs/adr/0003-mock-first-service-seam.md.
// ─────────────────────────────────────────────────────────────────────────────

export { memberAppLive } from "@/services/catalogue.rules";

// The sample store validates the seed too, but only when it's first read; this
// makes a bad seed fail as soon as the Website loads.
const validation = validateCatalogueSeed(CATALOGUE_SEED);
if (!validation.success) {
  throw new Error(`Invalid catalogue seed — ${validation.errors.join("; ")}`);
}

/**
 * A copy of the catalogue as the store holds it now, with every Admin save so
 * far: every part, which includes the ones the read asked for. A copy, so
 * nothing a page does can change the catalogue for the next request (a
 * database read returns fresh rows the same way).
 */
const load: LoadCatalogue = async () => structuredClone(getSampleStore().catalogue);

export const {
  listExams,
  getExamByCode,
  getExamPage,
  getSitePage,
  listProducts,
  getProductBySlug,
  listRelatedProducts,
  listBestSellers,
  listReviews,
  listHomeReviews,
  listFaqs,
  getWebsiteSettings,
} = catalogueReads(load);
