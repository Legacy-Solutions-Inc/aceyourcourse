import type { Exam, Product, ReviewWithProduct } from "@/services/catalogue.types";

// Small, hand-built catalogue records for unit and component tests. Each test
// overrides only the fields its rule is about.

export function testExam(overrides: Partial<Exam> = {}): Exam {
  return {
    code: "CE",
    board: "CELE",
    name: "Civil Engineering",
    longName: "Civil Engineering Licensure Exam",
    blurb: "Three subjects, four formats.",
    madeFor: "Engineers needing a quick formula reference",
    subjects: [
      { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
      { code: "HPGE", name: "Hydraulics & Geotechnical Engineering" },
      { code: "PSAD", name: "Principles of Structural Analysis & Design" },
    ],
    ...overrides,
  };
}

export function testLiveProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prd-test-1",
    slug: "ce-formula-flash-cards",
    examCode: "CE",
    title: "Civil Engineering Formula Flash Cards",
    shortName: "CE Formula Flash Cards",
    format: "flash-cards",
    size: "4 × 6 in · 160 gsm",
    edition: "Second Edition",
    subjectCodes: ["MSTC", "HPGE", "PSAD"],
    state: "live",
    priceFrom: 120000,
    priceTo: null,
    variations: [],
    photos: [
      { src: "/products/ce-formula-flash-cards/1.webp", alt: "Cover, photo 1 of 2" },
      { src: "/products/ce-formula-flash-cards/2.webp", alt: "Back, photo 2 of 2" },
    ],
    listings: { shopee: "https://shopee.ph/CE-Formula-Flash-Cards-i.1276620555.24292303887" },
    shopee: { rating: 4.8, ratingCount: 197, unitsSold: 764, asOf: "2026-10-29" },
    deal: true,
    availableInApp: true,
    showOnWebsite: true,
    whatsInside: null,
    madeFor: null,
    seoTitle: null,
    seoDescription: null,
    ...overrides,
  };
}

export function testComingSoonProduct(overrides: Partial<Product> = {}): Product {
  return testLiveProduct({
    id: "prd-test-2",
    slug: "ce-solving-notebook",
    title: "Civil Engineering Solving Notebook",
    shortName: "CE Solving Notebook",
    format: "notebook",
    size: "A5",
    edition: null,
    state: "coming-soon",
    priceFrom: null,
    priceTo: null,
    variations: [],
    photos: [],
    listings: {},
    shopee: null,
    deal: false,
    availableInApp: false,
    ...overrides,
  });
}

export function testReview(overrides: Partial<ReviewWithProduct> = {}): ReviewWithProduct {
  return {
    id: "rev-test-1",
    productId: "prd-test-1",
    stars: 5,
    text: "Readable fonts.\nHandy for review.",
    variation: "MSTC, HPGE, PSAD,160 gsm",
    helpful: 8,
    marketplace: "shopee",
    homePin: null,
    product: {
      slug: "ce-formula-flash-cards",
      shortName: "CE Formula Flash Cards",
      examCode: "CE",
    },
    ...overrides,
  };
}
