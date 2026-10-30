import { describe, expect, it } from "vitest";

import { type CatalogueSeed, validateCatalogueSeed } from "./catalogue.schema";

// The fixture always has these; fail loudly if an edit ever drops one.
function present<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("the test fixture is missing a value");
  return value;
}
function at<T>(items: readonly T[], index: number): T {
  return present(items[index]);
}

// A small, hand-built seed. Each sad-path test breaks exactly one field.
function validSeed(): CatalogueSeed {
  return {
    exams: [
      {
        code: "CE",
        board: "CELE",
        name: "Civil Engineering",
        longName: "Civil Engineering Licensure Exam",
        blurb: "Three subjects, four formats.",
        madeFor: "Engineers needing a quick formula reference",
        subjects: [
          { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
          { code: "HPGE", name: "Hydraulics & Geotechnical Engineering" },
        ],
      },
      {
        code: "ME",
        board: "MELE",
        name: "Mechanical Engineering",
        longName: "Mechanical Engineering Licensure Exam",
        blurb: "Formula flash cards for all three MELE subjects.",
        madeFor: "Engineers needing a quick formula reference",
        subjects: [{ code: "MATH", name: "Mathematics" }],
      },
    ],
    settings: {
      shopLinks: {
        shopee: "https://shopee.ph/aceyourcourse",
        lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
        tiktok: null,
      },
      socialLinks: {
        tiktok: "https://www.tiktok.com/@aceyourcourse",
        facebook: null,
        instagram: "https://www.instagram.com/aceyourcourseph",
      },
      contactEmail: "aceyourcourseinc@gmail.com",
      shopStats: { rating: 4.8, ratingCount: 874, followers: "3.7K", asOf: "2026-10-29" },
      announcement: {
        id: "test-1",
        messages: [
          { text: "Physical copies on Shopee", href: "/products", requiresMemberApp: false },
          { text: "In the app", href: "/app", requiresMemberApp: true },
        ],
      },
      promoBanner: {
        visible: false,
        text: "11.11 sale",
        buttonLabel: "Shop the sale",
        href: "https://shopee.ph/aceyourcourse",
        startDate: "2026-11-09",
        endDate: "2026-11-11",
      },
    },
  };
}

function errorsFor(seed: unknown): string[] {
  const result = validateCatalogueSeed(seed);
  if (result.success) throw new Error("expected the seed to be rejected");
  return result.errors;
}

describe("validateCatalogueSeed", () => {
  it("accepts a valid seed and returns it", () => {
    const result = validateCatalogueSeed(validSeed());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.exams.map((e) => e.code)).toEqual(["CE", "ME"]);
    }
  });

  it("accepts a seed with no promo banner and null shop and social links", () => {
    const seed = validSeed();
    seed.settings.promoBanner = null;
    seed.settings.shopLinks.lazada = null;
    seed.settings.socialLinks.tiktok = null;
    expect(validateCatalogueSeed(seed).success).toBe(true);
  });

  it("rejects a duplicate Exam code, naming the field", () => {
    const seed = validSeed();
    at(seed.exams, 1).code = "CE";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^exams\.1\.code: .*duplicate.*CE/i)]);
  });

  it("treats Exam codes that differ only in case as duplicates", () => {
    const seed = validSeed();
    at(seed.exams, 1).code = "Ce";
    const errors = errorsFor(seed);
    expect(errors).toContainEqual(expect.stringMatching(/^exams\.1\.code: .*duplicate/i));
  });

  it("rejects a lowercase Exam code, which would break its Exam page URL", () => {
    const seed = validSeed();
    at(seed.exams, 1).code = "me";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^exams\.1\.code: /)]);
  });

  it("rejects a blank Subject name, naming the field", () => {
    const seed = validSeed();
    at(at(seed.exams, 0).subjects, 1).name = "   ";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^exams\.0\.subjects\.1\.name: .*blank/i),
    ]);
  });

  it("rejects an Exam with zero Subjects, naming the field", () => {
    const seed = validSeed();
    at(seed.exams, 1).subjects = [];
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^exams\.1\.subjects: /)]);
  });

  it("rejects an invalid contact email, naming the field", () => {
    const seed = validSeed();
    seed.settings.contactEmail = "aceyourcourse-at-gmail";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^settings\.contactEmail: /)]);
  });

  it("rejects a non-https shop link, naming the field", () => {
    const seed = validSeed();
    seed.settings.shopLinks.shopee = "http://shopee.ph/aceyourcourse";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^settings\.shopLinks\.shopee: .*https/i),
    ]);
  });

  it("rejects a shop link that is not a URL at all", () => {
    const seed = validSeed();
    seed.settings.shopLinks.lazada = "lazada";
    expect(errorsFor(seed)).toContainEqual(expect.stringMatching(/^settings\.shopLinks\.lazada: /));
  });

  it("rejects a non-https social link, naming the field", () => {
    const seed = validSeed();
    seed.settings.socialLinks.facebook = "http://www.facebook.com/aceyourcourseph";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^settings\.socialLinks\.facebook: .*https/i),
    ]);
  });

  it("rejects a shop stats date that is not an ISO date", () => {
    const seed = validSeed();
    seed.settings.shopStats.asOf = "Oct 2026";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^settings\.shopStats\.asOf: /)]);
  });

  it("rejects a promo banner that ends before it starts", () => {
    const seed = validSeed();
    present(seed.settings.promoBanner).endDate = "2026-11-08";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^settings\.promoBanner\.endDate: /)]);
  });

  it("rejects an announcement message with a relative or non-https link", () => {
    const seed = validSeed();
    at(seed.settings.announcement.messages, 0).href = "products";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^settings\.announcement\.messages\.0\.href: /),
    ]);
  });

  it("reports every problem at once", () => {
    const seed = validSeed();
    at(at(seed.exams, 0).subjects, 0).name = "";
    seed.settings.contactEmail = "nope";
    expect(errorsFor(seed)).toHaveLength(2);
  });

  it("rejects something that is not a seed at all", () => {
    expect(errorsFor(null)).toEqual([expect.stringMatching(/^\(root\): /)]);
  });
});
