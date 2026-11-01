// The Catalogue seam's cache tags (CONVENTIONS §3). Every read carries
// CATALOGUE_TAG and the tag of each area it reads, so an Admin save clears
// exactly the reads it affects, and clearing CATALOGUE_TAG clears them all.

/** On every Catalogue read. Clearing it clears the whole Catalogue. */
export const CATALOGUE_TAG = "catalogue";

/** One tag per area of the Catalogue. */
export const CATALOGUE_TAGS = {
  exams: "catalogue:exams",
  products: "catalogue:products",
  reviews: "catalogue:reviews",
  faqs: "catalogue:faqs",
  settings: "catalogue:settings",
  examPages: "catalogue:exam-pages",
} as const;

export type CatalogueAreaTag = (typeof CATALOGUE_TAGS)[keyof typeof CATALOGUE_TAGS];
