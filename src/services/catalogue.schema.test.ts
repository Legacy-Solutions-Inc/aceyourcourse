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
    products: [
      {
        id: "prd-1",
        slug: "ce-posters",
        examCode: "CE",
        title: "Civil Engineering Posters",
        shortName: "CE Posters",
        format: "posters",
        size: "A3",
        edition: "2.0",
        subjectCodes: ["MSTC", "HPGE"],
        state: "live",
        priceFrom: 40000,
        priceTo: 125000,
        variations: [
          { name: "CE POSTERS: ALL", price: 125000 },
          { name: "CE POSTERS: MSTC ONLY", price: 40000 },
        ],
        photos: [
          { src: "/products/ce-posters/1.webp", alt: "Civil Engineering Posters, photo 1 of 1" },
        ],
        listings: {
          shopee: "https://shopee.ph/CE-Posters-i.1276620555.27980584601",
          tiktok: "https://vt.tiktok.com/ZS49ve6cu/",
        },
        shopee: { rating: 4.9, ratingCount: 52, unitsSold: 172, asOf: "2026-10-29" },
        deal: true,
        availableInApp: false,
        showOnWebsite: true,
        whatsInside: null,
        madeFor: null,
        seoTitle: null,
        seoDescription: null,
      },
      {
        id: "prd-2",
        slug: "me-notebook",
        examCode: "ME",
        title: "Mechanical Engineering Notebook",
        shortName: "ME Notebook",
        format: "notebook",
        size: "A5",
        edition: null,
        subjectCodes: ["MATH"],
        state: "coming-soon",
        priceFrom: null,
        priceTo: null,
        variations: [],
        photos: [],
        listings: {},
        shopee: null,
        deal: false,
        availableInApp: false,
        showOnWebsite: true,
        whatsInside: null,
        madeFor: null,
        seoTitle: null,
        seoDescription: null,
      },
    ],
    reviews: [
      {
        id: "rev-1",
        productId: "prd-1",
        stars: 5,
        text: "Glossy paper.\nReadable from 6 ft away.",
        variation: "MSTC, HPGE",
        helpful: 19,
        marketplace: "shopee",
        homePin: 1,
      },
      {
        id: "rev-2",
        productId: "prd-1",
        stars: 3,
        text: "Good, but the font sizes differ.",
        variation: null,
        helpful: 0,
        marketplace: "shopee",
        homePin: null,
      },
    ],
    faqs: [
      {
        id: "faq-1",
        slug: "ship",
        group: "shipping",
        order: 1,
        question: "Where do orders ship from?",
        answer: "Every order ships from Iloilo City.",
        reviewQuote: null,
        popularLabel: "Where do orders ship from?",
        requiresMemberApp: false,
        showOnFaqPage: true,
        showCoverageTable: false,
      },
      {
        id: "faq-2",
        slug: "posters",
        group: "paper",
        order: 1,
        question: "What are the posters like?",
        answer: "A3 size.",
        reviewQuote: { reviewId: "rev-1", text: "Readable from 6 ft away." },
        popularLabel: null,
        requiresMemberApp: false,
        showOnFaqPage: true,
        showCoverageTable: false,
      },
      {
        id: "faq-3",
        slug: "coverage",
        group: "coverage",
        order: 1,
        question: "What subjects does each exam’s reviewer cover?",
        answer: "Each reviewer follows that exam’s board subjects.",
        reviewQuote: null,
        popularLabel: null,
        requiresMemberApp: false,
        showOnFaqPage: true,
        showCoverageTable: true,
      },
      {
        id: "faq-4",
        slug: "auto-renew",
        group: "buying",
        order: 1,
        question: "Does my Plan renew automatically?",
        answer: "No. A Plan never renews by itself.",
        reviewQuote: null,
        popularLabel: "Does my Plan renew automatically?",
        requiresMemberApp: true,
        showOnFaqPage: false,
        showCoverageTable: false,
      },
    ],
    examPages: [
      {
        examCode: "CE",
        sections: { subjects: true, bundleOffer: true, reviews: false },
        bundleOffer: {
          productId: "prd-1",
          headline: "CE Posters",
          text: "Every CE formula on your wall.",
          buttonLabel: "See the posters",
        },
        seoTitle: "CE Board Exam Reviewer",
        seoDescription: null,
        shareImage: "/api/dev/uploads/share-1",
        officialExamDate: "2027-04-24",
      },
    ],
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
    expect(errorsFor(seed)).toContainEqual(
      expect.stringMatching(/^exams\.1\.code: .*duplicate.*CE/i),
    );
  });

  it("treats Exam codes that differ only in case as duplicates", () => {
    const seed = validSeed();
    at(seed.exams, 1).code = "Ce";
    const errors = errorsFor(seed);
    expect(errors).toContainEqual(expect.stringMatching(/^exams\.1\.code: .*duplicate/i));
  });

  it("rejects a Subject code used twice in one Exam, naming the field", () => {
    const seed = validSeed();
    at(seed.exams, 0).subjects.push({ code: "MSTC", name: "Mathematics again" });
    expect(errorsFor(seed)).toEqual([
      'exams.0.subjects.2.code: duplicate Subject code "MSTC" in CE',
    ]);
  });

  it("allows the same Subject code in two Exams", () => {
    const seed = validSeed();
    at(seed.exams, 1).subjects.push({ code: "MSTC", name: "Mathematics" });
    expect(validateCatalogueSeed(seed).success).toBe(true);
  });

  it("rejects a lowercase Exam code, which would break its Exam page URL", () => {
    const seed = validSeed();
    at(seed.exams, 1).code = "me";
    expect(errorsFor(seed)).toContainEqual(expect.stringMatching(/^exams\.1\.code: /));
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
    expect(errorsFor(seed)).toContainEqual(expect.stringMatching(/^exams\.1\.subjects: /));
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

  it("accepts a one-day promo banner, which ends the day it starts", () => {
    const seed = validSeed();
    present(seed.settings.promoBanner).endDate = "2026-11-09";
    expect(validateCatalogueSeed(seed).success).toBe(true);
  });

  it("rejects a promo date that is not an ISO date", () => {
    const seed = validSeed();
    present(seed.settings.promoBanner).startDate = "9 Nov 2026";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^settings\.promoBanner\.startDate: .*ISO date/),
    ]);
  });

  it("rejects a promo date that isn't on the calendar, instead of rolling it over", () => {
    // new Date("2026-11-31") is 1 Dec, which would quietly run the sale a day long.
    const seed = validSeed();
    present(seed.settings.promoBanner).endDate = "2026-11-31";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^settings\.promoBanner\.endDate: .*real ISO date/),
    ]);
  });

  it("rejects an announcement message with a relative or non-https link", () => {
    const seed = validSeed();
    at(seed.settings.announcement.messages, 0).href = "products";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^settings\.announcement\.messages\.0\.href: /),
    ]);
  });

  it.each(["//evil.example", "/\\evil.example", "/products page", "https://"])(
    "rejects a link a browser would read as another site, or not at all: %s",
    (href) => {
      const seed = validSeed();
      at(seed.settings.announcement.messages, 0).href = href;
      expect(errorsFor(seed)).toEqual([
        expect.stringMatching(/^settings\.announcement\.messages\.0\.href: /),
      ]);
    },
  );

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

describe("validateCatalogueSeed: Products", () => {
  const live = (seed: CatalogueSeed) => at(seed.products, 0);
  const comingSoon = (seed: CatalogueSeed) => at(seed.products, 1);

  it("accepts Live and Coming Soon Products with their Reviews", () => {
    const result = validateCatalogueSeed(validSeed());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.products.map((p) => p.slug)).toEqual(["ce-posters", "me-notebook"]);
      expect(result.data.reviews.map((r) => r.id)).toEqual(["rev-1", "rev-2"]);
    }
  });

  it("accepts a single-priced Live Product with no variations, Listings or Shopee figures", () => {
    const seed = validSeed();
    Object.assign(live(seed), { priceTo: null, variations: [], listings: {}, shopee: null });
    seed.reviews = [];
    seed.faqs = []; // one quotes a Review
    expect(validateCatalogueSeed(seed).success).toBe(true);
  });

  it("rejects a Product that lists a Subject twice, naming the field", () => {
    const seed = validSeed();
    const subjects = live(seed).subjectCodes;
    subjects.push(at(subjects, 0));
    expect(errorsFor(seed)).toEqual([
      `products.0.subjectCodes.${subjects.length - 1}: "${at(subjects, 0)}" is listed twice`,
    ]);
  });

  it("rejects a duplicate Product id", () => {
    const seed = validSeed();
    comingSoon(seed).id = "prd-1";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.1\.id: .*duplicate/i)]);
  });

  it("rejects a duplicate slug", () => {
    const seed = validSeed();
    comingSoon(seed).slug = "ce-posters";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.1\.slug: .*duplicate/i)]);
  });

  it.each(["CE-Posters", "ce posters", "ce--posters", "-ce-posters", "ce_posters"])(
    "rejects the slug %j, which is not kebab-case",
    (slug) => {
      const seed = validSeed();
      live(seed).slug = slug;
      expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.0\.slug: /)]);
    },
  );

  it("rejects an unknown Exam", () => {
    const seed = validSeed();
    live(seed).examCode = "PH";
    expect(errorsFor(seed)).toContainEqual(
      expect.stringMatching(/^products\.0\.examCode: .*unknown Exam "PH"/i),
    );
  });

  it("rejects a Subject that is not on the Product's Exam", () => {
    const seed = validSeed();
    live(seed).subjectCodes = ["MSTC", "MATH"];
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^products\.0\.subjectCodes\.1: .*"MATH" is not a Subject of CE/i),
    ]);
  });

  it("rejects a Product with no Subjects", () => {
    const seed = validSeed();
    live(seed).subjectCodes = [];
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.0\.subjectCodes: /)]);
  });

  it.each([null, 0, -100])("rejects a Live Product priced %j", (priceFrom) => {
    const seed = validSeed();
    live(seed).priceFrom = priceFrom;
    expect(errorsFor(seed)).toContainEqual(expect.stringMatching(/^products\.0\.priceFrom: /));
  });

  it("rejects a price in fractions of a centavo", () => {
    const seed = validSeed();
    live(seed).priceFrom = 40000.5;
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.0\.priceFrom: /)]);
  });

  it("rejects a Live Product whose price range ends below where it starts", () => {
    const seed = validSeed();
    live(seed).priceTo = 30000;
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.0\.priceTo: /)]);
  });

  it("rejects a Live variation priced at 0", () => {
    const seed = validSeed();
    at(live(seed).variations, 1).price = 0;
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^products\.0\.variations\.1\.price: /),
    ]);
  });

  it("rejects a Live Product with no photos", () => {
    const seed = validSeed();
    live(seed).photos = [];
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.0\.photos: .*photo/i)]);
  });

  it("rejects a photo hot-linked from Shopee's CDN", () => {
    const seed = validSeed();
    at(live(seed).photos, 0).src = "https://down-ph.img.susercontent.com/file/ph-11134207-abc";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^products\.0\.photos\.0\.src: .*self-hosted/i),
    ]);
  });

  it("rejects a photo with no alt text", () => {
    const seed = validSeed();
    at(live(seed).photos, 0).alt = " ";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.0\.photos\.0\.alt: /)]);
  });

  it("rejects a Coming Soon Product with a price", () => {
    const seed = validSeed();
    comingSoon(seed).priceFrom = 69900;
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^products\.1\.priceFrom: .*Coming Soon/i),
    ]);
  });

  it("rejects a Coming Soon Product with a price range end", () => {
    const seed = validSeed();
    comingSoon(seed).priceTo = 69900;
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.1\.priceTo: /)]);
  });

  it("rejects a Coming Soon Product with variations", () => {
    const seed = validSeed();
    comingSoon(seed).variations = [{ name: "ME NOTEBOOK: A5", price: 69900 }];
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.1\.variations: /)]);
  });

  it("rejects a Coming Soon Product with a Listing", () => {
    const seed = validSeed();
    comingSoon(seed).listings = { shopee: "https://shopee.ph/ME-Notebook-i.1.2" };
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.1\.listings: /)]);
  });

  it("rejects a Coming Soon Product with Shopee figures", () => {
    const seed = validSeed();
    comingSoon(seed).shopee = { rating: 0, ratingCount: 0, unitsSold: 0, asOf: "2026-10-29" };
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.1\.shopee: /)]);
  });

  it("rejects a Lazada Listing on a shopee.ph host", () => {
    const seed = validSeed();
    live(seed).listings.lazada = "https://shopee.ph/CE-Posters-i.1276620555.27980584601";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^products\.0\.listings\.lazada: .*lazada\.com\.ph/i),
    ]);
  });

  it("rejects a Shopee Listing on a look-alike host", () => {
    const seed = validSeed();
    live(seed).listings.shopee = "https://shopee.ph.example.com/CE-Posters";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.0\.listings\.shopee: /)]);
  });

  it("rejects a Listing that is not https", () => {
    const seed = validSeed();
    live(seed).listings.shopee = "http://shopee.ph/CE-Posters-i.1276620555.27980584601";
    expect(errorsFor(seed)).toContainEqual(
      expect.stringMatching(/^products\.0\.listings\.shopee: .*https/i),
    );
  });

  it.each([
    ["lazada", "https://www.lazada.com.ph/products/ce-posters-i123.html"],
    ["tiktok", "https://www.tiktok.com/view/product/123"],
    ["tiktok", "https://vt.tiktok.com/ZS49ve6cu/"],
  ] as const)("accepts a %s Listing on its own host: %s", (marketplace, url) => {
    const seed = validSeed();
    live(seed).listings[marketplace] = url;
    expect(validateCatalogueSeed(seed).success).toBe(true);
  });

  it.each([
    ["rating", 5.1],
    ["rating", -0.1],
    ["ratingCount", -1],
    ["unitsSold", 2.5],
  ] as const)("rejects Shopee figures with %s %j", (field, value) => {
    const seed = validSeed();
    present(live(seed).shopee)[field] = value;
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(new RegExp(`^products\\.0\\.shopee\\.${field}: `)),
    ]);
  });

  it("rejects Shopee figures whose date is not an ISO date", () => {
    const seed = validSeed();
    present(live(seed).shopee).asOf = "29 Oct 2026";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^products\.0\.shopee\.asOf: /)]);
  });
});

describe("validateCatalogueSeed: Reviews", () => {
  it.each([0, 6, 4.5])("rejects a Review with %j stars", (stars) => {
    const seed = validSeed();
    Object.assign(at(seed.reviews, 0), { stars });
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^reviews\.0\.stars: /)]);
  });

  it("rejects a Review with blank text", () => {
    const seed = validSeed();
    at(seed.reviews, 1).text = "  ";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^reviews\.1\.text: /)]);
  });

  it("rejects a duplicate Review id", () => {
    const seed = validSeed();
    at(seed.reviews, 1).id = "rev-1";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^reviews\.1\.id: .*duplicate/i)]);
  });

  it("rejects a Review of an unknown Product", () => {
    const seed = validSeed();
    at(seed.reviews, 1).productId = "prd-404";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^reviews\.1\.productId: .*unknown Product "prd-404"/i),
    ]);
  });

  it("rejects a Review of a Coming Soon Product", () => {
    const seed = validSeed();
    at(seed.reviews, 1).productId = "prd-2";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^reviews\.1\.productId: .*Coming Soon/i),
    ]);
  });

  it("rejects a negative helpful count", () => {
    const seed = validSeed();
    at(seed.reviews, 0).helpful = -1;
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^reviews\.0\.helpful: /)]);
  });

  it("rejects a duplicate homePin", () => {
    const seed = validSeed();
    at(seed.reviews, 1).homePin = 1;
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^reviews\.1\.homePin: .*duplicate/i)]);
  });

  it.each([0, -1, 1.5])("rejects the homePin %j, which is not a positive whole number", (pin) => {
    const seed = validSeed();
    at(seed.reviews, 0).homePin = pin;
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^reviews\.0\.homePin: /)]);
  });
});

describe("validateCatalogueSeed: FAQs", () => {
  const faq = (seed: CatalogueSeed, index: number) => at(seed.faqs, index);

  it("accepts FAQs with a Review quote, a popular chip, the app flag and the coverage table", () => {
    // The fixture also reuses order 1 in every group: orders are per group.
    const result = validateCatalogueSeed(validSeed());
    expect(result.success).toBe(true);
  });

  it("accepts an answer of exactly 400 characters", () => {
    const seed = validSeed();
    faq(seed, 0).answer = "a".repeat(400);
    expect(validateCatalogueSeed(seed).success).toBe(true);
  });

  it("rejects an answer of 401 characters", () => {
    const seed = validSeed();
    faq(seed, 0).answer = "a".repeat(401);
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^faqs\.0\.answer: .*400/)]);
  });

  it("rejects a blank question", () => {
    const seed = validSeed();
    faq(seed, 1).question = " ";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^faqs\.1\.question: /)]);
  });

  it("rejects a duplicate FAQ id", () => {
    const seed = validSeed();
    faq(seed, 1).id = "faq-1";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^faqs\.1\.id: .*duplicate/i)]);
  });

  it("rejects a duplicate slug, which would give two FAQs one deep link", () => {
    const seed = validSeed();
    faq(seed, 2).slug = "ship";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^faqs\.2\.slug: .*duplicate slug "ship"/i),
    ]);
  });

  it("rejects a slug that is not kebab-case", () => {
    const seed = validSeed();
    faq(seed, 0).slug = "Ship from";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^faqs\.0\.slug: .*kebab-case/)]);
  });

  it("rejects an unknown group", () => {
    const seed = validSeed();
    Object.assign(faq(seed, 0), { group: "returns" });
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^faqs\.0\.group: /)]);
  });

  it("rejects two FAQs with the same order in one group", () => {
    const seed = validSeed();
    faq(seed, 1).group = "shipping";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^faqs\.1\.order: .*order 1 is already used in shipping/i),
    ]);
  });

  it("rejects a second FAQ with the coverage table", () => {
    const seed = validSeed();
    faq(seed, 0).showCoverageTable = true;
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^faqs\.2\.showCoverageTable: .*only one FAQ/i),
    ]);
  });

  it("rejects a quote that is not word for word in its Review", () => {
    const seed = validSeed();
    present(faq(seed, 1).reviewQuote).text = "Readable from 6 feet away.";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^faqs\.1\.reviewQuote\.text: .*word for word.*"rev-1"/i),
    ]);
  });

  it("rejects a quote of an unknown Review", () => {
    const seed = validSeed();
    present(faq(seed, 1).reviewQuote).reviewId = "rev-404";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^faqs\.1\.reviewQuote\.reviewId: .*unknown Review "rev-404"/i),
    ]);
  });

  it("rejects a blank popular label", () => {
    const seed = validSeed();
    faq(seed, 0).popularLabel = "";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^faqs\.0\.popularLabel: /)]);
  });
});

describe("validateCatalogueSeed: Exam pages", () => {
  const page = (seed: CatalogueSeed) => at(seed.examPages, 0);

  it("accepts an Exam page with a bundle offer, SEO overrides, a share image and a date", () => {
    expect(validateCatalogueSeed(validSeed()).success).toBe(true);
  });

  it("accepts an Exam with no Exam page, which uses the defaults", () => {
    const seed = validSeed();
    seed.examPages = [];
    expect(validateCatalogueSeed(seed).success).toBe(true);
  });

  it("rejects a bundle offer of a Product from another Exam", () => {
    const seed = validSeed();
    present(page(seed).bundleOffer).productId = "prd-2";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^examPages\.0\.bundleOffer\.productId: .*"me-notebook".*not a CE/),
    ]);
  });

  it("rejects a bundle offer of an unknown Product", () => {
    const seed = validSeed();
    present(page(seed).bundleOffer).productId = "prd-404";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^examPages\.0\.bundleOffer\.productId: .*unknown Product "prd-404"/),
    ]);
  });

  it("rejects a bundle offer with a blank headline", () => {
    const seed = validSeed();
    present(page(seed).bundleOffer).headline = " ";
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^examPages\.0\.bundleOffer\.headline: /),
    ]);
  });

  it("rejects an Exam page for an unknown Exam", () => {
    const seed = validSeed();
    seed.examPages.push({ ...page(seed), examCode: "XX", bundleOffer: null });
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^examPages\.1\.examCode: .*unknown Exam "XX"/),
    ]);
  });

  it("rejects a second Exam page for the same Exam", () => {
    const seed = validSeed();
    seed.examPages.push({ ...page(seed) });
    expect(errorsFor(seed)).toEqual([
      expect.stringMatching(/^examPages\.1\.examCode: .*second Exam page for "CE"/),
    ]);
  });

  it("rejects an Official Exam Date that isn't on the calendar", () => {
    const seed = validSeed();
    page(seed).officialExamDate = "2026-02-30";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^examPages\.0\.officialExamDate: /)]);
  });

  it("rejects a share image hot-linked from another site", () => {
    const seed = validSeed();
    page(seed).shareImage = "https://example.com/share.jpg";
    expect(errorsFor(seed)).toEqual([expect.stringMatching(/^examPages\.0\.shareImage: /)]);
  });
});
