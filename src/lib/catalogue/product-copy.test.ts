import { describe, expect, it } from "vitest";

import { getExamByCode, listProducts } from "@/services/catalogue";

import { testComingSoonProduct, testExam, testLiveProduct } from "../../../test/fixtures/catalogue";
import {
  productMadeFor,
  productSeoDescription,
  productSeoTitle,
  productWhatsInside,
} from "./product-copy";

const exam = testExam();

describe("productWhatsInside", () => {
  it("generates the mockup's sentence from the format, board and Subjects", () => {
    expect(productWhatsInside(testLiveProduct(), exam)).toBe(
      "Flash cards for the CELE, covering MSTC, HPGE, PSAD. For the board exam, school, and professional review.",
    );
  });

  it("uses the Product's own text when it is set", () => {
    expect(productWhatsInside(testLiveProduct({ whatsInside: "120 cards." }), exam)).toBe(
      "120 cards.",
    );
  });
});

describe("productMadeFor", () => {
  it("generates the Exam's students, board exam reviewees and the Exam's own audience", () => {
    expect(productMadeFor(testLiveProduct(), exam)).toEqual([
      "Civil Engineering students",
      "Board exam reviewees",
      "Engineers needing a quick formula reference",
    ]);
  });

  it("uses the Product's own list when it is set", () => {
    expect(productMadeFor(testLiveProduct({ madeFor: ["Retakers"] }), exam)).toEqual(["Retakers"]);
  });
});

describe("productSeoTitle", () => {
  it("names the Product, its board and the brand", () => {
    expect(productSeoTitle(testLiveProduct(), exam)).toBe(
      "CE Formula Flash Cards · CELE Reviewer · Ace Your Course",
    );
  });

  it("drops words to stay within 60 characters", () => {
    const title = productSeoTitle(
      testLiveProduct({ shortName: "MedTech Comprehensive Flash Cards" }),
      testExam({ board: "MTLE" }),
    );
    expect(title).toBe("MedTech Comprehensive Flash Cards · MTLE · Ace Your Course");
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it("shortens a very long name to fit", () => {
    const title = productSeoTitle(testLiveProduct({ shortName: "Word ".repeat(30).trim() }), exam);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toMatch(/… · Ace Your Course$/);
  });

  it("uses the Product's own SEO title when it is set", () => {
    expect(productSeoTitle(testLiveProduct({ seoTitle: "CE cards for the boards" }), exam)).toBe(
      "CE cards for the boards",
    );
  });
});

describe("productSeoDescription", () => {
  it("describes the Product, its board, Subjects and where it ships from", () => {
    expect(productSeoDescription(testLiveProduct(), exam)).toBe(
      "Civil Engineering Formula Flash Cards for the CELE, covering MSTC, HPGE, PSAD. For the board exam, school, and professional review. Ships from Iloilo City.",
    );
  });

  it("says a Coming Soon Product is coming soon", () => {
    expect(productSeoDescription(testComingSoonProduct(), exam)).toMatch(/^Coming soon: /);
  });

  it("stays within 160 characters for a long title and many Subjects", () => {
    const description = productSeoDescription(
      testLiveProduct({
        title: "Medical Technology Comprehensive Flash Cards for Every Module",
        subjectCodes: ["CLIN CHEM", "HEMA", "CLIN MIC & PARA", "ISBB", "HISTOPATH", "MICRO"],
      }),
      testExam({ board: "MTLE" }),
    );
    expect(description.length).toBeGreaterThanOrEqual(80);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("uses the Product's own SEO description when it is set", () => {
    const own = "Formula flash cards for the Civil Engineering Licensure Exam, in a pocket size.";
    expect(productSeoDescription(testLiveProduct({ seoDescription: own }), exam)).toBe(own);
  });
});

describe("generated SEO text for every Product in the catalogue", () => {
  it("keeps every title within 60 and every description within 80–160 characters", async () => {
    const live = await listProducts();
    const soon = await listProducts({ state: "coming-soon" });
    for (const product of [...live.items, ...soon.items]) {
      const productExam = await getExamByCode(product.examCode);
      if (!productExam) throw new Error(`no Exam for ${product.slug}`);
      const title = productSeoTitle(product, productExam);
      const description = productSeoDescription(product, productExam);
      expect(title.length, title).toBeLessThanOrEqual(60);
      expect(description.length, description).toBeGreaterThanOrEqual(80);
      expect(description.length, description).toBeLessThanOrEqual(160);
    }
  });
});
