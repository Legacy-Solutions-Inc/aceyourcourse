import { uniqueSlug } from "@/lib/admin/slug";
import type { FaqForm } from "@/services/admin.schema";
import type { FaqReviewOption } from "@/services/admin.types";
import type { Faq, FaqGroup } from "@/services/catalogue.types";

// The FAQ editor's values (BUILD-MAP §3.4, FAQS tab): an FAQ's fields as its
// form holds them, and back through the seam's schema (admin.schema.ts). The
// quote is the Review's id and the words taken from it, "" for none.

/** Pure: an FAQ's fields as its editor opens them. */
export function faqFormValues(faq: Faq): FaqForm {
  return {
    question: faq.question,
    answer: faq.answer,
    group: faq.group,
    quoteReviewId: faq.reviewQuote?.reviewId ?? "",
    quoteText: faq.reviewQuote?.text ?? "",
    popular: faq.popularLabel !== null,
    popularLabel: faq.popularLabel ?? "",
    requiresMemberApp: faq.requiresMemberApp,
    showOnFaqPage: faq.showOnFaqPage,
    showCoverageTable: faq.showCoverageTable,
  };
}

/** Pure: a new FAQ's form, in this group: shown on the FAQ page, with nothing else on. */
export function newFaqForm(group: FaqGroup): FaqForm {
  return {
    question: "",
    answer: "",
    group,
    quoteReviewId: "",
    quoteText: "",
    popular: false,
    popularLabel: "",
    requiresMemberApp: false,
    showOnFaqPage: true,
    showCoverageTable: false,
  };
}

/** Pure: a quote's credit line, "★★★★★ · Ultimate CE Posters 2.0", as the FAQ page credits it. */
export const quoteCredit = (review: Pick<FaqReviewOption, "stars" | "product">) =>
  `${"★".repeat(review.stars)} · ${review.product.shortName}`;

/**
 * Pure: a new FAQ's deep-link slug, /faq#faq-{slug}: from its question, at
 * most 40 characters, made unique among the slugs taken. It's fixed once the
 * FAQ is added (spec, Phase 2 → FAQ).
 */
export const faqSlugFor = (question: string, taken: Iterable<string>) =>
  uniqueSlug(question, taken, { max: 40, fallback: "question" });
