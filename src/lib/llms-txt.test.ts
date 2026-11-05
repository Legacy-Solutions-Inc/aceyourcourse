import { describe, expect, it } from "vitest";

import type { Exam, FaqGroupWithItems, FaqWithQuote, Product } from "@/services/catalogue.types";

import { buildLlmsTxt, type LlmsTxtCatalogue } from "./llms-txt";

// The Website's summary for AI assistants (/llms.txt, ticket 22; spec, Phase 2
// → Summary for AI assistants), built from a hand-made catalogue. Its format
// follows llmstxt.org: an H1, a blockquote summary, then H2 link lists.

const SITE = "https://aceyourcourse.ph/";

const CE: Exam = {
  code: "CE",
  board: "CELE",
  name: "Civil Engineering",
  longName: "Civil Engineering Licensure Exam",
  blurb: "Three subjects, four formats.",
  madeFor: "Engineers",
  subjects: [
    { code: "MSTC", name: "Mathematics & Surveying" },
    { code: "HPGE", name: "Hydraulics & Geotechnical Engineering" },
  ],
};
const ME: Exam = { ...CE, code: "ME", board: "MELE", name: "Mechanical Engineering", subjects: [] };

function product(changes: Partial<Product> = {}): Product {
  return {
    id: "p-ce-cards",
    slug: "ce-formula-flash-cards",
    examCode: "CE",
    title: "CE Formula Flash Cards",
    shortName: "CE Cards",
    format: "flash-cards",
    size: "4 × 6 in",
    edition: null,
    subjectCodes: ["MSTC"],
    state: "live",
    priceFrom: 60000,
    priceTo: null,
    variations: [],
    photos: [],
    listings: {
      shopee: "https://shopee.ph/ce-cards",
      lazada: "https://www.lazada.com.ph/ce-cards",
    },
    shopee: { rating: 4.9, ratingCount: 812, unitsSold: 2345, asOf: "2026-10-01" },
    deal: false,
    availableInApp: true,
    showOnWebsite: true,
    whatsInside: null,
    madeFor: null,
    seoTitle: null,
    seoDescription: null,
    ...changes,
  };
}

const NOTEBOOK = product({
  id: "p-ce-notebook",
  slug: "ce-solving-notebook",
  title: "CE Solving Notebook",
  priceFrom: 120000,
  priceTo: 180000,
  listings: { shopee: "https://shopee.ph/ce-notebook" },
});
const POSTERS_SOON = product({
  id: "p-ce-posters",
  slug: "ce-posters",
  title: "CE Posters",
  state: "coming-soon",
  priceFrom: null,
  listings: {},
  shopee: null,
});

function faq(changes: Partial<FaqWithQuote> = {}): FaqWithQuote {
  return {
    id: "faq-001",
    slug: "ship",
    group: "shipping",
    order: 1,
    question: "Do you ship nationwide?",
    answer: "Yes, from Iloilo City.\nMost orders arrive in 3–5 days.",
    reviewQuote: {
      reviewId: "r-1",
      text: "Arrived in two days, so happy!",
      stars: 5,
      variation: null,
      product: { slug: "ce-formula-flash-cards", shortName: "CE Cards", examCode: "CE" },
    },
    popularLabel: null,
    requiresMemberApp: false,
    showOnFaqPage: true,
    showCoverageTable: false,
    ...changes,
  };
}
const FAQS: FaqGroupWithItems[] = [{ group: "shipping", title: "Shipping", items: [faq()] }];

const CATALOGUE: LlmsTxtCatalogue = {
  exams: [CE],
  products: [product(), NOTEBOOK, POSTERS_SOON],
  faqs: FAQS,
  shopLinks: {
    shopee: "https://shopee.ph/aceyourcourse",
    lazada: null,
    tiktok: "https://www.tiktok.com/@aceyourcourse",
  },
};

const build = (changes: Partial<LlmsTxtCatalogue> = {}) =>
  buildLlmsTxt(SITE, { ...CATALOGUE, ...changes });

/** The lines of one H2 section, without its heading or blank lines. */
function section(text: string, heading: string): string[] {
  const lines = text.split("\n");
  const start = lines.indexOf(`## ${heading}`);
  if (start === -1) throw new Error(`no "## ${heading}" section`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).filter((line) => line !== "");
}

describe("buildLlmsTxt", () => {
  it("starts with the name and a one-paragraph summary of who AYC is, what it sells and where it ships from", () => {
    const [title, blank, summary] = build().split("\n");
    expect(title).toBe("# Ace Your Course");
    expect(blank).toBe("");
    expect(summary).toMatch(/^> /);
    expect(summary).toContain("flash cards, notebooks and posters");
    expect(summary).toContain("Philippine licensure board exams");
    expect(summary).toContain("ships them nationwide from Iloilo City");
    // The Marketplaces with a shop, in display order.
    expect(summary).toContain("on Shopee and TikTok Shop");
  });

  it("gives each Exam a section: its Exam page, its Live Products with prices and Listings, then Coming Soon", () => {
    expect(section(build(), "Civil Engineering (CELE)")).toEqual([
      "- [Civil Engineering Licensure Exam page](https://aceyourcourse.ph/exams/ce): Subjects: Mathematics & Surveying; Hydraulics & Geotechnical Engineering",
      "- [CE Formula Flash Cards](https://aceyourcourse.ph/products/ce-formula-flash-cards): ₱600. Buy on [Shopee](https://shopee.ph/ce-cards) or [Lazada](https://www.lazada.com.ph/ce-cards)",
      "- [CE Solving Notebook](https://aceyourcourse.ph/products/ce-solving-notebook): ₱1,200–₱1,800. Buy on [Shopee](https://shopee.ph/ce-notebook)",
      "- [CE Posters](https://aceyourcourse.ph/products/ce-posters): Coming soon",
    ]);
  });

  it("lists every Exam in the order given", () => {
    const text = build({
      exams: [CE, ME],
      products: [product(), product({ id: "p-me", slug: "me-cards", examCode: "ME" })],
    });
    expect(text.match(/^## .+$/gm)).toEqual([
      "## Civil Engineering (CELE)",
      "## Mechanical Engineering (MELE)",
      "## FAQ",
      "## Pages",
      "## Shops",
    ]);
  });

  it("leaves out an Exam with no Product on the Website", () => {
    const text = build({ exams: [CE, ME] });
    expect(text).not.toContain("Mechanical Engineering");
    expect(text).not.toContain("/exams/me");
  });

  it("marks a Coming Soon Product, and never gives it a price, even one left in the catalogue", () => {
    const soon = product({ ...POSTERS_SOON, priceFrom: 99900 });
    const [line] = section(
      build({ products: [product(), soon] }),
      "Civil Engineering (CELE)",
    ).filter((entry) => entry.includes("CE Posters"));
    expect(line).toBe("- [CE Posters](https://aceyourcourse.ph/products/ce-posters): Coming soon");
    expect(build({ products: [product(), soon] })).not.toContain("₱999");
  });

  it("shows only the Listings a Product has, and no buy link when it has none", () => {
    const shopeeOnly = product({ listings: { shopee: "https://shopee.ph/ce-cards" } });
    const none = product({ listings: {} });
    expect(section(build({ products: [shopeeOnly] }), "Civil Engineering (CELE)")[1]).toBe(
      "- [CE Formula Flash Cards](https://aceyourcourse.ph/products/ce-formula-flash-cards): ₱600. Buy on [Shopee](https://shopee.ph/ce-cards)",
    );
    expect(section(build({ products: [none] }), "Civil Engineering (CELE)")[1]).toBe(
      "- [CE Formula Flash Cards](https://aceyourcourse.ph/products/ce-formula-flash-cards): ₱600",
    );
  });

  it("names all three Marketplaces, in display order, when a Product has a Listing on each", () => {
    const everywhere = product({
      listings: {
        tiktok: "https://www.tiktok.com/view/ce-cards",
        shopee: "https://shopee.ph/ce-cards",
        lazada: "https://www.lazada.com.ph/ce-cards",
      },
    });
    expect(section(build({ products: [everywhere] }), "Civil Engineering (CELE)")[1]).toContain(
      "Buy on [Shopee](https://shopee.ph/ce-cards), [Lazada](https://www.lazada.com.ph/ce-cards) or [TikTok Shop](https://www.tiktok.com/view/ce-cards)",
    );
  });

  it("leaves out a Product that's off the Website", () => {
    const text = build({ products: [product(), { ...NOTEBOOK, showOnWebsite: false }] });
    expect(text).not.toContain("CE Solving Notebook");
  });

  it("lists the FAQ's questions with their answers on one line, linked to each question", () => {
    expect(section(build(), "FAQ")).toEqual([
      "- [Do you ship nationwide?](https://aceyourcourse.ph/faq#faq-ship): Yes, from Iloilo City. Most orders arrive in 3–5 days.",
    ]);
  });

  it("keeps an answer's lines apart: a break after a sentence is a space, any other a semicolon", () => {
    const listed = faq({
      answer: "For some, yes:\nCE posters: ₱400 each\nEE cards: ₱600 each\n\nAsk us.",
    });
    expect(section(build({ faqs: [{ ...FAQS[0]!, items: [listed] }] }), "FAQ")[0]).toBe(
      "- [Do you ship nationwide?](https://aceyourcourse.ph/faq#faq-ship): For some, yes: CE posters: ₱400 each; EE cards: ₱600 each; Ask us.",
    );
  });

  it("leaves out a hidden FAQ", () => {
    const hidden = faq({
      id: "faq-002",
      slug: "secret",
      question: "A hidden question?",
      showOnFaqPage: false,
    });
    const text = build({ faqs: [{ ...FAQS[0]!, items: [faq(), hidden] }] });
    expect(text).not.toContain("A hidden question?");
  });

  it("leaves out the FAQ section when no FAQ is visible", () => {
    expect(build({ faqs: [] })).not.toContain("## FAQ");
  });

  it("links the five Site pages, then the official shops that are set", () => {
    const text = build();
    expect(section(text, "Pages")).toEqual([
      "- [Home](https://aceyourcourse.ph/)",
      "- [All reviewers](https://aceyourcourse.ph/products)",
      "- [FAQ](https://aceyourcourse.ph/faq)",
      "- [Reviews](https://aceyourcourse.ph/reviews)",
      "- [About](https://aceyourcourse.ph/about)",
    ]);
    expect(section(text, "Shops")).toEqual([
      "- [Ace Your Course on Shopee](https://shopee.ph/aceyourcourse)",
      "- [Ace Your Course on TikTok Shop](https://www.tiktok.com/@aceyourcourse)",
    ]);
  });

  it("leaves out the Shops section, and the summary's Marketplaces, when no shop is set", () => {
    const text = build({ shopLinks: { shopee: null, lazada: null, tiktok: null } });
    expect(text).not.toContain("## Shops");
    expect(text.split("\n")[2]).not.toContain(" on ");
  });

  it("escapes Markdown in catalogue text, so it can't change the structure", () => {
    const text = build({
      exams: [
        {
          ...CE,
          name: "Civil *Engineering* #1",
          subjects: [{ code: "X", name: "Beams_and [columns]" }],
        },
      ],
      products: [product({ title: "CE [Formula] Cards *2.0*" })],
      faqs: [
        {
          ...FAQS[0]!,
          items: [
            faq({
              question: "Paper? <b>Thick</b>",
              answer: "Yes.\n## Not a heading\n- not a list",
            }),
          ],
        },
      ],
    });
    const lines = text.split("\n");
    expect(lines).toContain("## Civil \\*Engineering\\* \\#1 (CELE)");
    expect(text).toContain("Subjects: Beams\\_and \\[columns\\]");
    expect(text).toContain(
      "- [CE \\[Formula\\] Cards \\*2.0\\*](https://aceyourcourse.ph/products/ce-formula-flash-cards): ₱600",
    );
    expect(text).toContain(
      "- [Paper? \\<b\\>Thick\\</b\\>](https://aceyourcourse.ph/faq#faq-ship): Yes. \\#\\# Not a heading; - not a list",
    );
    // The answer's line breaks are gone, so no heading or list item starts in it.
    expect(lines.filter((line) => line.startsWith("## Not"))).toEqual([]);
  });

  it("keeps a link's address whole when it has brackets or spaces", () => {
    const odd = product({ listings: { shopee: "https://shopee.ph/CE Cards (2.0)" } });
    expect(build({ products: [odd] })).toContain(
      "[Shopee](https://shopee.ph/CE%20Cards%20%282.0%29)",
    );
  });

  it("never includes Review text, ratings, rating counts or units sold, though the catalogue has them", () => {
    const text = build();
    expect(text).not.toContain("Arrived in two days");
    expect(text).not.toMatch(/4\.9|812|2,?345|★|stars?\b|rating/i);
  });

  it("adds no Member App wording of its own", () => {
    expect(build()).not.toMatch(/member app|\bapp\b/i);
  });
});
