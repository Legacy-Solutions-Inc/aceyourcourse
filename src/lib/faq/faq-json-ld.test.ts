import { describe, expect, it } from "vitest";

import { testFaqGroups } from "../../../test/fixtures/catalogue";
import { faqPageJsonLd } from "./faq-json-ld";

/** Every key anywhere in a JSON-LD object, and every @type value. */
function keysAndTypes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysAndTypes);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...(key === "@type" && typeof child === "string" ? [child] : []),
    ...keysAndTypes(child),
  ]);
}

describe("faqPageJsonLd", () => {
  it("is an FAQPage with one Question and accepted Answer per FAQ passed in, in order", () => {
    expect(faqPageJsonLd(testFaqGroups())).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Where do orders ship from?",
          acceptedAnswer: { "@type": "Answer", text: "Every order ships from Iloilo City." },
        },
        {
          "@type": "Question",
          name: "How do I track my order?",
          acceptedAnswer: { "@type": "Answer", text: "In the Shopee app, under My Purchases." },
        },
        {
          "@type": "Question",
          name: "What are the posters like?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A3 size, printed big enough to read from your desk.",
          },
        },
        {
          "@type": "Question",
          name: "How do I know I’m buying the original?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Check that the listing says “Ships from Iloilo City, Iloilo.”",
          },
        },
      ],
    });
  });

  it("covers exactly the FAQs passed in, so a hidden FAQ never appears", () => {
    const [shipping] = testFaqGroups();
    if (!shipping) throw new Error("expected the shipping group");
    const visible = [{ ...shipping, items: shipping.items.slice(0, 1) }];
    expect(faqPageJsonLd(visible)?.mainEntity).toEqual([
      expect.objectContaining({ name: "Where do orders ship from?" }),
    ]);
  });

  it("never emits Review or rating markup, even for an FAQ that quotes a Review", () => {
    const jsonLd = faqPageJsonLd(testFaqGroups());
    const found = keysAndTypes(jsonLd).map((key) => key.toLowerCase());
    for (const banned of ["review", "reviews", "aggregaterating", "ratingvalue"]) {
      expect(found).not.toContain(banned);
    }
    expect(JSON.stringify(jsonLd)).not.toContain("Readable fonts.");
  });

  it("is null when there are no FAQs, since an FAQPage needs at least one Question", () => {
    expect(faqPageJsonLd([])).toBeNull();
    expect(faqPageJsonLd([{ items: [] }])).toBeNull();
  });
});
