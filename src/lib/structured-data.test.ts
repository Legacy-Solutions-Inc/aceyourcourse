import { describe, expect, it } from "vitest";

import { breadcrumbJsonLd, organizationJsonLd, productJsonLd } from "@/lib/catalogue/json-ld";
import { faqPageJsonLd } from "@/lib/faq/faq-json-ld";
import { paths } from "@/paths";
import { getWebsiteSettings, listExams, listFaqs, listProducts } from "@/services/catalogue";

import { ratingMarkup } from "../../test/rating-markup";

// Every JSON-LD builder's output, walked for rating and review markup, which
// the Website never emits (see test/rating-markup.ts). The e2e suite runs the
// same walker over what each page actually renders.

const SITE = "https://aceyourcourse.ph/";

type StructuredData = Record<string, unknown>;

/** Every JSON-LD object the Website emits for the seed, each named by where it appears. */
async function websiteJsonLd(): Promise<[string, StructuredData][]> {
  const [exams, live, comingSoon, faqs, settings] = await Promise.all([
    listExams(),
    listProducts(),
    listProducts({ state: "coming-soon" }),
    listFaqs(),
    getWebsiteSettings(),
  ]);
  const found: [string, StructuredData][] = [
    ["every page: Organization", organizationJsonLd(settings, SITE)],
  ];

  for (const exam of exams) {
    const examPath = paths.exams.details(exam.code);
    found.push([
      `${examPath}: BreadcrumbList`,
      breadcrumbJsonLd(
        [
          { name: "Home", path: paths.home },
          { name: exam.name, path: examPath },
        ],
        SITE,
      ),
    ]);
  }

  for (const product of [...live.items, ...comingSoon.items]) {
    const exam = exams.find((candidate) => candidate.code === product.examCode);
    if (!exam) throw new Error(`no Exam for ${product.slug}`);
    const productPath = paths.products.details(product.slug);
    const productLd = productJsonLd(product, exam, SITE);
    if (productLd) found.push([`${productPath}: Product`, productLd]);
    found.push([
      `${productPath}: BreadcrumbList`,
      breadcrumbJsonLd(
        [
          { name: "Products", path: paths.products.list },
          { name: exam.board, path: paths.exams.details(exam.code) },
          { name: product.shortName, path: productPath },
        ],
        SITE,
      ),
    ]);
  }

  const faqLd = faqPageJsonLd(faqs);
  if (faqLd) found.push(["/faq: FAQPage", faqLd]);
  return found;
}

describe("the rating and review markup guard", () => {
  it("finds an aggregateRating, a review and a Review or AggregateRating type wherever they are nested", () => {
    expect(
      ratingMarkup({
        "@type": "Product",
        aggregateRating: { "@type": "AggregateRating", ratingValue: 4.8, ratingCount: 197 },
        offers: [{ "@type": "Offer", review: { "@type": "Review" } }],
        subjectOf: { "@type": ["CreativeWork", "Review"] },
      }),
    ).toEqual([
      "$.aggregateRating",
      "$.aggregateRating.@type",
      "$.aggregateRating.ratingValue",
      "$.aggregateRating.ratingCount",
      "$.offers[0].review",
      "$.offers[0].review.@type",
      "$.subjectOf.@type",
    ]);
  });

  it("ignores the word Review in names and text", () => {
    expect(
      ratingMarkup({
        "@type": "Product",
        name: "CE Review Bundle 3-in-1",
        description: "Reviews say it's the best Review set; rated 4.8 by reviewees.",
      }),
    ).toEqual([]);
  });
});

describe("the Website's structured data", () => {
  it("covers the Organization, every Product and breadcrumb, and the FAQ page", async () => {
    const types = new Set((await websiteJsonLd()).map(([, jsonLd]) => jsonLd["@type"]));
    expect([...types].sort()).toEqual(["BreadcrumbList", "FAQPage", "Organization", "Product"]);
  });

  it("never has rating or review markup", async () => {
    const offending = (await websiteJsonLd()).flatMap(([where, jsonLd]) =>
      ratingMarkup(jsonLd).map((at) => `${where} ${at}`),
    );
    expect(offending).toEqual([]);
  });
});
