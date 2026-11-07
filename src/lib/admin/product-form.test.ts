import { describe, expect, it } from "vitest";

import type { Exam, Product } from "@/services/catalogue.types";

import {
  generatedProductCopy,
  newProductForm,
  productFormValues,
  renameVariation,
  subjectsOnExam,
} from "./product-form";

const POSTERS: Product = {
  id: "prd-005",
  slug: "ultimate-ce-posters-2-0",
  examCode: "CE",
  title: "Ultimate Civil Engineering Posters",
  shortName: "Ultimate CE Posters 2.0",
  format: "posters",
  size: "A3",
  edition: "2.0",
  subjectCodes: ["MSTC", "HPGE", "PSAD"],
  state: "live",
  priceFrom: 40000,
  priceTo: 125000,
  variations: [
    { name: "CE POSTERS 2.0: MSTC ONLY", price: 40000 },
    { name: "CE POSTERS 2.0: HPGE ONLY", price: 47050 },
  ],
  photos: [{ src: "/products/ultimate-ce-posters-2-0/1.webp", alt: "photo 1 of 1" }],
  listings: { shopee: "https://shopee.ph/posters-i.1.2" },
  shopee: { rating: 4.9, ratingCount: 52, unitsSold: 1172, asOf: "2026-10-29" },
  deal: true,
  availableInApp: false,
  showOnWebsite: true,
  whatsInside: null,
  madeFor: ["CE students", "Retakers"],
  seoTitle: null,
  seoDescription: "Posters for the CELE.",
};

const exam = (code: string, subjects: string[]): Exam => ({
  code,
  board: `${code}LE`,
  name: code,
  longName: code,
  blurb: "",
  madeFor: "",
  subjects: subjects.map((s) => ({ code: s, name: s })),
});

describe("productFormValues", () => {
  it("writes a Product's fields as the form holds them: text, pesos and lines", () => {
    expect(productFormValues(POSTERS)).toEqual({
      title: "Ultimate Civil Engineering Posters",
      shortName: "Ultimate CE Posters 2.0",
      edition: "2.0",
      examCode: "CE",
      format: "posters",
      size: "A3",
      subjectCodes: ["MSTC", "HPGE", "PSAD"],
      photos: ["/products/ultimate-ce-posters-2-0/1.webp"],
      comingSoon: false,
      deal: true,
      priceFrom: "400",
      priceTo: "1,250",
      variations: [
        { name: "CE POSTERS 2.0: MSTC ONLY", price: "400" },
        { name: "CE POSTERS 2.0: HPGE ONLY", price: "470.50" },
      ],
      shopee: { rating: "4.9", ratingCount: "52", unitsSold: "1172" },
      whatsInside: "",
      madeFor: "CE students\nRetakers",
      listings: { shopee: "https://shopee.ph/posters-i.1.2", lazada: "", tiktok: "" },
      seoTitle: "",
      seoDescription: "Posters for the CELE.",
    });
  });

  it("leaves a Coming Soon Product's sale fields blank", () => {
    const values = productFormValues({
      ...POSTERS,
      state: "coming-soon",
      priceFrom: null,
      priceTo: null,
      variations: [],
      listings: {},
      shopee: null,
      edition: null,
      madeFor: null,
    });
    expect(values).toMatchObject({
      comingSoon: true,
      priceFrom: "",
      priceTo: "",
      variations: [],
      shopee: { rating: "", ratingCount: "", unitsSold: "" },
      listings: { shopee: "", lazada: "", tiktok: "" },
      edition: "",
      madeFor: "",
    });
  });
});

describe("newProductForm", () => {
  it("opens blank, for the first Exam, Live, on the website and not in the app", () => {
    expect(newProductForm("CE")).toMatchObject({
      title: "",
      examCode: "CE",
      format: "flash-cards",
      subjectCodes: [],
      comingSoon: false,
      deal: false,
      showOnWebsite: true,
      availableInApp: false,
      variations: [],
    });
  });
});

describe("subjectsOnExam", () => {
  it("drops the Subjects that aren't on the new Exam, keeping the order", () => {
    const me = exam("ME", ["PIP", "MATH", "MD"]);
    expect(subjectsOnExam(["MSTC", "HPGE"], me)).toEqual([]);
    expect(subjectsOnExam(["ESAS", "MATH", "EE PROF"], me)).toEqual(["MATH"]);
  });

  it("keeps none for an Exam that isn't in the catalogue", () => {
    expect(subjectsOnExam(["MATH"], undefined)).toEqual([]);
  });
});

describe("generatedProductCopy", () => {
  const ce = { ...exam("CE", ["MSTC", "HPGE", "PSAD"]), board: "CELE", name: "Civil Engineering" };

  it("generates the Website's text from the form as it stands, for the blank fields' placeholders", () => {
    const copy = generatedProductCopy(
      { ...productFormValues(POSTERS), seoTitle: "Typed", subjectCodes: ["PSAD"] },
      ce,
    );

    expect(copy?.whatsInside).toBe(
      "Posters for the CELE, covering PSAD. For the board exam, school, and professional review.",
    );
    expect(copy?.madeFor).toEqual(["Civil Engineering students", "Board exam reviewees", ""]);
    // The typed SEO title isn't the placeholder: the generated one is.
    expect(copy?.seoTitle).toBe("Ultimate CE Posters 2.0 · CELE Reviewer · Ace Your Course");
    expect(copy?.seoDescription).toMatch(
      /^Ultimate Civil Engineering Posters for the CELE, covering PSAD\./,
    );
    expect(copy?.seoDescription.length ?? 999).toBeLessThanOrEqual(160);
  });

  it("says Coming Soon in a Coming Soon Product's description", () => {
    const copy = generatedProductCopy({ ...productFormValues(POSTERS), comingSoon: true }, ce);
    expect(copy?.seoDescription).toMatch(/^Coming soon: /);
  });

  it("generates nothing without an Exam", () => {
    expect(generatedProductCopy(productFormValues(POSTERS), undefined)).toBeNull();
  });
});

describe("renameVariation", () => {
  it("keeps the Marketplace's prefix, which the editor doesn't show (mockup 1095)", () => {
    expect(renameVariation("CE POSTERS 2.0: MSTC ONLY", "MSTC")).toBe("CE POSTERS 2.0: MSTC");
    expect(renameVariation("CE POSTERS 2.0: ", "PSAD ONLY")).toBe("CE POSTERS 2.0: PSAD ONLY");
  });

  it("names a variation with no prefix as typed", () => {
    expect(renameVariation("MSTC ONLY", "HPGE ONLY")).toBe("HPGE ONLY");
    expect(renameVariation("", "MSTC ONLY")).toBe("MSTC ONLY");
  });
});
