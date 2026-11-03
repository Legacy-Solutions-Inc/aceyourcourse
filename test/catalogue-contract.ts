import { statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogueSeed } from "@/services/catalogue.schema";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

/** The Catalogue seam as the Website imports it. */
export type CatalogueSeam = typeof import("@/services/catalogue");

/**
 * One of the Catalogue seam's arms, for describeCatalogueContract: the same
 * behaviour suite runs over each (spec, Testing Decisions → Seam 1 and the
 * Admin seam). The sample arm runs in `pnpm test`; the database arm runs in
 * the database tests (src/services/catalogue.db.test.ts).
 */
export interface CatalogueArm {
  name: string;
  /**
   * The seam (@/services/catalogue) with this arm selected. After
   * vi.resetModules() it is imported again, reading the environment afresh.
   */
  seam(): Promise<CatalogueSeam>;
  /** Starts the arm's catalogue from the seed, or an edited copy. Throws when it's invalid. */
  loadSeed(seed?: CatalogueSeed): Promise<void>;
}

/**
 * Behaviour tests against the Catalogue seam's public contract, over one arm.
 * Expected values are copied by hand from docs/mockup/aycData.js (EXAMS,
 * EXAM_INFO, STORES, CONTACT, SHOP, PRODUCTS), docs/mockup/website/SiteNav.dc.html
 * and the Home Review selection at Home_v2.dc.html L349–351.
 */
export function describeCatalogueContract(arm: CatalogueArm) {
  describe(`the Catalogue contract, on the ${arm.name}`, () => {
    let seam: CatalogueSeam;
    let edited = false;

    /** The seam over an edited copy of the seed, for states the seed lacks. */
    async function seamWith(edit: (seed: CatalogueSeed) => void) {
      const seed = structuredClone(CATALOGUE_SEED);
      edit(seed);
      edited = true;
      await arm.loadSeed(seed);
      return seam;
    }

    /** The seam with the Member App switch on or off. */
    async function seamWithSwitch(memberAppLive: boolean | undefined) {
      vi.stubEnv(
        "MEMBER_APP_LIVE",
        memberAppLive === undefined ? undefined : String(memberAppLive),
      );
      vi.resetModules();
      return arm.seam();
    }

    beforeAll(async () => {
      await arm.loadSeed();
    });

    beforeEach(async () => {
      seam = await arm.seam();
    });

    // Every test starts from the seed, with the environment as it was.
    afterEach(async () => {
      vi.unstubAllEnvs();
      vi.resetModules();
      if (edited) {
        edited = false;
        await arm.loadSeed();
      }
    });

    function product(seed: CatalogueSeed, slug: string) {
      const found = seed.products.find((p) => p.slug === slug);
      if (!found) throw new Error(`the seed has no Product "${slug}"`);
      return found;
    }

    const slugs = (result: { items: { slug: string }[] }) => result.items.map((p) => p.slug);
    const ids = (items: { id: string }[]) => items.map((r) => r.id);

    const LIVE_BY_UNITS_SOLD = [
      "ce-formula-flash-cards",
      "me-formula-flash-cards",
      "cpa-flash-cards",
      "ee-flash-cards",
      "ultimate-ce-posters-2-0",
      "medtech-essential-notebook",
      "medtech-comprehensive-flash-cards",
      "ce-review-bundle-3-in-1",
    ];

    describe("catalogue seam: Exams", () => {
      it("lists the five Exams with Products, in seed order", async () => {
        const exams = await seam.listExams();
        expect(exams.map((e) => [e.code, e.name, e.board])).toEqual([
          ["CE", "Civil Engineering", "CELE"],
          ["ME", "Mechanical Engineering", "MELE"],
          ["EE", "Electrical Engineering", "REE"],
          ["MT", "Medical Technology", "MTLE"],
          ["CPA", "Accountancy", "CPALE"],
        ]);
      });

      it("lists each Exam with its Subjects and full names", async () => {
        const exams = await seam.listExams();
        const ce = exams.find((e) => e.code === "CE");
        expect(ce).toEqual({
          code: "CE",
          board: "CELE",
          name: "Civil Engineering",
          longName: "Civil Engineering Licensure Exam",
          blurb:
            "Three subjects, four formats. Our CE line started it all and it’s still our best seller. Start with the cards, add the notebook and posters, or get everything in one bundle.",
          madeFor: "Engineers needing a quick formula reference",
          subjects: [
            { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
            { code: "HPGE", name: "Hydraulics & Geotechnical Engineering" },
            { code: "PSAD", name: "Principles of Structural Analysis & Design" },
          ],
        });
        expect(exams.map((e) => e.subjects.length)).toEqual([3, 3, 3, 6, 6]);
      });

      it("does not list an Exam once none of its Products is shown on the Website", async () => {
        const seam = await seamWith((seed) => {
          for (const p of seed.products) if (p.examCode === "CPA") p.showOnWebsite = false;
        });
        expect((await seam.listExams()).map((e) => e.code)).toEqual(["CE", "ME", "EE", "MT"]);
        expect((await seam.getExamByCode("CPA"))?.name).toBe("Accountancy");
      });

      it("still lists an Exam whose only Products are Coming Soon", async () => {
        const seam = await seamWith((seed) => {
          seed.products = seed.products.filter(
            (p) => p.examCode !== "ME" || p.state === "coming-soon",
          );
          seed.reviews = seed.reviews.filter((r) =>
            seed.products.some((p) => p.id === r.productId),
          );
        });
        expect((await seam.listExams()).map((e) => e.code)).toContain("ME");
      });

      it("does not list the Exams that have no Products yet", async () => {
        const codes = (await seam.listExams()).map((e) => e.code);
        for (const soon of ["PH", "LET", "FT", "MP", "PT", "PM"]) {
          expect(codes).not.toContain(soon);
        }
      });

      it.each(["ce", "CE", "Ce"])("gets CE by the code %s", async (code) => {
        const exam = await seam.getExamByCode(code);
        expect(exam?.code).toBe("CE");
        expect(exam?.longName).toBe("Civil Engineering Licensure Exam");
      });

      it("gets CPA by its lowercase URL code", async () => {
        expect((await seam.getExamByCode("cpa"))?.name).toBe("Accountancy");
      });

      it.each(["zz", "", "   ", "c", "cel", "PH"])(
        "returns null for the unknown code %j",
        async (code) => {
          expect(await seam.getExamByCode(code)).toBeNull();
        },
      );

      it("hands out copies, so a caller's change never leaks into the next read", async () => {
        const [ce] = await seam.listExams();
        if (!ce) throw new Error("expected the seed to list CE first");
        ce.subjects.push({ code: "X", name: "Injected" });
        ce.name = "Changed";

        const again = await seam.getExamByCode("CE");
        expect(again?.name).toBe("Civil Engineering");
        expect(again?.subjects).toHaveLength(3);
      });
    });

    describe("catalogue seam: Exam pages", () => {
      it("gives CE its bundle offer of the CE Review Bundle 3-in-1, with today's copy, and every section on", async () => {
        const page = await seam.getExamPage("ce");
        expect(page).toMatchObject({
          examCode: "CE",
          sections: { subjects: true, bundleOffer: true, reviews: true },
          bundleOffer: {
            headline: "CE Review Bundle 3-in-1",
            text: "Cards, notebook, and posters for MSTC, HPGE, and PSAD in one order.",
            buttonLabel: "See the bundle",
            product: { slug: "ce-review-bundle-3-in-1", priceTo: 349900 },
          },
          seoTitle: null,
          seoDescription: null,
          shareImage: null,
          officialExamDate: null,
        });
      });

      it("gives the other Exams no bundle offer, with that section hidden", async () => {
        for (const code of ["ME", "EE", "MT", "CPA"]) {
          expect(await seam.getExamPage(code), code).toMatchObject({
            examCode: code,
            sections: { subjects: true, bundleOffer: false, reviews: true },
            bundleOffer: null,
          });
        }
      });

      it.each(["zz", "", "  "])("returns null for the unknown code %j", async (code) => {
        expect(await seam.getExamPage(code)).toBeNull();
      });

      it.each([
        ["Coming Soon", { state: "coming-soon" as const }],
        ["hidden from the Website", { showOnWebsite: false }],
      ])("drops the bundle offer while its Product is %s", async (_state, change) => {
        const seam = await seamWith((seed) => {
          const bundle = product(seed, "ce-review-bundle-3-in-1");
          Object.assign(bundle, change);
          if (bundle.state === "coming-soon") {
            Object.assign(bundle, { priceFrom: null, priceTo: null, shopee: null });
            Object.assign(bundle, { variations: [], listings: {} });
            seed.reviews = seed.reviews.filter((review) => review.productId !== bundle.id);
          }
        });
        const page = await seam.getExamPage("ce");
        expect(page?.bundleOffer).toBeNull();
        // The section stays on: the offer is back once the Product is Live again.
        expect(page?.sections.bundleOffer).toBe(true);
      });

      it("gives an Exam with no Exam page every section shown and nothing set", async () => {
        const seam = await seamWith((seed) => {
          seed.examPages = seed.examPages.filter((page) => page.examCode !== "ME");
        });
        expect(await seam.getExamPage("me")).toEqual({
          examCode: "ME",
          sections: { subjects: true, bundleOffer: true, reviews: true },
          bundleOffer: null,
          seoTitle: null,
          seoDescription: null,
          shareImage: null,
          officialExamDate: null,
        });
      });

      it("hands out copies, so a caller's change never leaks into the next read", async () => {
        const page = await seam.getExamPage("CE");
        if (!page?.bundleOffer) throw new Error("expected CE's bundle offer");
        page.sections.reviews = false;
        page.bundleOffer.headline = "Changed";

        const again = await seam.getExamPage("CE");
        expect(again?.sections.reviews).toBe(true);
        expect(again?.bundleOffer?.headline).toBe("CE Review Bundle 3-in-1");
      });
    });

    describe("catalogue seam: Website settings", () => {
      it("returns the Marketplace shop links", async () => {
        expect((await seam.getWebsiteSettings()).shopLinks).toEqual({
          shopee: "https://shopee.ph/aceyourcourse",
          lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
          tiktok: "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
        });
      });

      it("returns the social links, contact email and shop stats", async () => {
        const settings = await seam.getWebsiteSettings();
        expect(settings.socialLinks).toEqual({
          tiktok: "https://www.tiktok.com/@aceyourcourse",
          facebook: "https://www.facebook.com/aceyourcourseph",
          instagram: "https://www.instagram.com/aceyourcourseph",
        });
        expect(settings.contactEmail).toBe("aceyourcourseinc@gmail.com");
        expect(settings.shopStats).toEqual({
          rating: 4.8,
          ratingCount: 874,
          followers: "3.7K",
          asOf: "2026-10-29",
        });
      });

      it("returns the three announcement messages, with only the app one needing the Member App", async () => {
        const { announcement } = await seam.getWebsiteSettings();
        expect(announcement.id).toBeTruthy();
        expect(announcement.messages).toEqual([
          {
            text: "Physical copies on Shopee, Lazada & TikTok Shop",
            href: "/products",
            requiresMemberApp: false,
          },
          {
            text: "Digital reviewers in the app · no auto-renew",
            href: "/app",
            requiresMemberApp: true,
          },
          {
            text: "Ships from Iloilo City · SPayLater 0% on Shopee",
            href: "/faq",
            requiresMemberApp: false,
          },
        ]);
      });

      it("returns the 11.11 promo banner, hidden", async () => {
        expect((await seam.getWebsiteSettings()).promoBanner).toEqual({
          visible: false,
          text: "11.11 · Any 2 reviewers, 4% off on Shopee",
          buttonLabel: "Shop the sale",
          href: "https://shopee.ph/aceyourcourse",
          startDate: "2026-11-09",
          endDate: "2026-11-11",
        });
      });

      it("has the Member App switch off when MEMBER_APP_LIVE is unset", async () => {
        const seam = await seamWithSwitch(undefined);
        expect((await seam.getWebsiteSettings()).memberAppLive).toBe(false);
      });

      it('has the Member App switch off when MEMBER_APP_LIVE is "false"', async () => {
        const seam = await seamWithSwitch(false);
        expect((await seam.getWebsiteSettings()).memberAppLive).toBe(false);
      });

      it('has the Member App switch on when MEMBER_APP_LIVE is "true"', async () => {
        const seam = await seamWithSwitch(true);
        expect((await seam.getWebsiteSettings()).memberAppLive).toBe(true);
      });
    });

    describe("catalogue seam: Products", () => {
      it("lists the 8 Live Products by units sold by default, leaving Coming Soon out", async () => {
        const result = await seam.listProducts();
        expect(slugs(result)).toEqual(LIVE_BY_UNITS_SOLD);
        expect(result.total).toBe(8);
      });

      it("gets a Product by slug with its price in centavos, Listing and Shopee figures", async () => {
        const p = await seam.getProductBySlug("ce-formula-flash-cards");
        expect(p).toMatchObject({
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
          variations: [{ name: "FLASH CARDS: BUNDLE SECOND ED.", price: 120000 }],
          listings: {
            shopee:
              "https://shopee.ph/Civil-Engineering-Formula-Flash-Cards-(CELE-Board-Exam-School-Reviewer)-i.1276620555.24292303887",
          },
          shopee: { rating: 4.8, ratingCount: 197, unitsSold: 764, asOf: "2026-10-29" },
          deal: true,
          availableInApp: true,
        });
        expect(p?.photos).toHaveLength(8);
        expect(p?.photos[0]).toEqual({
          src: "/products/ce-formula-flash-cards/1.webp",
          alt: "Civil Engineering Formula Flash Cards, photo 1 of 8",
        });
        expect(p?.id).not.toContain("24292303887");
      });

      it("gets a Coming Soon Product by slug, with no price, Listing or figures", async () => {
        expect(await seam.getProductBySlug("ce-solving-notebook")).toMatchObject({
          state: "coming-soon",
          priceFrom: null,
          priceTo: null,
          variations: [],
          listings: {},
          shopee: null,
        });
      });

      it("maps each Product's Subjects to its Exam's codes", async () => {
        const codes = async (slug: string) => (await seam.getProductBySlug(slug))?.subjectCodes;
        expect(await codes("me-formula-flash-cards")).toEqual(["PIP", "MATH", "MD"]);
        expect(await codes("ee-flash-cards")).toEqual(["MATH", "ESAS", "EE PROF"]);
        expect(await codes("cpa-flash-cards")).toEqual(["FAR", "AUD", "AFAR", "TAX", "RFBT", "MS"]);
        expect(await codes("medtech-essential-notebook")).toEqual([
          "CLIN CHEM",
          "HEMA",
          "CLIN MIC & PARA",
          "ISBB",
          "HISTOPATH",
          "MICRO",
        ]);
      });

      it.each(["no-such-product", "", "CE-FORMULA-FLASH-CARDS"])(
        "returns null for the unknown slug %j",
        async (slug) => {
          expect(await seam.getProductBySlug(slug)).toBeNull();
        },
      );

      it("never returns a Product with Show on website off", async () => {
        const seam = await seamWith((seed) => {
          product(seed, "cpa-flash-cards").showOnWebsite = false;
          product(seed, "ce-solving-notebook").showOnWebsite = false;
        });
        expect(await seam.getProductBySlug("cpa-flash-cards")).toBeNull();
        expect(slugs(await seam.listProducts())).not.toContain("cpa-flash-cards");
        expect(slugs(await seam.listProducts({ state: "coming-soon" }))).not.toContain(
          "ce-solving-notebook",
        );
        expect((await seam.listBestSellers(10)).map((p) => p.slug)).not.toContain(
          "cpa-flash-cards",
        );
      });

      it("serves every photo from public/, optimised to at most 200 KB", async () => {
        const products = (await seam.listProducts()).items;
        const photos = products.flatMap((p) => p.photos);
        expect(photos.length).toBeGreaterThanOrEqual(products.length);
        for (const photo of photos) {
          const file = statSync(join(process.cwd(), "public", photo.src));
          expect(file.size, photo.src).toBeLessThanOrEqual(200 * 1024);
        }
      });

      it("hands out copies of Products", async () => {
        const p = await seam.getProductBySlug("ee-flash-cards");
        p?.photos.pop();
        expect((await seam.getProductBySlug("ee-flash-cards"))?.photos).toHaveLength(2);
      });

      it.each(["ce", "CE"])("filters by the Exam code %s", async (examCode) => {
        expect(slugs(await seam.listProducts({ examCode }))).toEqual([
          "ce-formula-flash-cards",
          "ultimate-ce-posters-2-0",
          "ce-review-bundle-3-in-1",
        ]);
      });

      it("filters by format", async () => {
        const result = await seam.listProducts({ format: "notebook" });
        expect(slugs(result)).toEqual(["medtech-essential-notebook"]);
        expect(result.total).toBe(1);
      });

      it.each([
        ["poster", ["ultimate-ce-posters-2-0"]],
        ["MELE", ["me-formula-flash-cards"]],
        ["accountancy", ["cpa-flash-cards"]],
        ["  medtech  ", ["medtech-essential-notebook", "medtech-comprehensive-flash-cards"]],
        [
          "hydraulics",
          ["ce-formula-flash-cards", "ultimate-ce-posters-2-0", "ce-review-bundle-3-in-1"],
        ],
        ["ISBB", ["medtech-essential-notebook", "medtech-comprehensive-flash-cards"]],
        ["bundle", ["ce-review-bundle-3-in-1"]],
        [
          "Flash Cards",
          [
            "ce-formula-flash-cards",
            "me-formula-flash-cards",
            "cpa-flash-cards",
            "ee-flash-cards",
            "medtech-comprehensive-flash-cards",
          ],
        ],
      ])(
        "searches title, names, board, Exam, format and Subjects for %j",
        async (query, expected) => {
          expect(slugs(await seam.listProducts({ query }))).toEqual(expected);
        },
      );

      it("returns an empty result with a total of 0 when nothing matches", async () => {
        expect(await seam.listProducts({ query: "pharmacy" })).toEqual({ items: [], total: 0 });
      });

      it("keeps Products whose lowest price is within the max price", async () => {
        const result = await seam.listProducts({ maxPrice: 60000 });
        expect(slugs(result)).toEqual([
          "ee-flash-cards",
          "ultimate-ce-posters-2-0",
          "medtech-comprehensive-flash-cards",
        ]);
        expect(result.total).toBe(3);
      });

      it("never lets a Coming Soon Product through the price filter", async () => {
        const result = await seam.listProducts({ maxPrice: 100 });
        expect(result).toEqual({ items: [], total: 0 });
      });

      it("filters to the Products available in the app", async () => {
        expect(slugs(await seam.listProducts({ availableInApp: true }))).toEqual([
          "ce-formula-flash-cards",
          "me-formula-flash-cards",
          "cpa-flash-cards",
          "ee-flash-cards",
          "medtech-comprehensive-flash-cards",
        ]);
      });

      it("combines filters, and counts after filtering", async () => {
        const result = await seam.listProducts({
          examCode: "CE",
          format: "posters",
          maxPrice: 50000,
        });
        expect(slugs(result)).toEqual(["ultimate-ce-posters-2-0"]);
        expect(result.total).toBe(1);
      });

      it("sorts by price, low to high, breaking ties by units sold", async () => {
        expect(slugs(await seam.listProducts({ sort: "price-asc" }))).toEqual([
          "ultimate-ce-posters-2-0",
          "medtech-comprehensive-flash-cards",
          "ee-flash-cards",
          "medtech-essential-notebook",
          "me-formula-flash-cards",
          "cpa-flash-cards",
          "ce-formula-flash-cards",
          "ce-review-bundle-3-in-1",
        ]);
      });

      it("sorts by price, high to low, breaking ties by units sold", async () => {
        expect(slugs(await seam.listProducts({ sort: "price-desc" }))).toEqual([
          "ce-formula-flash-cards",
          "ce-review-bundle-3-in-1",
          "cpa-flash-cards",
          "me-formula-flash-cards",
          "medtech-essential-notebook",
          "ee-flash-cards",
          "medtech-comprehensive-flash-cards",
          "ultimate-ce-posters-2-0",
        ]);
      });

      it("sorts top rated by rating, then by number of ratings", async () => {
        expect(slugs(await seam.listProducts({ sort: "top-rated" }))).toEqual([
          "medtech-comprehensive-flash-cards",
          "ultimate-ce-posters-2-0",
          "ce-formula-flash-cards",
          "me-formula-flash-cards",
          "ee-flash-cards",
          "cpa-flash-cards",
          "ce-review-bundle-3-in-1",
          "medtech-essential-notebook",
        ]);
      });

      it("puts Live Products without Shopee figures last when sorting by sales or rating", async () => {
        const seam = await seamWith((seed) => {
          product(seed, "ce-formula-flash-cards").shopee = null;
        });
        expect(slugs(await seam.listProducts()).at(-1)).toBe("ce-formula-flash-cards");
        expect(slugs(await seam.listProducts({ sort: "top-rated" })).at(-1)).toBe(
          "ce-formula-flash-cards",
        );
      });

      it("lists Coming Soon Products by Exam, then title, ignoring sort and max price", async () => {
        const expected = [
          "ce-solving-notebook",
          "me-notebook",
          "me-posters",
          "ee-notebook",
          "ee-posters",
          "medtech-essentials-flash-cards",
          "medtech-essentials-posters",
        ];
        const result = await seam.listProducts({ state: "coming-soon" });
        expect(slugs(result)).toEqual(expected);
        expect(result.total).toBe(7);
        expect(
          slugs(await seam.listProducts({ state: "coming-soon", sort: "price-desc", maxPrice: 1 })),
        ).toEqual(expected);
      });

      it("filters Coming Soon Products by Exam and format", async () => {
        expect(slugs(await seam.listProducts({ state: "coming-soon", examCode: "EE" }))).toEqual([
          "ee-notebook",
          "ee-posters",
        ]);
        expect(
          slugs(await seam.listProducts({ state: "coming-soon", format: "notebook" })),
        ).toEqual(["ce-solving-notebook", "me-notebook", "ee-notebook"]);
      });
    });

    describe("catalogue seam: related Products and best sellers", () => {
      async function related(slug: string, limit?: number) {
        const p = await seam.getProductBySlug(slug);
        if (!p) throw new Error(`no Product "${slug}"`);
        const result = await seam.listRelatedProducts(p, limit);
        return { scope: result.scope, slugs: result.items.map((x) => x.slug) };
      }

      it("relates the other Live Products of the same Exam, by units sold", async () => {
        expect(await related("ce-formula-flash-cards")).toEqual({
          scope: "same-exam",
          slugs: ["ultimate-ce-posters-2-0", "ce-review-bundle-3-in-1"],
        });
        expect(await related("medtech-essential-notebook")).toEqual({
          scope: "same-exam",
          slugs: ["medtech-comprehensive-flash-cards"],
        });
      });

      it("respects the limit", async () => {
        expect((await related("ce-review-bundle-3-in-1", 1)).slugs).toEqual([
          "ce-formula-flash-cards",
        ]);
      });

      it("falls back to best sellers from other Exams, never Coming Soon, when the Exam has no other Live Product", async () => {
        // ME has two Coming Soon Products, which must not count as related.
        expect(await related("me-formula-flash-cards")).toEqual({
          scope: "other-exams",
          slugs: ["ce-formula-flash-cards", "cpa-flash-cards", "ee-flash-cards"],
        });
      });

      it("relates Live Products to a Coming Soon Product's page too", async () => {
        expect(await related("ce-solving-notebook")).toEqual({
          scope: "same-exam",
          slugs: ["ce-formula-flash-cards", "ultimate-ce-posters-2-0", "ce-review-bundle-3-in-1"],
        });
      });

      it("lists best sellers by units sold, up to the limit", async () => {
        expect((await seam.listBestSellers(3)).map((p) => p.slug)).toEqual(
          LIVE_BY_UNITS_SOLD.slice(0, 3),
        );
        expect((await seam.listBestSellers(50)).map((p) => p.slug)).toEqual(LIVE_BY_UNITS_SOLD);
      });

      it("leaves Live Products without Shopee figures out of the best sellers", async () => {
        const seam = await seamWith((seed) => {
          product(seed, "me-formula-flash-cards").shopee = null;
        });
        expect((await seam.listBestSellers(3)).map((p) => p.slug)).toEqual([
          "ce-formula-flash-cards",
          "cpa-flash-cards",
          "ee-flash-cards",
        ]);
      });
    });

    describe("catalogue seam: Reviews", () => {
      it("lists every Review, most helpful first, with its Product", async () => {
        const { items, total } = await seam.listReviews();
        expect(total).toBe(16);
        expect(ids(items).slice(0, 6)).toEqual([
          "rev-013",
          "rev-006",
          "rev-001",
          "rev-007",
          "rev-002",
          "rev-010",
        ]);
        expect(items[0]).toMatchObject({
          stars: 5,
          text: "Perfect quality for Engineering students, fresh grads and retakers readying for board exam",
          variation: "MSTC, HPGE, PSAD",
          helpful: 19,
          marketplace: "shopee",
          product: {
            slug: "ultimate-ce-posters-2-0",
            shortName: "Ultimate CE Posters 2.0",
            examCode: "CE",
          },
        });
      });

      it("keeps a Review's line breaks and wording exactly", async () => {
        const { items } = await seam.listReviews({ productSlug: "cpa-flash-cards" });
        expect(items.map((r) => r.text)).toContain(
          "Suitability: Very suitable!\nI haven't really read it but as I scan, I loved it. The text is not too small. It is understandable enough. It is good for recalling. Hoping that this could really help me reach my goal. 🙏",
        );
      });

      it("breaks most-helpful ties by stars, then by the longer text", async () => {
        const { items } = await seam.listReviews();
        const helpfulOnce = items.filter((r) => r.helpful === 1);
        const lengths = helpfulOnce.map((r) => r.text.length);
        expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
        expect(items.at(-1)?.stars).toBe(3);
      });

      it("filters by Product", async () => {
        const result = await seam.listReviews({ productSlug: "ce-formula-flash-cards" });
        expect(ids(result.items).sort()).toEqual([
          "rev-001",
          "rev-002",
          "rev-003",
          "rev-004",
          "rev-005",
        ]);
        expect(result.total).toBe(5);
      });

      it("returns no Reviews for a Product that has none, or an unknown Product", async () => {
        expect(await seam.listReviews({ productSlug: "ce-review-bundle-3-in-1" })).toEqual({
          items: [],
          total: 0,
        });
        expect(await seam.listReviews({ productSlug: "nope" })).toEqual({ items: [], total: 0 });
      });

      it.each(["MT", "mt"])("filters by the Exam %s", async (examCode) => {
        expect(ids((await seam.listReviews({ examCode })).items)).toEqual(["rev-016"]);
      });

      it("filters by star bucket", async () => {
        expect((await seam.listReviews({ stars: "5" })).total).toBe(15);
        expect(await seam.listReviews({ stars: "4" })).toEqual({ items: [], total: 0 });
        expect(ids((await seam.listReviews({ stars: "3-or-less" })).items)).toEqual(["rev-016"]);
      });

      it.each([
        ["GLOSSY", ["rev-014"]],
        ["ultimate ce posters", ["rev-013", "rev-014", "rev-015"]],
        ["bundle,160 gsm", ["rev-006", "rev-007", "rev-011", "rev-008", "rev-012"]],
      ])("searches text, Product short name and variation for %j", async (query, expected) => {
        expect(ids((await seam.listReviews({ query })).items).sort()).toEqual([...expected].sort());
      });

      it("sorts highest first, then by helpful", async () => {
        const { items } = await seam.listReviews({ sort: "highest" });
        expect(items[0]?.id).toBe("rev-013");
        expect(items.at(-1)?.id).toBe("rev-016");
      });

      it("sorts most critical first, then by helpful", async () => {
        const { items } = await seam.listReviews({ sort: "most-critical" });
        expect(ids(items).slice(0, 3)).toEqual(["rev-016", "rev-013", "rev-006"]);
      });

      it("sorts most detailed first, by text length", async () => {
        const { items } = await seam.listReviews({ sort: "most-detailed" });
        const lengths = items.map((r) => r.text.length);
        expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
        expect(items[0]?.id).toBe("rev-003");
      });

      it.each(["most-helpful", "highest", "most-critical", "most-detailed"] as const)(
        "keeps the seed order for Reviews that tie on every %s key",
        async (sort) => {
          // Same stars, helpful votes and text length, so only the seed order is
          // left. The FAQ quotes go too, as they must match their Review's text.
          let seedOrder: string[] = [];
          const seam = await seamWith((seed) => {
            for (const review of seed.reviews) {
              review.stars = 5;
              review.helpful = 2;
              review.text = `Review ${review.id}`;
            }
            for (const faq of seed.faqs) faq.reviewQuote = null;
            seedOrder = ids(seed.reviews);
          });
          const { items } = await seam.listReviews({ sort });
          // Every seeded Review is of a Live Product, so all of them are listed.
          expect(ids(items)).toEqual(seedOrder);
        },
      );

      it("sorts for an Exam page: by the Products' best-seller order, then seed order", async () => {
        const { items } = await seam.listReviews({ examCode: "CE", sort: "exam-page" });
        expect(ids(items)).toEqual([
          "rev-001",
          "rev-002",
          "rev-003",
          "rev-004",
          "rev-005",
          "rev-013",
          "rev-014",
          "rev-015",
        ]);
      });

      it("applies the limit after sorting, and still reports the full total", async () => {
        const result = await seam.listReviews({ examCode: "CE", sort: "exam-page", limit: 7 });
        expect(ids(result.items)).toEqual([
          "rev-001",
          "rev-002",
          "rev-003",
          "rev-004",
          "rev-005",
          "rev-013",
          "rev-014",
        ]);
        expect(result.total).toBe(8);
      });

      it("leaves out Reviews of a Product with Show on website off", async () => {
        const seam = await seamWith((seed) => {
          product(seed, "ultimate-ce-posters-2-0").showOnWebsite = false;
        });
        const { items, total } = await seam.listReviews();
        expect(total).toBe(13);
        expect(items.map((r) => r.product.slug)).not.toContain("ultimate-ce-posters-2-0");
        expect(ids(await seam.listHomeReviews())).not.toContain("rev-013");
      });

      it("returns the 9 pinned Home Reviews in pin order, including the 3-star one", async () => {
        const home = await seam.listHomeReviews();
        expect(ids(home)).toEqual([
          "rev-013",
          "rev-006",
          "rev-001",
          "rev-009",
          "rev-016",
          "rev-014",
          "rev-011",
          "rev-007",
          "rev-004",
        ]);
        expect(home.find((r) => r.stars === 3)?.product.slug).toBe("medtech-essential-notebook");
      });

      it("caps the Home selection at 9 Reviews", async () => {
        const seam = await seamWith((seed) => {
          seed.reviews.forEach((review, index) => {
            review.homePin = index + 1;
          });
        });
        const home = await seam.listHomeReviews();
        expect(home).toHaveLength(9);
        expect(home[0]?.id).toBe("rev-001");
      });
    });

    describe("catalogue seam: FAQs", () => {
      const faqSlugs = (groups: { items: { slug: string }[] }[]) =>
        groups.flatMap((group) => group.items.map((faq) => faq.slug));

      it("lists the five groups in their fixed order, each with its FAQs in order", async () => {
        const seam = await seamWithSwitch(false);
        const groups = await seam.listFaqs();
        expect(groups.map((g) => [g.group, g.title, g.items.map((faq) => faq.slug)])).toEqual([
          ["shipping", "Shipping", ["ship", "nationwide", "tracking"]],
          ["paper", "Paper and print", ["flash-cards", "posters", "notebook"]],
          ["coverage", "What’s covered", ["coverage", "one-subject", "on-its-own", "my-exam"]],
          ["buying", "Buying", ["where-to-buy", "discounts", "installments"]],
          ["authenticity", "Authenticity", ["original", "copies"]],
        ]);
      });

      it("hides every FAQ that needs the Member App while the switch is off", async () => {
        const seam = await seamWithSwitch(false);
        const items = (await seam.listFaqs()).flatMap((group) => group.items);
        expect(items).toHaveLength(15);
        expect(items.filter((faq) => faq.requiresMemberApp)).toEqual([]);
      });

      it('shows the Member App FAQs under "Buying and the app" while the switch is on', async () => {
        const seam = await seamWithSwitch(true);
        const groups = await seam.listFaqs();
        expect(groups.find((g) => g.group === "buying")).toMatchObject({
          title: "Buying and the app",
          items: [
            { slug: "where-to-buy" },
            { slug: "digital" },
            { slug: "auto-renew", popularLabel: "Does my Plan renew automatically?" },
            { slug: "two-devices", popularLabel: "Can I use my account on two devices?" },
            { slug: "discounts" },
            { slug: "installments" },
          ],
        });
        expect(faqSlugs(groups)).toHaveLength(18);
      });

      it("says nothing about the Member App's Plans or payments while the switch is off", async () => {
        const seam = await seamWithSwitch(false);
        const text = (await seam.listFaqs())
          .flatMap((group) => [
            group.title,
            ...group.items.flatMap((faq) => [
              faq.question,
              faq.answer,
              faq.popularLabel ?? "",
              faq.reviewQuote?.text ?? "",
            ]),
          ])
          .join("\n");
        expect(text).not.toMatch(/subscription|PayMongo|Billing page|here in the app|Member App/i);
      });

      it("never calls a Plan a subscription, even with the switch on", async () => {
        const seam = await seamWithSwitch(true);
        const text = (await seam.listFaqs())
          .flatMap((group) => group.items.flatMap((faq) => [faq.question, faq.answer]))
          .join("\n");
        expect(text).not.toMatch(/subscription|here in the app/i);
        expect(text).toMatch(/Plan/);
      });

      it("offers popular chips for the visible FAQs only", async () => {
        const seam = await seamWithSwitch(false);
        const chips = (await seam.listFaqs())
          .flatMap((group) => group.items)
          .filter((faq) => faq.popularLabel)
          .map((faq) => [faq.slug, faq.popularLabel]);
        expect(chips).toEqual([
          ["ship", "Where do orders ship from?"],
          ["original", "How do I know I’m buying the original?"],
        ]);
      });

      it("credits a quote to its Review's stars, variation and Product", async () => {
        const posters = (await seam.listFaqs())
          .flatMap((group) => group.items)
          .find((faq) => faq.slug === "posters");
        expect(posters?.reviewQuote).toEqual({
          reviewId: "rev-014",
          text: "Glossy type yung paper, makapal sya. Malalaki printing ng formulas kaya mababasa mo mga 6ft away hahaha.",
          stars: 5,
          variation: "MSTC, HPGE, PSAD",
          product: {
            slug: "ultimate-ce-posters-2-0",
            shortName: "Ultimate CE Posters 2.0",
            examCode: "CE",
          },
        });
      });

      it("keeps only the one quote a seeded Review contains word for word", async () => {
        const quoted = (await seam.listFaqs())
          .flatMap((group) => group.items)
          .filter((faq) => faq.reviewQuote)
          .map((faq) => faq.slug);
        expect(quoted).toEqual(["posters"]);
      });

      it("puts the coverage table on exactly one FAQ", async () => {
        const withTable = (await seam.listFaqs())
          .flatMap((group) => group.items)
          .filter((faq) => faq.showCoverageTable);
        expect(withTable.map((faq) => faq.slug)).toEqual(["coverage"]);
      });

      it("leaves out an FAQ with Show on FAQ page off", async () => {
        const seam = await seamWith((seed) => {
          const nationwide = seed.faqs.find((faq) => faq.slug === "nationwide");
          if (!nationwide) throw new Error("the seed has no nationwide FAQ");
          nationwide.showOnFaqPage = false;
        });
        expect(faqSlugs(await seam.listFaqs())).not.toContain("nationwide");
      });

      it("drops a group with no visible FAQs", async () => {
        const seam = await seamWith((seed) => {
          seed.faqs
            .filter((faq) => faq.group === "authenticity")
            .forEach((faq) => {
              faq.showOnFaqPage = false;
            });
        });
        const groups = await seam.listFaqs();
        expect(groups.map((g) => g.group)).toEqual(["shipping", "paper", "coverage", "buying"]);
      });

      it("drops a quote whose Review's Product isn't shown on the Website", async () => {
        const seam = await seamWith((seed) => {
          product(seed, "ultimate-ce-posters-2-0").showOnWebsite = false;
        });
        const posters = (await seam.listFaqs())
          .flatMap((group) => group.items)
          .find((faq) => faq.slug === "posters");
        expect(posters).toMatchObject({ slug: "posters", reviewQuote: null });
      });

      it("returns copies, so a page can't change the seed", async () => {
        const [first] = await seam.listFaqs();
        if (!first) throw new Error("expected an FAQ group");
        first.items.length = 0;
        expect((await seam.listFaqs())[0]?.items.length).toBeGreaterThan(0);
      });
    });
  });
}
