import type { Faq } from "@/services/catalogue.types";

/**
 * Pure: FAQPage markup for exactly the FAQs passed in, so the page passes only
 * the visible ones. A quote stays out: it is a copied Marketplace Review, and
 * those are never emitted as structured data (see src/lib/catalogue/json-ld.ts).
 * Null when there are no FAQs, since an FAQPage needs at least one Question.
 */
export function faqPageJsonLd(
  groups: ReadonlyArray<{ items: ReadonlyArray<Pick<Faq, "question" | "answer">> }>,
): Record<string, unknown> | null {
  const faqs = groups.flatMap((group) => group.items);
  if (faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}
