import { describe, expect, it } from "vitest";

import type { Product } from "@/services/catalogue.types";

import { testComingSoonProduct, testExam, testLiveProduct } from "../../../test/fixtures/catalogue";
import { formatCardStats } from "./format-cards";

// "Which format fits how you study?" on Home: each format card's "For" Exams
// and "From" price come from the Live Products, not the mockup's hardcoded
// (and wrong) figures (docs/mockup/website/Home_v2.dc.html L344–348).

const exams = ["CE", "ME", "EE", "MT", "CPA"].map((code) => testExam({ code }));
const photo = (slug: string) => ({ src: `/products/${slug}/1.webp`, alt: slug });

const live = (slug: string, overrides: Partial<Product>) =>
  testLiveProduct({ id: slug, slug, photos: [photo(slug)], ...overrides });

// In best-selling order, as listProducts returns them.
const ceCards = live("ce-cards", { examCode: "CE", priceFrom: 120000 });
const meCards = live("me-cards", { examCode: "ME", priceFrom: 95000 });
const cePosters = live("ce-posters", { examCode: "CE", format: "posters", priceFrom: 40000 });
const mtNotebook = live("mt-notebook", { examCode: "MT", format: "notebook", priceFrom: 69900 });
const mtCards = live("mt-cards", { examCode: "MT", priceFrom: 55000, priceTo: 275000 });
/** A bundle whose dearest option is its whole set and whose others are its parts. */
const bundle = (slug: string, examCode: string, prices: number[]) =>
  live(slug, {
    examCode,
    format: "bundle",
    priceFrom: Math.min(...prices),
    priceTo: Math.max(...prices),
    variations: prices.map((price, index) => ({ name: `Option ${index + 1}`, price })),
  });
const ceBundle = bundle("ce-bundle", "CE", [120000, 124900, 125000, 349900]);

describe("formatCardStats", () => {
  it("gives each format its Exams in Exam order, its lowest Live price and its best seller's cover", () => {
    const stats = formatCardStats([ceCards, meCards, cePosters, mtNotebook, mtCards], exams);
    expect(stats["flash-cards"]).toEqual({
      examCodes: ["CE", "ME", "MT"],
      priceFrom: 55000,
      coverPhoto: photo("ce-cards"),
      saving: null,
    });
    expect(stats.posters).toEqual({
      examCodes: ["CE"],
      priceFrom: 40000,
      coverPhoto: photo("ce-posters"),
      saving: null,
    });
    expect(stats.notebook).toEqual({
      examCodes: ["MT"],
      priceFrom: 69900,
      coverPhoto: photo("mt-notebook"),
      saving: null,
    });
  });

  it("lists Exams in Exam order, whatever order the Products sell in", () => {
    const stats = formatCardStats([mtCards, meCards, ceCards], exams);
    expect(stats["flash-cards"]?.examCodes).toEqual(["CE", "ME", "MT"]);
    expect(stats["flash-cards"]?.coverPhoto).toEqual(photo("mt-cards"));
  });

  it("names an Exam once, however many of its Products share the format", () => {
    const ceCardsToo = live("ce-cards-2", { examCode: "CE", priceFrom: 90000 });
    const stats = formatCardStats([ceCards, ceCardsToo], exams);
    expect(stats["flash-cards"]).toMatchObject({ examCodes: ["CE"], priceFrom: 90000 });
  });

  it("gives the bundles' saving: the whole set against its parts bought one by one", () => {
    const stats = formatCardStats([ceCards, ceBundle], exams);
    expect(stats.bundle).toMatchObject({ examCodes: ["CE"], saving: 20000 });
  });

  it("prices the bundle card at the whole set, not its cheapest part", () => {
    expect(formatCardStats([ceCards, ceBundle], exams).bundle?.priceFrom).toBe(349900);
  });

  it("gives the lowest whole-set price across bundles", () => {
    const meBundle = bundle("me-bundle", "ME", [60000, 60000, 110000]);
    expect(formatCardStats([ceBundle, meBundle], exams).bundle?.priceFrom).toBe(110000);
  });

  it("prices a bundle with a single price at that price", () => {
    const oneOption = live("one-option", { format: "bundle", priceFrom: 250000, priceTo: null });
    expect(formatCardStats([oneOption], exams).bundle?.priceFrom).toBe(250000);
  });

  it("keeps the lowest price for every other format, even one priced as a range", () => {
    expect(formatCardStats([mtCards], exams)["flash-cards"]?.priceFrom).toBe(55000);
  });

  it("gives the least saving across bundles, so the card never claims more than any one saves", () => {
    const meBundle = bundle("me-bundle", "ME", [60000, 60000, 110000]);
    expect(formatCardStats([ceBundle, meBundle], exams).bundle?.saving).toBe(10000);
  });

  it("gives no saving when any bundle saves nothing", () => {
    const meBundle = bundle("me-bundle", "ME", [60000, 60000, 120000]);
    expect(formatCardStats([ceBundle, meBundle], exams).bundle?.saving).toBeNull();
  });

  it("leaves out a format with no Live Products", () => {
    const stats = formatCardStats([ceCards, cePosters], exams);
    expect(Object.keys(stats).sort()).toEqual(["flash-cards", "posters"]);
    expect(stats.notebook).toBeUndefined();
    expect(stats.bundle).toBeUndefined();
  });

  it("never counts a Coming Soon Product: not its Exam, its price or its photo", () => {
    // The seed forbids a Coming Soon price; one entered by mistake still never counts.
    const soonCards = testComingSoonProduct({
      id: "ee-cards",
      examCode: "EE",
      format: "flash-cards",
      priceFrom: 100,
    });
    const soonNotebook = testComingSoonProduct({
      id: "ce-notebook",
      examCode: "CE",
      format: "notebook",
    });
    const stats = formatCardStats([soonCards, ceCards, soonNotebook], exams);
    expect(stats["flash-cards"]).toEqual({
      examCodes: ["CE"],
      priceFrom: 120000,
      coverPhoto: photo("ce-cards"),
      saving: null,
    });
    expect(stats.notebook).toBeUndefined();
  });

  it("is empty with no Live Products", () => {
    expect(formatCardStats([], exams)).toEqual({});
  });
});
